/*
 * memtestG80_kernels.cu  (교육용 간결 버전 driver_api_study/)
 * MemtestG80 디바이스(GPU) 커널 — Driver API 판. 호스트 코드는 없습니다.
 *
 * nvcc 로 *.cubin* 으로 컴파일한 뒤, 호스트 측(memtestG80_core.cpp)이 CUDA Driver
 * API 의 cuModuleLoad/cuModuleGetFunction/cuLaunchKernel 로 런타임에 로드·실행합니다.
 *
 * ★ 교육용 축소판: 대표 테스트(Moving Inversions, ones/zeros)에 필요한
 *   두 커널만 남겼습니다 — deviceWriteConstant(쓰기) · deviceVerifyConstant(검증).
 *   (원본의 LCG·워킹·랜덤·모듈로 커널과 PRNG __device__ 헬퍼는 제거)
 *
 * ★ 모든 __global__ 커널은 extern "C" 로 감싸 이름 맹글링(name mangling)을 없앱니다.
 *   그래야 cuModuleGetFunction(&f, module, "deviceWriteConstant") 처럼 소스의 이름
 *   그대로 커널을 찾을 수 있습니다.
 *
 * Author: Imran Haque, 2009 (원본) · Driver API 교육용 분리판
 * 라이선스: LGPL v3 (원본과 동일)
 */

typedef unsigned int uint;

// CUDA 그리드 레이아웃: 블록·스레드 모두 1차원 선형.
// 스레드 t의 i번째 반복 주소 = base + blockIdx.x*N*blockDim.x + i*blockDim.x + threadIdx.x
#define THREAD_ADDRESS(base,N,i) (base + blockIdx.x * N * blockDim.x + i * blockDim.x + threadIdx.x)
// 두 값의 서로 다른 비트 수 (Hamming distance) = 오류 비트 수
#define BITSDIFF(x,y)            __popc((x) ^ (y))

/* =====================================================================
 * __global__ 커널 — 전부 extern "C" 로 노출 (cuModuleGetFunction 이름 매칭용)
 * ===================================================================== */
extern "C" {

// 각 스레드가 자기 담당 word 들에 constant 를 채운다.
__global__ void deviceWriteConstant(uint* base, uint N, const uint constant) {
    for (uint i = 0 ; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = constant;
    }
}

// 되읽어 constant 와 다른 비트 수를 세고, 블록 안에서 트리 리덕션으로 합산한다.
__global__ void deviceVerifyConstant(uint* base, uint N, const uint constant, uint* blockErrorCount) {
    extern __shared__ uint threadErrorCount[];
    threadErrorCount[threadIdx.x] = 0;

    for (uint i = 0; i < N; i++) {
        threadErrorCount[threadIdx.x] += BITSDIFF(*(THREAD_ADDRESS(base,N,i)), constant);
    }
    // 블록 내 트리 리덕션
    for (uint stride = blockDim.x>>1; stride > 0; stride >>= 1) {
        __syncthreads();
        if (threadIdx.x < stride)
            threadErrorCount[threadIdx.x] += threadErrorCount[threadIdx.x + stride];
    }
    __syncthreads();
    if (threadIdx.x == 0)
        blockErrorCount[blockIdx.x] = threadErrorCount[0];
}

} // extern "C"
