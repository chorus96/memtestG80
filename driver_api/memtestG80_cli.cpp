/*
 * memtestG80_cli.cpp  (CUDA Driver API 판)
 * MemtestG80 명령행 프런트엔드 — 디바이스 열거·컨텍스트 생성·cubin 로딩까지
 * 전부 CUDA Driver API(cu*)로 수행합니다.
 *
 *   런타임 API 판(cli.cu)과의 차이:
 *     - cudaGetDeviceCount/Properties/SetDevice → cuInit / cuDeviceGetX / cuCtxCreate
 *     - 커널은 memtestG80_initKernels("memtestG80.cubin") 로 런타임 로드
 *   테스트 루프(13종)는 원본과 동일하게 memtestState 메서드를 호출합니다.
 *
 * 라이선스: LGPL v3 (원본과 동일)
 */
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <string>
#include <cuda.h>
#include "memtestG80_core.h"
#include "ezOptionParser.hpp"

static void print_usage(void) {
    printf("     -------------------------------------------------------------\n");
    printf("     |             MemtestG80 v1.00 (CUDA Driver API)            |\n");
    printf("     |                                                           |\n");
    printf("     | Usage: memtestG80 [flags] [MB GPU RAM to test] [# iters]  |\n");
    printf("     |                                                           |\n");
    printf("     | Defaults: GPU 0, 128MB RAM, 50 test iterations            |\n");
    printf("     | Amount of tested RAM will be rounded up to nearest 2MB    |\n");
    printf("     -------------------------------------------------------------\n\n");
    printf("      Available flags:\n");
    printf("        --gpu N ,-g N : run test on the Nth (from 0) CUDA GPU\n");
    printf("        --license ,-l : show license terms for this build\n");
    printf("\n");
}

