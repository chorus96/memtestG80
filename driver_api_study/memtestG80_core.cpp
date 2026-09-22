/*
 * memtestG80_core.cpp  (CUDA Driver API 판)
 * MemtestG80 코어의 호스트 구현 — 전적으로 CUDA Driver API(cu*)를 사용합니다.
 *   - 커널은 memtestG80.cubin 에서 cuModuleLoad/cuModuleGetFunction 으로 로드
 *   - 실행은 <<<>>> 가 아니라 cuLaunchKernel
 *   - 메모리는 cuMemAlloc/cuMemFree/cuMemcpyDtoH/cuMemcpyDtoD
 * 호스트 전용(디바이스 코드 없음)이므로 일반 C++ 컴파일러(g++)로 컴파일하고
 * 드라이버 라이브러리(-lcuda)와 링크합니다.
 *
 * 라이선스: LGPL v3 (원본과 동일)
 */
#include "memtestG80_core.h"
#include <cstdlib>   // malloc, free, rand
#include <cstring>
#include <map>
#include <string>

// ===================================================================
// 커널 모듈 관리
// ===================================================================
static CUmodule g_module = 0;
static std::map<std::string, CUfunction> g_funcs;

bool memtestG80_initKernels(const char* cubinPath) {
    if (cuModuleLoad(&g_module, cubinPath) != CUDA_SUCCESS) {
        g_module = 0;
        return false;
    }
    return true;
}

void memtestG80_unloadKernels() {
    if (g_module) {
        cuModuleUnload(g_module);
        g_module = 0;
        g_funcs.clear();
    }
}

// cubin에서 커널을 이름으로 찾아 캐시 (cuModuleGetFunction)
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
    return cuLaunchKernel(f,
                          grid, 1, 1,     // gridDim.{x,y,z}
                          block, 1, 1,    // blockDim.{x,y,z}
                          shmem,          // 동적 공유 메모리 바이트 수
                          0,              // 스트림 (기본)
                          args,           // 커널 인자 포인터 배열
                          0);             // extra
}

// ===================================================================
// 대역폭 측정 (device-to-device 복사)
// ===================================================================
double gpuMemoryBandwidth(CUdeviceptr src, CUdeviceptr dst, uint mbToTest, uint iters) {
    uint start = getTimeMilliseconds();
    for (uint i = 0; i < iters; i++) {
        cuMemcpyDtoD(dst, src, ((size_t) mbToTest) * 1048576);
    }
    // D2D 복사는 비동기 → 정확한 타이밍을 위해 반드시 동기화
    cuCtxSynchronize();
    uint end = getTimeMilliseconds();
    // 읽기 + 쓰기 → ×2
    double bw = 2.0 * ((double) mbToTest * iters) / ((end - start) / 1000.0);
    return bw;
}

// ===================================================================
// 상수 쓰기/검증
// ===================================================================
void gpuWriteConstant(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint constant) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&constant };
    launch(K("deviceWriteConstant"), nBlocks, nThreads, 0, args);
}

uint gpuVerifyConstant(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint constant, CUdeviceptr blockErrorCount, uint* errorCounts) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&constant, (void*)&blockErrorCount };
    CU_CHECK_RET(launch(K("deviceVerifyConstant"), nBlocks, nThreads, sizeof(uint)*nThreads, args));
    SOFTWAIT();
    CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

    uint totalErrors = 0;
    for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];
    return totalErrors;
}

// ===================================================================
// 로직 테스트 (LCG)
// ===================================================================
uint gpuShortLCG0(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint repeats, const int period, CUdeviceptr blockErrorCounts, uint* errorCounts) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&repeats, (void*)&period };
    CU_CHECK_RET(launch(K("deviceShortLCG0"), nBlocks, nThreads, 0, args));
    SOFTWAIT();
    return gpuVerifyConstant(nBlocks, nThreads, base, N, 0, blockErrorCounts, errorCounts);
}

uint gpuShortLCG0Shmem(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint repeats, const int period, CUdeviceptr blockErrorCounts, uint* errorCounts) {
    void* args[] = { (void*)&base, (void*)&N, (void*)&repeats, (void*)&period };
    CU_CHECK_RET(launch(K("deviceShortLCG0Shmem"), nBlocks, nThreads, sizeof(uint)*nThreads, args));
    SOFTWAIT();
    return gpuVerifyConstant(nBlocks, nThreads, base, N, 0, blockErrorCounts, errorCounts);
}

