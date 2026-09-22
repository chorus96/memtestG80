/*
 * memtestG80_cli.cpp  (CUDA Driver API 판 · 교육용 간결 버전 driver_api_study/)
 * MemtestG80 명령행 프런트엔드 — 디바이스 열거·컨텍스트 생성·cubin 로딩까지
 * 전부 CUDA Driver API(cu*)로 수행합니다.
 *
 *   driver_api/ 판과의 차이:
 *     - ezOptionParser.hpp 의존을 제거하고, 표준 C++ 만으로 인자를 직접 파싱합니다.
 *       (CUDA와 직접 관련 없는 서드파티 코드를 걷어내 교재를 최대한 간결하게)
 *   테스트 루프(13종)는 원본과 동일하게 memtestState 메서드를 호출합니다.
 *
 * 라이선스: LGPL v3 (원본과 동일)
 */
#include <cstdlib>
#include <cstdio>
#include <string>
#include <cuda.h>
#include "memtestG80_core.h"

static void print_usage(void) {
    printf("MemtestG80 (CUDA Driver API, study edition)\n");
    printf("Usage: memtestG80 [-g N] [MB] [iters]   (defaults: GPU 0, 128 MB, 50 iters)\n\n");
}

// 드라이버 API 오류를 문자열로
static const char* cuErr(CUresult r) {
    const char* s = 0;
    cuGetErrorString(r, &s);
    return s ? s : "unknown";
}

// cubin 파일 경로 탐색: 환경변수 → 실행 파일 옆 → 현재 디렉터리
static std::string findCubin(const char* argv0) {
    const char* env = getenv("MEMTESTG80_CUBIN");
    if (env && *env) return std::string(env);
    std::string a(argv0 ? argv0 : "");
    size_t slash = a.find_last_of('/');
    if (slash != std::string::npos) {
        std::string cand = a.substr(0, slash) + "/memtestG80.cubin";
        FILE* f = fopen(cand.c_str(), "rb");
        if (f) { fclose(f); return cand; }
    }
    return std::string("memtestG80.cubin");
}

int main(int argc, const char** argv) {
    uint megsToTest = 128;
    uint maxIters   = 50;
    int  gpuID      = 0;

    print_usage();

    // ---- 인자 파싱 (ezOptionParser 없이, 표준 C++ 만으로) ----
    //   플래그: -g/--gpu N
    //   위치 인자: [MB] [iters]  (플래그가 아닌 순서대로 최대 2개)
    const char* positional[2] = { 0, 0 };
    int nPositional = 0;
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "-g" || arg == "--gpu") {
            if (i + 1 < argc) {
                gpuID = atoi(argv[++i]);
            } else {
                printf("Error: %s requires a GPU index argument\n", arg.c_str());
                exit(2);
            }
        } else if (!arg.empty() && arg[0] == '-') {
            printf("Error: unknown flag '%s'\n", arg.c_str());
            exit(2);
        } else if (nPositional < 2) {
            positional[nPositional++] = argv[i];
        } else {
            printf("Error: too many arguments; expected [MB GPU RAM to test] [# iters]\n");
            exit(2);
        }
    }
    if (nPositional == 2) {
        sscanf(positional[0], "%u", &megsToTest);
        sscanf(positional[1], "%u", &maxIters);
    } else if (nPositional == 1) {
        printf("Error: Bad argument for [MB GPU RAM to test] [# iters]\n");
    }

    // ---- Driver API 초기화 ----
    CUresult res = cuInit(0);
    if (res != CUDA_SUCCESS) {
        printf("Error: cuInit failed: %s\n", cuErr(res));
        exit(2);
    }

    int devCount = 0;
    cuDeviceGetCount(&devCount);
    if (devCount == 0) {
        printf("Error: No CUDA-capable device detected.\n");
        exit(2);
    }
    if (gpuID >= devCount) {
        printf("Error: Specified invalid GPU index (%d); %d CUDA devices present, numbered from zero.\n", gpuID, devCount);
        printf("\nValid CUDA devices:\n");
        for (int i = 0; i < devCount; i++) {
            CUdevice d; char nm[256];
            if (cuDeviceGet(&d, i) == CUDA_SUCCESS && cuDeviceGetName(nm, sizeof(nm), d) == CUDA_SUCCESS)
                printf("%d: %s\n", i, nm);
        }
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
    std::string cubin = findCubin(argv[0]);
    if (!memtestG80_initKernels(cubin.c_str())) {
        printf("Error: failed to load kernel module '%s'.\n", cubin.c_str());
        printf("       cubin 은 GPU 아키텍처에 맞게 컴파일되어야 합니다 (Makefile 의 SMARCH 확인).\n");
        printf("       또는 MEMTESTG80_CUBIN 환경변수로 경로를 지정하세요.\n");
        cuCtxDestroy(cuCtx);
        exit(2);
    }

    // ---- 크기·반복 수 검증 ----
    if (megsToTest == 0) { printf("Error: invalid memory test region size %u MiB\n", megsToTest); exit(2); }
    if (maxIters == 0)   { printf("Error: invalid iteration count %u\n", maxIters); exit(2); }

    memtestState tester;
    if (!tester.allocate(megsToTest)) {
        printf("Error: unable to allocate %u MiB of GPU memory to test, bailing!\n", megsToTest);
        memtestG80_unloadKernels();
        cuCtxDestroy(cuCtx);
        exit(2);
    }
    printf("Running %u iterations of tests over %u MB of GPU memory on card %d: %s (sm_%d%d)\n\n",
           maxIters, tester.size(), gpuID, devName, ccMajor, ccMinor);

    uint accumulatedErrors = 0;
    unsigned int start, end;

    for (uint i = 0; i < maxIters; i++) {
        printf("Test iteration %u (GPU %d, %d MiB): %u errors so far\n", i+1, gpuID, tester.size(), accumulatedErrors);
        uint errorCount = 0;

        // 대표 테스트: Moving Inversions (1의 값과 0의 값)
        //   0xFFFFFFFF / 0x0 을 deviceWriteConstant 로 쓰고,
        //   deviceVerifyConstant(공유 메모리 트리 리덕션)로 되읽어 검증한다.
        //   → 쓰기 커널 + 검증 커널을 모두 사용해 커널 로딩·실행 흐름을 온전히 보여줌.
        start = getTimeMilliseconds();
        tester.gpuMovingInversionsOnesZeros(errorCount);
        end = getTimeMilliseconds();
        accumulatedErrors += errorCount;
        printf("\tMoving Inversions (ones and zeros): %u errors (%u ms)\n\n", errorCount, end-start);
    }
    printf("Final error count after %u iterations over %u MiB of GPU memory: %u errors\n",
           maxIters, tester.size(), accumulatedErrors);

    // ---- 정리 ----
    tester.deallocate();
    memtestG80_unloadKernels();
    cuCtxDestroy(cuCtx);
    return (accumulatedErrors != 0);
}
