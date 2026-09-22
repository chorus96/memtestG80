/*
 * ============================================================================
 * memtestG80_cli.cpp — 호스트 프로그램 (CUDA Driver API · 교육용 최소 예제)
 * ============================================================================
 *
 * 【이 파일만 읽어도 되는 세미나 노트 — 먼저 여기부터】
 *
 * ■ 큰 그림
 *   이 프로그램은 CPU(호스트)에서 돌면서, GPU(디바이스)에 커널을 로드·실행시키는
 *   "지휘자"입니다. GPU에서 도는 커널 코드는 별도 파일(memtestG80_kernels.cu →
 *   memtestG80.cubin)에 있고, 이 프로그램이 실행 중에 그 cubin 을 불러옵니다.
 *
 * ■ 런타임 API vs 드라이버 API (왜 코드가 이렇게 생겼나)
 *   흔히 쓰는 런타임 API(cudaMalloc, 커널<<<...>>>(...), cudaMemcpy)는 초기화·커널
 *   로딩·인자 전달을 컴파일러가 자동으로 처리해 "감춰" 줍니다. 이 예제는 그 감춰진
 *   단계를 개발자가 직접 쓰는 "드라이버 API"(cu* 로 시작)를 씁니다. 그래서 커널이
 *   실제로 "어떻게 로드되고 실행되는지"를 눈으로 볼 수 있습니다.
 *
 * ■ main() 이 밟는 순서 (아래 코드도 이 순서대로 읽으면 됩니다)
 *     cuInit             드라이버 초기화 (맨 처음 한 번)
 *     cuDeviceGet*       GPU 선택·정보 조회 (이름, compute capability)
 *     cuCtxCreate        컨텍스트 생성 (이후 모든 cu* 호출의 대상 = "작업 공간")
 *     cuModuleLoad       cubin 파일을 모듈로 로드            ┐
 *     cuModuleGetFunction 모듈에서 커널을 "이름으로" 찾기     ├ 로딩·실행의 3핵심
 *     cuLaunchKernel     커널 실행                           ┘
 *     cuMemcpyDtoH       결과(디바이스→호스트) 복사
 *     cuMemFree/Unload/CtxDestroy  정리 (얻은 것을 역순으로 해제)
 *
 * ■ 이 프로그램이 하는 일 (기능)
 *   GPU 전역 메모리에 0xFFFFFFFF 와 0x0 을 쓰고 되읽어, 값이 바뀐 비트(=오류)를
 *   세는 간단한 메모리 테스트("Moving Inversions")를 maxIters 번 반복합니다.
 *
 * 빌드: g++ (이 파일) + nvcc -cubin (커널). 링크는 드라이버 라이브러리 -lcuda.
 * 대상: Linux x86-64 · 단일 GPU · 라이선스: LGPL v3
 * ============================================================================
 */
#include <cstdlib>      // atoi, getenv, malloc, free, exit
#include <cstdio>       // printf, sscanf
#include <string>       // std::string (인자 비교용)
#include <map>          // std::map (커널 핸들 캐시)
#include <cuda.h>       // ★ CUDA Driver API 선언: cu* 함수, CUcontext/CUmodule/CUfunction/CUdeviceptr
#include <sys/time.h>   // gettimeofday (밀리초 타이머)
#include <unistd.h>     // usleep (슬립 폴링)

typedef unsigned int uint;

// ---- 밀리초 타이머 (경과 시간 측정용) ----
static unsigned getTimeMilliseconds(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec*1000 + tv.tv_usec/1000;
}

// ---- 오류/타임아웃 "센티넬" ----
//   함수가 uint(오류 개수)를 돌려주는데, 실패를 구분하려고 정상값이 될 수 없는
//   특수값을 약속으로 사용합니다. (오류 개수가 40억을 넘을 일은 없으므로 안전)
#define MEMTEST_LAUNCH_FAILED 0xFFFFFFFFu   // 커널 런치/드라이버 호출 실패
#define MEMTEST_TIMEOUT       0xFFFFFFFEu   // 커널이 제한 시간 내 끝나지 않음
// 드라이버 호출이 CUDA_SUCCESS 가 아니면 즉시 실패 센티넬을 반환하는 축약 매크로.
#define CU_CHECK_RET(call) do { if ((call) != CUDA_SUCCESS) return MEMTEST_LAUNCH_FAILED; } while (0)

// ===================================================================
// 커널 모듈 관리
//   cuModuleLoad 로 올린 cubin(=g_module)에서 커널을 "이름으로" 찾아 캐시합니다.
// ===================================================================
static CUmodule g_module = 0;                        // 로드된 cubin 모듈 핸들
static std::map<std::string, CUfunction> g_funcs;    // "이름 → CUfunction" 캐시