static void print_licensing(void) {
    printf("Copyright 2009, Stanford University\n");
    printf("Licensed under the GNU Library General Public License (LGPL), version 3.0\n");
    printf("Please see the file COPYING in the source distribution for details\n\n");
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
    int  showLicense = 0;

    print_usage();

    ez::ezOptionParser opt;
    opt.add("0", 0, 1, 0, "run test on the Nth (from 0) CUDA GPU", "--gpu", "-g");
    opt.add("",  0, 0, 0, "show license terms for this build\n", "-l", "--license");
    opt.parse(argc, argv);

    if (opt.isSet("-g")) opt.get("-g")->getInt(gpuID);
    if (opt.isSet("-l")) showLicense = 1;
    if (opt.lastArgs.size() == 2) {
        sscanf(opt.lastArgs[0]->c_str(), "%u", &megsToTest);
        sscanf(opt.lastArgs[1]->c_str(), "%u", &maxIters);
    } else if (opt.lastArgs.size() != 0) {
        printf("Error: Bad argument for [MB GPU RAM to test] [# iters]\n");
    }
    if (showLicense) print_licensing();

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

    // ---- 대역폭 측정 ----
    const unsigned bw_iters = 20;
    printf("Running memory bandwidth test over %u iterations of %u MB transfers...\n", bw_iters, tester.size()/2);
    double bandwidth;
    if (!tester.gpuMemoryBandwidth(bandwidth, tester.size()/2, bw_iters)) {
        printf("\tTest failed!\n");
        bandwidth = 0;
    } else {
        printf("\tEstimated bandwidth %.02f MB/s\n\n", bandwidth);
    }

    uint accumulatedErrors = 0, iterErrors;
    uint errorCounts[15];
    memset(errorCounts, 0, 15*sizeof(uint));
    unsigned int start, end;

    for (uint i = 0; i < maxIters; i++) {
        printf("Test iteration %u (GPU %d, %d MiB): %u errors so far\n", i+1, gpuID, tester.size(), accumulatedErrors);
        uint errorCount;

        // Moving inversions, 1's and 0's
        errorCount = 0; start = getTimeMilliseconds();
        tester.gpuMovingInversionsOnesZeros(errorCount);
        accumulatedErrors += errorCount; end = getTimeMilliseconds();
        errorCounts[0] += errorCount;
        printf("\tMoving Inversions (ones and zeros): %u errors (%u ms)\n", errorCount, end-start);

        // Memtest86 walking 8-bit
        errorCount = 0; start = getTimeMilliseconds();
        for (uint shift = 0; shift < 8; shift++) { tester.gpuWalking8BitM86(iterErrors, shift); errorCount += iterErrors; }
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[1] += errorCount;
        printf("\tMemtest86 Walking 8-bit: %u errors (%u ms)\n", errorCount, end-start);

        // True Walking zeros, 8-bit
        errorCount = 0; start = getTimeMilliseconds();
        for (uint shift = 0; shift < 8; shift++) { tester.gpuWalking8Bit(iterErrors, false, shift); errorCount += iterErrors; }
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[2] += errorCount;
        printf("\tTrue Walking zeros (8-bit): %u errors (%u ms)\n", errorCount, end-start);

        // True Walking ones, 8-bit
        errorCount = 0; start = getTimeMilliseconds();
        for (uint shift = 0; shift < 8; shift++) { tester.gpuWalking8Bit(iterErrors, true, shift); errorCount += iterErrors; }
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[3] += errorCount;
        printf("\tTrue Walking ones (8-bit): %u errors (%u ms)\n", errorCount, end-start);

        // Moving inversions, random
        start = getTimeMilliseconds();
        tester.gpuMovingInversionsRandom(errorCount);
        accumulatedErrors += errorCount; end = getTimeMilliseconds(); errorCounts[4] += errorCount;
        printf("\tMoving Inversions (random): %u errors (%u ms)\n", errorCount, end-start);

        // Walking zeros, 32-bit
        errorCount = 0; start = getTimeMilliseconds();
        for (uint shift = 0; shift < 32; shift++) { tester.gpuWalking32Bit(iterErrors, false, shift); errorCount += iterErrors; }
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[5] += errorCount;
        printf("\tMemtest86 Walking zeros (32-bit): %u errors (%u ms)\n", errorCount, end-start);

        // Walking ones, 32-bit
        errorCount = 0; start = getTimeMilliseconds();
        for (uint shift = 0; shift < 32; shift++) { tester.gpuWalking32Bit(iterErrors, true, shift); errorCount += iterErrors; }
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[6] += errorCount;
        printf("\tMemtest86 Walking ones (32-bit): %u errors (%u ms)\n", errorCount, end-start);

        // Random blocks
        start = getTimeMilliseconds();
        tester.gpuRandomBlocks(errorCount, rand());
        accumulatedErrors += errorCount; errorCounts[7] += errorCount; end = getTimeMilliseconds();
        printf("\tRandom blocks: %u errors (%u ms)\n", errorCount, end-start);

        // Modulo-20, 32-bit
        errorCount = 0; start = getTimeMilliseconds();
        for (uint shift = 0; shift < 20; shift++) { tester.gpuModuloX(iterErrors, shift, rand(), 20, 2); errorCount += iterErrors; }
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[8] += errorCount;
        printf("\tMemtest86 Modulo-20: %u errors (%u ms)\n", errorCount, end-start);

        // Logic, 1 iteration
        errorCount = 0; start = getTimeMilliseconds();
        tester.gpuShortLCG0(errorCount, 1);
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[9] += errorCount;
        printf("\tLogic (one iteration): %u errors (%u ms)\n", errorCount, end-start);

        // Logic, 4 iterations
        errorCount = 0; start = getTimeMilliseconds();
        tester.gpuShortLCG0(errorCount, 4);
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[10] += errorCount;
        printf("\tLogic (4 iterations): %u errors (%u ms)\n", errorCount, end-start);

        // Logic, shared-memory, 1 iteration
        errorCount = 0; start = getTimeMilliseconds();
        tester.gpuShortLCG0Shmem(errorCount, 1);
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[11] += errorCount;
        printf("\tLogic (shared memory, one iteration): %u errors (%u ms)\n", errorCount, end-start);

        // Logic, shared-memory, 4 iterations
        errorCount = 0; start = getTimeMilliseconds();
        tester.gpuShortLCG0Shmem(errorCount, 4);
        end = getTimeMilliseconds(); accumulatedErrors += errorCount; errorCounts[12] += errorCount;
        printf("\tLogic (shared-memory, 4 iterations): %u errors (%u ms)\n", errorCount, end-start);

        printf("\n");
    }
    printf("Final error count after %u iterations over %u MiB of GPU memory: %u errors\n",
           maxIters, tester.size(), accumulatedErrors);

    // ---- 정리 ----
    tester.deallocate();
    memtestG80_unloadKernels();
    cuCtxDestroy(cuCtx);
    return (accumulatedErrors != 0);
}
