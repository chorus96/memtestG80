/*
 * memtestG80_cli.cpp  (CUDA Driver API 판 · 교육용 간결 버전 driver_api_study/)
 *
 * ★ 단일 파일 호스트 프로그램: 원래 memtestG80_core.{h,cpp} 로 나뉘어 있던
 *   모듈 로딩·커널 실행·메모리 할당을 이 파일 하나로 합쳤습니다.
 *   디바이스 커널만 memtestG80_kernels.cu → memtestG80.cubin 으로 분리되어,
 *   실행 중 CUDA Driver API 로 로드됩니다.
 *
 * 흐름: cuInit → cuCtxCreate → cuModuleLoad(cubin)
 *       → cuModuleGetFunction → cuLaunchKernel → 결과 cuMemcpyDtoH → 정리
 *
 * 빌드: g++ (호스트) + nvcc -cubin (커널). 링크는 드라이버 라이브러리 -lcuda.
 * 대상: Linux x86-64 · 단일 GPU
 * 라이선스: LGPL v3 (원본과 동일)
 */
#include <cstdlib>
#include <cstdio>
#include <string>
#include <map>
#include <cuda.h>
#include <sys/time.h>
#include <unistd.h>

typedef unsigned int uint;

// ---- 밀리초 타이머 (Linux) ----
static unsigned getTimeMilliseconds(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec*1000 + tv.tv_usec/1000;
}

// ---- 오류/타임아웃 센티넬 ----
#define MEMTEST_LAUNCH_FAILED 0xFFFFFFFFu   // 커널 런치/드라이버 호출 실패
#define MEMTEST_TIMEOUT       0xFFFFFFFEu   // 커널 타임아웃
#define CU_CHECK_RET(call) do { if ((call) != CUDA_SUCCESS) return MEMTEST_LAUNCH_FAILED; } while (0)

// ===================================================================
// 커널 모듈 관리 (cuModuleLoad 로 올린 cubin 에서 이름으로 CUfunction 조회)
// ===================================================================
static CUmodule g_module = 0;
static std::map<std::string, CUfunction> g_funcs;

// cubin 에서 커널을 이름으로 찾아 캐시
static CUfunction K(const char* name) {
    std::string key(name);
    std::map<std::string, CUfunction>::iterator it = g_funcs.find(key);
    if (it != g_funcs.end()) return it->second;
    CUfunction f = 0;
    if (cuModuleGetFunction(&f, g_module, name) != CUDA_SUCCESS) return 0;
    g_funcs[key] = f;
    return f;
}

// 1D grid/block + 동적 공유 메모리(shmem 바이트) + 기본 스트림(0) 으로 커널 실행
static CUresult launch(CUfunction f, uint grid, uint block, uint shmem, void** args) {
    if (!f) return CUDA_ERROR_NOT_FOUND;
    return cuLaunchKernel(f, grid,1,1,  block,1,1,  shmem, 0, args, 0);
}

// 커널 완료를 슬립 폴링으로 대기 (기본 스트림 0)
static int pollStatus(unsigned limit=15000) {
    unsigned t0 = getTimeMilliseconds();
    while (cuStreamQuery(0) == CUDA_ERROR_NOT_READY) {
        if ((getTimeMilliseconds() - t0) > limit) return -1;
        usleep(1000);
    }
    return 0;
}
#define SOFTWAIT() if (pollStatus() != 0) { return MEMTEST_TIMEOUT; }

// ===================================================================
// 상수 쓰기/검증 (커널 2개를 호출)
// ===================================================================
static void gpuWriteConstant(uint nBlocks, uint nThreads, CUdeviceptr base, uint N, uint constant) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&constant };
    launch(K("deviceWriteConstant"), nBlocks, nThreads, 0, args);
}

static uint gpuVerifyConstant(uint nBlocks, uint nThreads, CUdeviceptr base, uint N, uint constant,
                              CUdeviceptr blockErrorCount, uint* errorCounts) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&constant, (void*)&blockErrorCount };
    CU_CHECK_RET(launch(K("deviceVerifyConstant"), nBlocks, nThreads, sizeof(uint)*nThreads, args));
    SOFTWAIT();
    CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

    uint totalErrors = 0;
    for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];
    return totalErrors;
}

// 대표 테스트: Moving Inversions (ones/zeros) — 0xFFFFFFFF 와 0x0 을 쓰고 검증
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

// 드라이버 API 오류를 문자열로
static const char* cuErr(CUresult r) {
    const char* s = 0;
    cuGetErrorString(r, &s);
    return s ? s : "unknown";
}