// K("커널이름") : 모듈에서 그 이름의 커널 핸들(CUfunction)을 얻는다.
//   cuModuleGetFunction 은 (extern "C" 덕분에) 소스에 쓴 이름 그대로 커널을 찾는다.
//   한 번 찾으면 map 에 저장 → 반복 실행 시 매번 다시 찾지 않도록(성능).
static CUfunction K(const char* name) {
    std::string key(name);
    std::map<std::string, CUfunction>::iterator it = g_funcs.find(key);
    if (it != g_funcs.end()) return it->second;      // 캐시 적중
    CUfunction f = 0;
    if (cuModuleGetFunction(&f, g_module, name) != CUDA_SUCCESS) return 0;
    g_funcs[key] = f;                                // 캐시에 저장
    return f;
}

// launch : 런타임 API 의 커널<<<grid, block, shmem>>>(...) 를 드라이버 API 로 풀어 쓴 것.
//   ★ 인자 전달의 차이:
//     런타임 API 는 컴파일러가 인자를 자동 포장(마샬링)하지만,
//     드라이버 API 는 "각 인자의 주소"를 담은 void* 배열(args)을 직접 만들어 넘긴다.
//   grid/block 은 1차원(x)만 사용(뒤 두 개는 1). shmem 은 동적 공유 메모리 바이트 수.
//   0(스트림): 기본 스트림. 마지막 0(extra): 추가 옵션 없음.
static CUresult launch(CUfunction f, uint grid, uint block, uint shmem, void** args) {
    if (!f) return CUDA_ERROR_NOT_FOUND;
    return cuLaunchKernel(f, grid,1,1,  block,1,1,  shmem, 0, args, 0);
}

// pollStatus / SOFTWAIT : 커널 완료 대기.
//   커널 런치는 "비동기"라 cuLaunchKernel 은 곧바로 반환합니다. 결과를 CPU 로 복사하기
//   전에 완료를 기다려야 합니다. 여기서는 CPU를 100% 태우는 바쁜 대기 대신,
//   cuStreamQuery(0) 로 상태를 확인하며 1ms씩 자는 "슬립 폴링"을 씁니다.
//   제한 시간(기본 15초)을 넘기면 -1(타임아웃).
static int pollStatus(unsigned limit=15000) {
    unsigned t0 = getTimeMilliseconds();
    while (cuStreamQuery(0) == CUDA_ERROR_NOT_READY) {   // 아직 실행 중?
        if ((getTimeMilliseconds() - t0) > limit) return -1;
        usleep(1000);                                    // 1ms 쉬고 다시 확인
    }
    return 0;
}
// 대기 실패(타임아웃) 시 호출한 함수에서 즉시 타임아웃 센티넬을 반환하게 하는 매크로.
#define SOFTWAIT() if (pollStatus() != 0) { return MEMTEST_TIMEOUT; }

// ===================================================================
// 상수 쓰기/검증 — 위의 K/launch 를 이용해 커널 2개를 부른다.
// ===================================================================

// gpuWriteConstant : deviceWriteConstant 커널을 실행해 전 영역에 constant 를 쓴다.
//   args[] 에는 값이 아니라 "각 인자의 주소"가 들어간다(드라이버 API 규칙).
static void gpuWriteConstant(uint nBlocks, uint nThreads, CUdeviceptr base, uint N, uint constant) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&constant };
    launch(K("deviceWriteConstant"), nBlocks, nThreads, 0, args);   // 쓰기 커널엔 공유메모리 불필요(0)
}

// gpuVerifyConstant : deviceVerifyConstant 커널로 되읽어 검증하고, 총 오류 수를 돌려준다.
//   공유 메모리 크기 = sizeof(uint)*nThreads (스레드마다 오류 카운트 한 칸).
static uint gpuVerifyConstant(uint nBlocks, uint nThreads, CUdeviceptr base, uint N, uint constant,
                              CUdeviceptr blockErrorCount, uint* errorCounts) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&constant, (void*)&blockErrorCount };
    CU_CHECK_RET(launch(K("deviceVerifyConstant"), nBlocks, nThreads, sizeof(uint)*nThreads, args));
    SOFTWAIT();                                                       // 커널 끝날 때까지 대기
    // 블록별 오류 수(디바이스) → 호스트 버퍼로 복사한 뒤 CPU에서 최종 합산.
    CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

    uint totalErrors = 0;
    for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];
    return totalErrors;
}

