/*
 * memtestG80_core.cpp  (CUDA Driver API 판 · 교육용 간결 버전 driver_api_study/)
 * MemtestG80 코어의 호스트 구현 — 전적으로 CUDA Driver API(cu*)를 사용합니다.
 *   - 커널은 memtestG80.cubin 에서 cuModuleLoad/cuModuleGetFunction 으로 로드
 *   - 실행은 <<<>>> 가 아니라 cuLaunchKernel
 *   - 메모리는 cuMemAlloc/cuMemFree/cuMemcpyDtoH
 * 호스트 전용(디바이스 코드 없음)이므로 일반 C++ 컴파일러(g++)로 컴파일하고
 * 드라이버 라이브러리(-lcuda)와 링크합니다.
 *
 * ★ 교육용 축소판: 대표 테스트(Moving Inversions, ones/zeros)가 쓰는 것만 남겼습니다.
 *
 * 라이선스: LGPL v3 (원본과 동일)
 */
#include "memtestG80_core.h"
#include <cstdlib>   // malloc, free
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
// 상수 쓰기/검증 (저수준 __host__)
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
// Memtest86 Test 2: Moving Inversions (ones/zeros) — 대표 테스트
//   0xFFFFFFFF 를 쓰고 검증, 0x0 을 쓰고 검증.
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

// 센티넬(런치 실패/타임아웃)을 걸러 성공/실패 bool 로 변환하는 공통 판정
#define OK(x) ((x) != MEMTEST_LAUNCH_FAILED && (x) != MEMTEST_TIMEOUT)

bool memtestState::gpuMovingInversionsOnesZeros(uint& errorCount) const {
    if (!allocated) return false;
    errorCount = ::gpuMovingInversionsOnesZeros(nBlocks, nThreads, devTestMem, loopIters, devTempMem, hostTempMem);
    return OK(errorCount);
}