// ===================================================================
// Memtest86 Test 2: Moving Inversions (ones/zeros)
// ===================================================================
uint gpuMovingInversionsOnesZeros(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, CUdeviceptr blockErrorCounts, uint* errorCounts) {
    uint errorCount;
    gpuWriteConstant(nBlocks, nThreads, base, N, 0xFFFFFFFF);
    SOFTWAIT();
    errorCount = gpuVerifyConstant(nBlocks, nThreads, base, N, 0xFFFFFFFF, blockErrorCounts, errorCounts);

    gpuWriteConstant(nBlocks, nThreads, base, N, 0x0);
    SOFTWAIT();
    errorCount += gpuVerifyConstant(nBlocks, nThreads, base, N, 0x0, blockErrorCounts, errorCounts);
    return errorCount;
}

// ===================================================================
// Memtest86 Test 3: Walking 8-bit (M86 변형)
// ===================================================================
uint gpuWalking8BitM86(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, uint shift, CUdeviceptr blockErrorCounts, uint* errorCounts) {
    shift &= 0x7;
    uint pattern = 1 << shift;
    pattern = pattern | (pattern << 8) | (pattern << 16) | (pattern << 24);

    uint errorCount;
    gpuWriteConstant(nBlocks, nThreads, base, N, pattern);
    SOFTWAIT();
    errorCount = gpuVerifyConstant(nBlocks, nThreads, base, N, pattern, blockErrorCounts, errorCounts);

    pattern = ~pattern;
    gpuWriteConstant(nBlocks, nThreads, base, N, pattern);
    SOFTWAIT();
    errorCount += gpuVerifyConstant(nBlocks, nThreads, base, N, pattern, blockErrorCounts, errorCounts);
    return errorCount;
}

// ===================================================================
// 참 워킹 8-bit (페어 상수)
// ===================================================================
uint gpuWalking8Bit(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, bool ones, uint shift, CUdeviceptr blockErrorCount, uint* errorCounts) {
    uint patterns[2] = {0x0, 0x0};
    shift &= 0x7;
    uint bits = 0x1 << shift;
    for (uint i = 0; i < 4; i++) {
        patterns[0] = (patterns[0] << 8) | bits;
        bits = (bits == 0x80) ? 0x01 : bits << 1;
    }
    for (uint i = 0; i < 4; i++) {
        patterns[1] = (patterns[1] << 8) | bits;
        bits = (bits == 0x80) ? 0x01 : bits << 1;
    }
    if (!ones) { patterns[0] = ~patterns[0]; patterns[1] = ~patterns[1]; }

    void* wargs[] = { (void*)&base, (void*)&N, (void*)&patterns[0], (void*)&patterns[1] };
    CU_CHECK_RET(launch(K("deviceWritePairedConstants"), nBlocks, nThreads, 0, wargs));
    SOFTWAIT();

    void* vargs[] = { (void*)&base, (void*)&N, (void*)&patterns[0], (void*)&patterns[1], (void*)&blockErrorCount };
    CU_CHECK_RET(launch(K("deviceVerifyPairedConstants"), nBlocks, nThreads, sizeof(uint)*nThreads, vargs));
    SOFTWAIT();
    CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

    uint totalErrors = 0;
    for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];
    return totalErrors;
}

// ===================================================================
// Memtest86 Test 4: Moving Inversions (random)
// ===================================================================
uint gpuMovingInversionsRandom(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, CUdeviceptr blockErrorCounts, uint* errorCounts) {
    uint errorCount;
    uint pattern = (uint) rand();
    gpuWriteConstant(nBlocks, nThreads, base, N, pattern);
    SOFTWAIT();
    errorCount = gpuVerifyConstant(nBlocks, nThreads, base, N, pattern, blockErrorCounts, errorCounts);

    pattern = ~pattern;
    gpuWriteConstant(nBlocks, nThreads, base, N, pattern);
    SOFTWAIT();
    errorCount += gpuVerifyConstant(nBlocks, nThreads, base, N, pattern, blockErrorCounts, errorCounts);
    return errorCount;
}

