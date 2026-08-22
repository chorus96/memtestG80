/*
 * memtestG80_core.h  (CUDA Driver API 판)
 * MemtestG80 코어의 공개 API — 호스트 측은 전적으로 CUDA Driver API(cu*)를 사용하고,
 * 커널은 별도 cubin(memtestG80_kernels.cu → memtestG80.cubin)에서 런타임에 로드합니다.
 *
 * 원본(런타임 API 판) 대비 차이:
 *   - devTestMem/devTempMem 타입이 uint* → CUdeviceptr
 *   - SOFTWAIT 가 cudaStreamQuery → cuStreamQuery(0)
 *   - 커널 실행은 <<<>>> 가 아니라 cuLaunchKernel (구현부 .cpp 참조)
 *   - 리눅스 x64 전용
 *
 * 라이선스: LGPL v3 (원본과 동일)
 */
#ifndef _MEMTESTG80_CORE_DRIVER_H_
#define _MEMTESTG80_CORE_DRIVER_H_

#include <cuda.h>       // CUDA Driver API (cu*), CUdeviceptr, CUfunction, CUmodule ...
#include <sys/time.h>
#include <unistd.h>

typedef unsigned int uint;

// ---- 밀리초 타이머 / 슬립 (Linux) ----
inline unsigned int getTimeMilliseconds(void) {
    struct timeval tv;
    gettimeofday(&tv,NULL);
    return tv.tv_sec*1000 + tv.tv_usec/1000;
}
#define SLEEPMS(x) usleep((x)*1000)

// ---- 오류/타임아웃 센티넬 (원본과 동일한 관례) ----
#define MEMTEST_LAUNCH_FAILED 0xFFFFFFFF   // 커널 런치/드라이버 호출 실패
#define MEMTEST_TIMEOUT       0xFFFFFFFE   // 커널 타임아웃

// 드라이버 호출 결과 검사: 실패 시 런치 실패 센티넬 반환
#define CU_CHECK_RET(call) do { if ((call) != CUDA_SUCCESS) return MEMTEST_LAUNCH_FAILED; } while (0)

// 커널 완료를 슬립 폴링으로 대기 (드라이버 API 기본 스트림 0 = 레거시 스트림)
inline int _pollStatus(unsigned length=1, unsigned limit=15000) {
    unsigned startTime = getTimeMilliseconds();
    while (cuStreamQuery(0) == CUDA_ERROR_NOT_READY) {
        if ((getTimeMilliseconds() - startTime) > limit) return -1;
        SLEEPMS(length);
    }
    return 0;
}
#define SOFTWAIT()        if (_pollStatus()     != 0) { return MEMTEST_TIMEOUT; }
#define SOFTWAIT_LIM(lim) if (_pollStatus(1,lim) != 0) { return MEMTEST_TIMEOUT; }

// ===================================================================
// 커널 모듈 관리 (구현부: memtestG80_core.cpp)
//   프로그램 시작 시 memtestG80_initKernels(cubin경로) 로 cubin을 로드한 뒤
//   내부 gpuXxx 들이 이름으로 CUfunction 을 찾아 cuLaunchKernel 로 실행합니다.
// ===================================================================
bool memtestG80_initKernels(const char* cubinPath); // 성공 시 true
void memtestG80_unloadKernels();

// ===================================================================
// OO 인터페이스 (Driver API 판)
// ===================================================================
class memtestState {
protected:
    const uint nBlocks;
    const uint nThreads;
    uint loopIters;
    uint megsToTest;
    int  lcgPeriod;
    CUdeviceptr devTestMem;   // 시험 대상 전역 메모리 (원본은 uint*)
    CUdeviceptr devTempMem;   // 블록별 오류 수 (nBlocks개)
    uint* hostTempMem;        // 위를 CPU로 복사해 최종 합산할 버퍼
    bool allocated;
public:
    uint initTime;
    memtestState() : nBlocks(1024), nThreads(512), loopIters(0), megsToTest(0),
                     lcgPeriod(1024), devTestMem(0), devTempMem(0), hostTempMem(NULL),
                     allocated(false), initTime(0) {};
    ~memtestState() { deallocate(); }

    uint allocate(uint mbToTest);
    void deallocate();
    bool isAllocated() const { return allocated; }
    uint size() const { return megsToTest; }
    void setLCGPeriod(int period) { lcgPeriod = period; }
    int  getLCGPeriod() const { return lcgPeriod; }

    bool gpuMemoryBandwidth(double& bandwidth, uint mbToTest, uint iters=5);
    bool gpuWriteConstant(const uint constant) const;
    bool gpuVerifyConstant(uint& errorCount, const uint constant) const;
    bool gpuShortLCG0(uint& errorCount, const uint repeats) const;
    bool gpuShortLCG0Shmem(uint& errorCount, const uint repeats) const;
    bool gpuMovingInversionsOnesZeros(uint& errorCount) const;
    bool gpuWalking8BitM86(uint& errorCount, const uint shift) const;
    bool gpuWalking8Bit(uint& errorCount, const bool ones, const uint shift) const;
    bool gpuMovingInversionsRandom(uint& errorCount) const;
    bool gpuWalking32Bit(uint& errorCount, const bool ones, const uint shift) const;
    bool gpuRandomBlocks(uint& errorCount, const uint seed) const;
    bool gpuModuloX(uint& errorCount, const uint shift, const uint pattern, const uint modulus, const uint overwriteIters) const;
};

// ===================================================================
// 저수준 __host__ 함수 (Driver API 판). base/blockErrorCount 는 CUdeviceptr,
// errorCounts 는 호스트 버퍼(uint*). 반환값은 오류 수 또는 센티넬.
// ===================================================================
double gpuMemoryBandwidth(CUdeviceptr src, CUdeviceptr dst, uint mbToTest, uint iters);
void   gpuWriteConstant(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint constant);
uint   gpuVerifyConstant(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint constant, CUdeviceptr blockErrorCount, uint* errorCounts);

uint gpuShortLCG0(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint repeats, const int period, CUdeviceptr blockErrorCounts, uint* errorCounts);
uint gpuShortLCG0Shmem(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, const uint repeats, const int period, CUdeviceptr blockErrorCounts, uint* errorCounts);
uint gpuMovingInversionsOnesZeros(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, CUdeviceptr blockErrorCounts, uint* errorCounts);
uint gpuWalking8BitM86(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, uint shift, CUdeviceptr blockErrorCounts, uint* errorCounts);
uint gpuWalking8Bit(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, bool ones, uint shift, CUdeviceptr blockErrorCount, uint* errorCounts);
uint gpuMovingInversionsRandom(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, CUdeviceptr blockErrorCounts, uint* errorCounts);
uint gpuWalking32Bit(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, bool ones, uint shift, CUdeviceptr blockErrorCount, uint* errorCounts);
uint gpuRandomBlocks(const uint nBlocks, const uint nThreads, CUdeviceptr base, uint N, uint seed, CUdeviceptr blockErrorCount, uint* errorCounts);
uint gpuModuloX(const uint nBlocks, const uint nThreads, CUdeviceptr base, const uint N, uint shift, uint pattern1, const uint modulus, const uint iters, CUdeviceptr blockErrorCount, uint* errorCounts);

#endif