// 대표 테스트: Moving Inversions (ones/zeros)
//   0xFFFFFFFF(전부 1)을 쓰고 검증 → 0x0(전부 0)을 쓰고 검증. 두 오류 수의 합을 반환.
//   중간에 실패(센티넬)면 그대로 전파.
static uint gpuMovingInversionsOnesZeros(uint nBlocks, uint nThreads, CUdeviceptr base, uint N,
                                         CUdeviceptr blockErrorCount, uint* errorCounts) {
    uint e, total = 0;
    gpuWriteConstant(nBlocks, nThreads, base, N, 0xFFFFFFFF);
    SOFTWAIT();
    e = gpuVerifyConstant(nBlocks, nThreads, base, N, 0xFFFFFFFF, blockErrorCount, errorCounts);
    if (e == MEMTEST_LAUNCH_FAILED || e == MEMTEST_TIMEOUT) return e;
    total += e;

    gpuWriteConstant(nBlocks, nThreads, base, N, 0x0);
    SOFTWAIT();
    e = gpuVerifyConstant(nBlocks, nThreads, base, N, 0x0, blockErrorCount, errorCounts);
    if (e == MEMTEST_LAUNCH_FAILED || e == MEMTEST_TIMEOUT) return e;
    total += e;
    return total;
}

// 드라이버 API 오류 코드를 사람이 읽는 문자열로.
static const char* cuErr(CUresult r) {
    const char* s = 0;
    cuGetErrorString(r, &s);
    return s ? s : "unknown";
}

static void print_usage(void) {
    printf("MemtestG80 (CUDA Driver API, study edition)\n");
    printf("Usage: memtestG80 [-g N] [MB] [iters]   (defaults: GPU 0, 128 MB, 50 iters)\n\n");
}