// ===================================================================
// Memtest86 Test 6: Walking 32-bit
// ===================================================================
uint gpuWalking32Bit(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, bool ones, uint shift, CUdeviceptr blockErrorCount, uint* errorCounts) {
    void* wargs[] = { (void*)&base, (void*)&N, (void*)&ones, (void*)&shift };
    CU_CHECK_RET(launch(K("deviceWriteWalking32Bit"), nBlocks, nThreads, 0, wargs));
    SOFTWAIT();

    void* vargs[] = { (void*)&base, (void*)&N, (void*)&ones, (void*)&shift, (void*)&blockErrorCount };
    CU_CHECK_RET(launch(K("deviceVerifyWalking32Bit"), nBlocks, nThreads, sizeof(uint)*nThreads, vargs));
    SOFTWAIT();
    CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

    uint totalErrors = 0;
    for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];
    return totalErrors;
}

// ===================================================================
// Memtest86 Test 7: Random Blocks
// ===================================================================
uint gpuRandomBlocks(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, uint seed, CUdeviceptr blockErrorCount, uint* errorCounts) {
    void* wargs[] = { (void*)&base, (void*)&N, (void*)&seed };  // 커널의 int seed 와 4바이트 동일
    CU_CHECK_RET(launch(K("deviceWriteRandomBlocks"), nBlocks, nThreads, 4*nThreads, wargs));
    SOFTWAIT();

    void* vargs[] = { (void*)&base, (void*)&N, (void*)&seed, (void*)&blockErrorCount };
    CU_CHECK_RET(launch(K("deviceVerifyRandomBlocks"), nBlocks, nThreads, 12*nThreads, vargs));
    SOFTWAIT();
    CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

    uint totalErrors = 0;
    for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];
    return totalErrors;
}

// ===================================================================
// Memtest86 Test 8: Modulo-X (M86 는 modulus=20)
// ===================================================================
uint gpuModuloX(const uint nBlocks, const uint nThreads, CUdeviceptr base, const uint N, uint shift, uint pattern1, const uint modulus, const uint iters, CUdeviceptr blockErrorCount, uint* errorCounts) {
    uint totalErrors = 0;
    shift %= modulus;

    // 주어진 패턴과 그 보수, 두 번 반복
    for (uint i = 0; i < 2; i++, pattern1 = ~pattern1) {
        uint pattern2 = ~pattern1;  // cuLaunchKernel 인자는 주소가 필요하므로 lvalue 로
        void* wargs[] = { (void*)&base, (void*)&N, (void*)&shift, (void*)&pattern1, (void*)&pattern2, (void*)&modulus, (void*)&iters };
        CU_CHECK_RET(launch(K("deviceWritePairedModulo"), nBlocks, nThreads, 0, wargs));
        SOFTWAIT();

        void* vargs[] = { (void*)&base, (void*)&N, (void*)&shift, (void*)&pattern1, (void*)&modulus, (void*)&blockErrorCount };
        CU_CHECK_RET(launch(K("deviceVerifyPairedModulo"), nBlocks, nThreads, sizeof(uint)*nThreads, vargs));
        SOFTWAIT();
        CU_CHECK_RET(cuMemcpyDtoH(errorCounts, blockErrorCount, sizeof(uint)*nBlocks));

        for (uint j = 0; j < nBlocks; j++) totalErrors += errorCounts[j];
    }
    return totalErrors;
}

// ===================================================================
// memtestState — OO 인터페이스
// ===================================================================
uint memtestState::allocate(uint mbToTest) {
    deallocate();
    initTime = getTimeMilliseconds();

    if (mbToTest % 2) mbToTest++;   // 2MiB 단위로 반올림
    megsToTest = mbToTest;
    loopIters = megsToTest / 2;     // N = MB/2
    if (megsToTest == 0) return 0;

    if (cuMemAlloc(&devTestMem, ((size_t) megsToTest) * 1048576) != CUDA_SUCCESS) {
        devTestMem = 0;
        return 0;
    }
    if (cuMemAlloc(&devTempMem, sizeof(uint) * nBlocks) != CUDA_SUCCESS) {
        cuMemFree(devTestMem);
        devTestMem = 0;
        return 0;
    }
    hostTempMem = (uint*) malloc(sizeof(uint) * nBlocks);
    if (hostTempMem == NULL) {
        cuMemFree(devTestMem);
        cuMemFree(devTempMem);
        devTestMem = 0; devTempMem = 0;
        return 0;
    }
    allocated = true;
    return megsToTest;
}