static void print_usage(void) {
    printf("MemtestG80 (CUDA Driver API, study edition)\n");
    printf("Usage: memtestG80 [-g N] [MB] [iters]   (defaults: GPU 0, 128 MB, 50 iters)\n\n");
}

int main(int argc, const char** argv) {
    const uint nBlocks = 1024, nThreads = 512;
    uint megsToTest = 128;
    uint maxIters   = 50;
    int  gpuID      = 0;

    print_usage();

    // ---- 인자 파싱 (표준 C++ 만으로) ----
    //   플래그: -g/--gpu N
    //   위치 인자: [MB] [iters]  (플래그가 아닌 순서대로 최대 2개)
    const char* positional[2] = { 0, 0 };
    int nPositional = 0;
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "-g" || arg == "--gpu") {
            if (i + 1 < argc) gpuID = atoi(argv[++i]);
            else { printf("Error: %s requires a GPU index argument\n", arg.c_str()); exit(2); }
        } else if (!arg.empty() && arg[0] == '-') {
            printf("Error: unknown flag '%s'\n", arg.c_str()); exit(2);
        } else if (nPositional < 2) {
            positional[nPositional++] = argv[i];
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

    // ---- Driver API 초기화 ----
    CUresult res = cuInit(0);
    if (res != CUDA_SUCCESS) { printf("Error: cuInit failed: %s\n", cuErr(res)); exit(2); }

    int devCount = 0;
    cuDeviceGetCount(&devCount);
    if (devCount == 0) { printf("Error: No CUDA-capable device detected.\n"); exit(2); }
    if (gpuID >= devCount) {
        printf("Error: invalid GPU index (%d); %d devices present.\n", gpuID, devCount);
        exit(2);
    }

    CUdevice cuDev;
    res = cuDeviceGet(&cuDev, gpuID);
    if (res != CUDA_SUCCESS) { printf("Error: cuDeviceGet(%d): %s\n", gpuID, cuErr(res)); exit(2); }

    char devName[256] = {0};
    cuDeviceGetName(devName, sizeof(devName), cuDev);
    int ccMajor = 0, ccMinor = 0;
    cuDeviceGetAttribute(&ccMajor, CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR, cuDev);
    cuDeviceGetAttribute(&ccMinor, CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MINOR, cuDev);

    // ---- 컨텍스트 생성 (이후 모든 cu* 호출의 대상) ----
    CUcontext cuCtx;
    res = cuCtxCreate(&cuCtx, 0, cuDev);
    if (res != CUDA_SUCCESS) { printf("Error: cuCtxCreate: %s\n", cuErr(res)); exit(2); }

    // ---- 커널 모듈(cubin) 로드 ----
    //   기본은 현재 디렉터리의 memtestG80.cubin. 환경변수로 경로를 덮어쓸 수 있음.
    const char* cubin = getenv("MEMTESTG80_CUBIN");
    if (!cubin || !*cubin) cubin = "memtestG80.cubin";
    if (cuModuleLoad(&g_module, cubin) != CUDA_SUCCESS) {
        printf("Error: failed to load kernel module '%s'.\n", cubin);
        printf("       cubin 은 GPU 아키텍처에 맞게 컴파일되어야 합니다 (Makefile 의 SMARCH 확인).\n");
        cuCtxDestroy(cuCtx);
        exit(2);
    }

    // ---- 테스트 메모리 할당 ----
    if (megsToTest % 2) megsToTest++;         // 2MiB 단위로 반올림
    if (megsToTest == 0 || maxIters == 0) { printf("Error: invalid size/iters\n"); exit(2); }
    uint loopIters = megsToTest / 2;          // N = MB/2 (스레드당 word 수)

    CUdeviceptr devTestMem = 0, devTempMem = 0;
    if (cuMemAlloc(&devTestMem, ((size_t) megsToTest) * 1048576) != CUDA_SUCCESS) {
        printf("Error: unable to allocate %u MiB of GPU memory, bailing!\n", megsToTest);
        cuModuleUnload(g_module); cuCtxDestroy(cuCtx); exit(2);
    }
    cuMemAlloc(&devTempMem, sizeof(uint) * nBlocks);   // 블록별 오류 수
    uint* hostTempMem = (uint*) malloc(sizeof(uint) * nBlocks);

    printf("Running %u iterations over %u MB on GPU %d: %s (sm_%d%d)\n\n",
           maxIters, megsToTest, gpuID, devName, ccMajor, ccMinor);

    // ---- 대표 테스트 반복 ----
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

    // ---- 정리 ----
    cuMemFree(devTestMem);
    cuMemFree(devTempMem);
    free(hostTempMem);
    cuModuleUnload(g_module);
    cuCtxDestroy(cuCtx);
    return (accumulatedErrors != 0);
}