// ===================================================================
// main — 위 노트의 "밟는 순서" 그대로 진행
// ===================================================================
int main(int argc, const char** argv) {
    const uint nBlocks = 1024, nThreads = 512;   // 실행 구성: 블록 1024 × 스레드 512
    uint megsToTest = 128;                        // 기본 테스트 크기 (MB)
    uint maxIters   = 50;                         // 기본 반복 횟수
    int  gpuID      = 0;                          // 사용할 GPU 번호

    print_usage();

    // ---- (0) 인자 파싱 (표준 C++ 만으로; 서드파티 파서 없음) ----
    //   플래그: -g/--gpu N  ,  위치 인자: [MB] [iters] (플래그 아닌 것 순서대로 최대 2개)
    const char* positional[2] = { 0, 0 };
    int nPositional = 0;
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "-g" || arg == "--gpu") {
            if (i + 1 < argc) gpuID = atoi(argv[++i]);          // 다음 토큰을 GPU 번호로
            else { printf("Error: %s requires a GPU index argument\n", arg.c_str()); exit(2); }
        } else if (!arg.empty() && arg[0] == '-') {
            printf("Error: unknown flag '%s'\n", arg.c_str()); exit(2);
        } else if (nPositional < 2) {
            positional[nPositional++] = argv[i];                // 위치 인자 수집
        } else {
            printf("Error: too many arguments; expected [MB] [iters]\n"); exit(2);
        }
    }
    if (nPositional == 2) {
        sscanf(positional[0], "%u", &megsToTest);
        sscanf(positional[1], "%u", &maxIters);
    } else if (nPositional == 1) {
        printf("Error: Bad argument for [MB] [iters]\n");
    }

    // ---- (1) 드라이버 초기화 ----
    //   런타임 API 에선 자동이지만, 드라이버 API 는 맨 처음 cuInit 을 직접 불러야 한다.
    CUresult res = cuInit(0);
    if (res != CUDA_SUCCESS) { printf("Error: cuInit failed: %s\n", cuErr(res)); exit(2); }

    // ---- (2) GPU 선택 및 정보 조회 ----
    int devCount = 0;
    cuDeviceGetCount(&devCount);
    if (devCount == 0) { printf("Error: No CUDA-capable device detected.\n"); exit(2); }
    if (gpuID >= devCount) {
        printf("Error: invalid GPU index (%d); %d devices present.\n", gpuID, devCount);
        exit(2);
    }

    CUdevice cuDev;                                  // GPU 핸들
    res = cuDeviceGet(&cuDev, gpuID);
    if (res != CUDA_SUCCESS) { printf("Error: cuDeviceGet(%d): %s\n", gpuID, cuErr(res)); exit(2); }

    char devName[256] = {0};
    cuDeviceGetName(devName, sizeof(devName), cuDev);            // GPU 이름
    int ccMajor = 0, ccMinor = 0;
    // compute capability = GPU 세대. cubin 의 SMARCH 와 맞아야 로드가 성공한다(중요 단서).
    cuDeviceGetAttribute(&ccMajor, CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR, cuDev);
    cuDeviceGetAttribute(&ccMinor, CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MINOR, cuDev);

    // ---- (3) 컨텍스트 생성 ----
    //   컨텍스트 = 이 GPU 에서의 "작업 공간". 이후 메모리 할당·모듈·커널 실행이 모두
    //   이 컨텍스트에 소속된다. (런타임 API 는 첫 호출 때 자동 생성)
    CUcontext cuCtx;
    res = cuCtxCreate(&cuCtx, 0, cuDev);
    if (res != CUDA_SUCCESS) { printf("Error: cuCtxCreate: %s\n", cuErr(res)); exit(2); }

    // ---- (4) 커널 모듈(cubin) 로드 ----
    //   경로: 기본은 현재 디렉터리의 memtestG80.cubin. 환경변수로 덮어쓸 수 있다.
    //   cuModuleLoad 가 cubin 파일을 읽어 g_module 로 올린다. 이후 K() 가 여기서 커널을 찾음.
    //   실패의 가장 흔한 원인 = cubin 아키텍처(SMARCH)와 실제 GPU 불일치.
    const char* cubin = getenv("MEMTESTG80_CUBIN");
    if (!cubin || !*cubin) cubin = "memtestG80.cubin";
    if (cuModuleLoad(&g_module, cubin) != CUDA_SUCCESS) {
        printf("Error: failed to load kernel module '%s'.\n", cubin);
        printf("       cubin 은 GPU 아키텍처에 맞게 컴파일되어야 합니다 (Makefile 의 SMARCH 확인).\n");
        cuCtxDestroy(cuCtx);
        exit(2);
    }

    // ---- (5) 테스트용 GPU 메모리 할당 ----
    if (megsToTest % 2) megsToTest++;         // 2MiB 단위로 반올림(원본 관례)
    if (megsToTest == 0 || maxIters == 0) { printf("Error: invalid size/iters\n"); exit(2); }
    uint loopIters = megsToTest / 2;          // N = MB/2 = 스레드 하나가 담당하는 word 수

    CUdeviceptr devTestMem = 0;               // 시험 대상 전역 메모리 (여기에 쓰고 되읽음)
    CUdeviceptr devTempMem = 0;               // 블록별 오류 수를 담을 작은 버퍼(nBlocks개)
    // cuMemAlloc: 런타임 API 의 cudaMalloc 에 해당. CUdeviceptr 은 "디바이스 바이트 주소".
    if (cuMemAlloc(&devTestMem, ((size_t) megsToTest) * 1048576) != CUDA_SUCCESS) {
        printf("Error: unable to allocate %u MiB of GPU memory, bailing!\n", megsToTest);
        cuModuleUnload(g_module); cuCtxDestroy(cuCtx); exit(2);
    }
    cuMemAlloc(&devTempMem, sizeof(uint) * nBlocks);
    uint* hostTempMem = (uint*) malloc(sizeof(uint) * nBlocks);   // 위를 CPU로 복사해 합산할 버퍼

    printf("Running %u iterations over %u MB on GPU %d: %s (sm_%d%d)\n\n",
           maxIters, megsToTest, gpuID, devName, ccMajor, ccMinor);

    // ---- (6) 대표 테스트 반복 실행 ----
    uint accumulatedErrors = 0;
    for (uint i = 0; i < maxIters; i++) {
        unsigned start = getTimeMilliseconds();
        uint errorCount = gpuMovingInversionsOnesZeros(nBlocks, nThreads, devTestMem, loopIters,
                                                       devTempMem, hostTempMem);
        unsigned end = getTimeMilliseconds();
        if (errorCount == MEMTEST_LAUNCH_FAILED || errorCount == MEMTEST_TIMEOUT) {
            printf("Iteration %u: test failed (launch/timeout)\n", i+1);
            continue;
        }
        accumulatedErrors += errorCount;
        printf("Iteration %u: Moving Inversions (ones/zeros): %u errors (%u ms)\n",
               i+1, errorCount, end-start);
    }
    printf("\nFinal error count after %u iterations over %u MiB: %u errors\n",
           maxIters, megsToTest, accumulatedErrors);

    // ---- (7) 정리 — 얻은 자원을 역순으로 해제 ----
    cuMemFree(devTestMem);       // GPU 메모리 해제
    cuMemFree(devTempMem);
    free(hostTempMem);           // 호스트 메모리 해제
    cuModuleUnload(g_module);    // 모듈 언로드
    cuCtxDestroy(cuCtx);         // 컨텍스트 파괴
    return (accumulatedErrors != 0);   // 오류가 있었으면 0이 아닌 종료 코드
}