void memtestState::deallocate() {
    if (allocated) {
        cuMemFree(devTestMem);
        cuMemFree(devTempMem);
        free(hostTempMem);
        devTestMem = 0;
        devTempMem = 0;
        hostTempMem = NULL;
        allocated = false;
    }
    initTime = 0;
}

bool memtestState::gpuMemoryBandwidth(double& bandwidth, uint mbToTest, uint iters) {
    if (!allocated || megsToTest < 2*mbToTest) return false;
    // CUdeviceptr 은 바이트 주소 → dst = base + mbToTest MiB
    CUdeviceptr dst = devTestMem + (CUdeviceptr) mbToTest * 1048576;
    bandwidth = ::gpuMemoryBandwidth(devTestMem, dst, mbToTest, iters);
    return true;
}

bool memtestState::gpuWriteConstant(const uint constant) const {
    if (!allocated) return false;
    ::gpuWriteConstant(nBlocks, nThreads, devTestMem, loopIters, constant);
    return true;
}

// 센티넬(런치 실패/타임아웃)을 걸러 성공/실패 bool 로 변환하는 공통 판정
#define OK(x) ((x) != MEMTEST_LAUNCH_FAILED && (x) != MEMTEST_TIMEOUT)

bool memtestState::gpuVerifyConstant(uint& errorCount, const uint constant) const {
    if (!allocated) return false;
    errorCount = ::gpuVerifyConstant(nBlocks, nThreads, devTestMem, loopIters, constant, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuShortLCG0(uint& errorCount, const uint repeats) const {
    if (!allocated) return false;
    errorCount = ::gpuShortLCG0(nBlocks, nThreads, devTestMem, loopIters, repeats, lcgPeriod, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuShortLCG0Shmem(uint& errorCount, const uint repeats) const {
    if (!allocated) return false;
    errorCount = ::gpuShortLCG0Shmem(nBlocks, nThreads, devTestMem, loopIters, repeats, lcgPeriod, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuMovingInversionsOnesZeros(uint& errorCount) const {
    if (!allocated) return false;
    errorCount = ::gpuMovingInversionsOnesZeros(nBlocks, nThreads, devTestMem, loopIters, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuWalking8BitM86(uint& errorCount, const uint shift) const {
    if (!allocated) return false;
    errorCount = ::gpuWalking8BitM86(nBlocks, nThreads, devTestMem, loopIters, shift, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuWalking8Bit(uint& errorCount, const bool ones, const uint shift) const {
    if (!allocated) return false;
    errorCount = ::gpuWalking8Bit(nBlocks, nThreads, devTestMem, loopIters, ones, shift, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuMovingInversionsRandom(uint& errorCount) const {
    if (!allocated) return false;
    errorCount = ::gpuMovingInversionsRandom(nBlocks, nThreads, devTestMem, loopIters, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuWalking32Bit(uint& errorCount, const bool ones, const uint shift) const {
    if (!allocated) return false;
    errorCount = ::gpuWalking32Bit(nBlocks, nThreads, devTestMem, loopIters, ones, shift, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuRandomBlocks(uint& errorCount, const uint seed) const {
    if (!allocated) return false;
    errorCount = ::gpuRandomBlocks(nBlocks, nThreads, devTestMem, loopIters, seed, devTempMem, hostTempMem);
    return OK(errorCount);
}

bool memtestState::gpuModuloX(uint& errorCount, const uint shift, const uint pattern, const uint modulus, const uint overwriteIters) const {
    if (!allocated) return false;
    errorCount = ::gpuModuloX(nBlocks, nThreads, devTestMem, loopIters, shift, pattern, modulus, overwriteIters, devTempMem, hostTempMem);
    return OK(errorCount);
}
