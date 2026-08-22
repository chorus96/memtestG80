/*
 * memtestG80_kernels.cu
 * MemtestG80 디바이스(GPU) 커널 전용 소스 — Driver API 판.
 *
 * 이 파일에는 __global__ 커널과 그 커널이 쓰는 __device__ 헬퍼만 들어 있습니다.
 * 호스트 코드는 전혀 없습니다. nvcc로 *.cubin* 으로 컴파일한 뒤, 호스트 측
 * (memtestG80_core.cpp)이 CUDA Driver API의 cuModuleLoad/cuModuleGetFunction/
 * cuLaunchKernel 로 런타임에 로드·실행합니다.
 *
 * 원본(런타임 API 판) memtestG80_core.cu 에서 커널 부분만 분리한 것으로,
 * 커널 본문 로직은 원본과 동일합니다.
 *
 * ★ 모든 __global__ 커널은 extern "C" 로 감싸 이름 맹글링(name mangling)을 없앱니다.
 *   그래야 cuModuleGetFunction(&f, module, "deviceWriteConstant") 처럼 소스의 이름
 *   그대로 커널을 찾을 수 있습니다.
 *
 * Author: Imran Haque, 2009 (원본) · Driver API 분리판
 * 라이선스: LGPL v3 (원본과 동일)
 */

typedef unsigned int uint;

// CUDA 그리드 레이아웃: 블록·스레드 모두 1차원 선형.
// 스레드 t의 i번째 반복 주소 = base + blockIdx.x*N*blockDim.x + i*blockDim.x + threadIdx.x
#define THREAD_ADDRESS(base,N,i) (base + blockIdx.x * N * blockDim.x + i * blockDim.x + threadIdx.x)
#define THREAD_OFFSET(N,i)       (blockIdx.x * N * blockDim.x + i * blockDim.x + threadIdx.x)
#define BITSDIFF(x,y)            __popc((x) ^ (y))

// LCG 루프 매크로 (Linux/OSX용 _Pragma 변형). 짝 XOR로 명령 스트림에 다양성을 준다.
#define LCGLOOP(var,repeats,period,a,c) for (uint rep = 0; rep < repeats; rep++) {\
    (var) = ~(var);\
    _Pragma("unroll 1")\
    for (uint iter = 0; iter < period; iter++) {\
        (var) = ~(var);\
        (var) = (a)*(var)+(c);\
        (var) ^= 0xFFFFFFF0;\
        (var) ^= 0xF;\
    }\
    (var) = ~(var);\
}

/* =====================================================================
 * __device__ 헬퍼 (메르센 소수 2^31-1 기반 병렬 PRNG: Park-Miller ran0)
 * 커널 내부에서만 호출되므로 extern "C" 로 감싸지 않아도 됩니다.
 * ===================================================================== */
__device__ void deviceMul3131(uint v1, uint v2, uint& LO, uint& HI) {
    LO = v1*v2;
    HI = __umulhi(v1,v2);
    HI <<= 1;
    HI |= (LO & 0x80000000) >> 31;
    LO &= 0x7FFFFFFF;
}

__device__ uint deviceModMP31(uint LO, uint HI) {
    uint sum = LO+HI;
    if (sum >= 0x80000000) {
        return sum - 0x80000000 + 1;
    } else {
        return sum;
    }
}

__device__ uint deviceMulMP31(uint a, uint b) {
    uint LO,HI;
    deviceMul3131(a,b,LO,HI);
    return deviceModMP31(LO,HI);
}

__device__ uint deviceExpoModMP31(uint base, uint exponent) {
    uint result = 1;
    while (exponent > 0) {
        if (exponent & 1) result = deviceMulMP31(result,base);
        exponent >>= 1;
        base = deviceMulMP31(base,base);
    }
    return result;
}

// 병렬 폐형식(closed-form) ran0
__device__ uint deviceRan0p(int seed, int n) {
    uint an = deviceExpoModMP31(16807,n+1);
    return deviceMulMP31(an,seed);
}

// 무작위 비트 생성 (Numerical Recipes irbit2)
__device__ int deviceIrbit2(uint& seed) {
    const uint IB1 = 1, IB2 = 2, IB5 = 16, IB18 = 131072;
    const uint MASK = IB1+IB2+IB5;
    if (seed & IB18) {
        seed = ((seed ^ MASK) << 1) | IB1;
        return 1;
    } else {
        seed <<= 1;
        return 0;
    }
}

/* =====================================================================
 * __global__ 커널 — 전부 extern "C" 로 노출 (cuModuleGetFunction 이름 매칭용)
 * ===================================================================== */
extern "C" {

// --- 상수 쓰기/검증 ---
__global__ void deviceWriteConstant(uint* base, uint N, const uint constant) {
    for (uint i = 0 ; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = constant;
    }
}

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

// --- 로직 테스트 (LCG) ---
__global__ void deviceShortLCG0(uint* base, uint N, uint repeats, const int period) {
    int a,c;
    switch (period) {
        case 1024: a = 0x0fbfffff; c = 0x3bf75696; break;
        case 512:  a = 0x61c8647f; c = 0x2b3e0000; break;
        case 256:  a = 0x7161ac7f; c = 0x43840000; break;
        case 128:  a = 0x0432b47f; c = 0x1ce80000; break;
        case 2048: a = 0x763fffff; c = 0x4769466f; break;
        default:   a = 0; c = 0; break;
    }
    uint value = 0;
    LCGLOOP(value,repeats,period,a,c)
    for (uint i = 0 ; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = value;
    }
}

__global__ void deviceShortLCG0Shmem(uint* base, uint N, uint repeats, const int period) {
    int a,c;
    extern __shared__ uint shmem[];
    switch (period) {
        case 1024: a = 0x0fbfffff; c = 0x3bf75696; break;
        case 512:  a = 0x61c8647f; c = 0x2b3e0000; break;
        case 256:  a = 0x7161ac7f; c = 0x43840000; break;
        case 128:  a = 0x0432b47f; c = 0x1ce80000; break;
        case 2048: a = 0x763fffff; c = 0x4769466f; break;
        default:   a = 0; c = 0; break;
    }
    shmem[threadIdx.x] = 0;
    LCGLOOP(shmem[threadIdx.x],repeats,period,a,c)
    for (uint i = 0 ; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = shmem[threadIdx.x];
    }
}

// --- 페어 상수 (참 워킹 8비트) ---
__global__ void deviceWritePairedConstants(uint* base, uint N, uint pattern0, uint pattern1) {
    const uint pattern = (threadIdx.x & 0x1) ? pattern1 : pattern0;
    for (uint i = 0 ; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = pattern;
    }
}

__global__ void deviceVerifyPairedConstants(uint* base, uint N, uint pattern0, uint pattern1, uint* blockErrorCount) {
    extern __shared__ uint threadErrorCount[];
    threadErrorCount[threadIdx.x] = 0;
    const uint pattern = (threadIdx.x & 0x1) ? pattern1 : pattern0;

    for (uint i = 0; i < N; i++) {
        threadErrorCount[threadIdx.x] += BITSDIFF(*(THREAD_ADDRESS(base,N,i)), pattern);
    }
    for (uint stride = blockDim.x>>1; stride > 0; stride >>= 1) {
        __syncthreads();
        if (threadIdx.x < stride)
            threadErrorCount[threadIdx.x] += threadErrorCount[threadIdx.x + stride];
    }
    __syncthreads();
    if (threadIdx.x == 0)
        blockErrorCount[blockIdx.x] = threadErrorCount[0];
}

// --- 워킹 32비트 ---
__global__ void deviceWriteWalking32Bit(uint* base, uint N, bool ones, uint shift) {
    uint pattern = 1 << ((threadIdx.x + shift) & 0x1f);
    pattern = ones ? pattern : ~pattern;
    for (uint i = 0; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = pattern;
    }
}

__global__ void deviceVerifyWalking32Bit(uint* base, uint N, bool ones, uint shift, uint* blockErrorCount) {
    extern __shared__ uint threadErrorCount[];
    threadErrorCount[threadIdx.x] = 0;
    uint pattern = 1 << ((threadIdx.x + shift) & 0x1f);
    pattern = ones ? pattern : ~pattern;

    for (uint i = 0; i < N; i++) {
        threadErrorCount[threadIdx.x] += BITSDIFF(*(THREAD_ADDRESS(base,N,i)), pattern);
    }
    for (uint stride = blockDim.x>>1; stride > 0; stride >>= 1) {
        __syncthreads();
        if (threadIdx.x < stride)
            threadErrorCount[threadIdx.x] += threadErrorCount[threadIdx.x + stride];
    }
    __syncthreads();
    if (threadIdx.x == 0)
        blockErrorCount[blockIdx.x] = threadErrorCount[0];
}

// --- 무작위 블록 (GPU 상 병렬 PRNG) ---
__global__ void deviceWriteRandomBlocks(uint* base, uint N, int seed) {
    extern __shared__ uint randomBlock[];
    if (seed == 0) seed = 123459876+blockIdx.x;
    uint bitSeed = deviceRan0p(seed + threadIdx.x, threadIdx.x);

    for (uint i=0; i < N; i++) {
        randomBlock[threadIdx.x] = deviceRan0p(seed,threadIdx.x) | (deviceIrbit2(bitSeed) << 31);
        __syncthreads();
        seed = randomBlock[blockDim.x-1];
        __syncthreads();
        *(THREAD_ADDRESS(base,N,i)) = randomBlock[threadIdx.x];
    }
}

__global__ void deviceVerifyRandomBlocks(uint* base, uint N, int seed, uint* blockErrorCount) {
    extern __shared__ uint shmem[];
    uint* threadErrorCount = shmem;
    uint* randomBlock = shmem + blockDim.x;
    uint* bitSeeds = randomBlock + blockDim.x;

    threadErrorCount[threadIdx.x] = 0;
    if (seed == 0) seed = 123459876+blockIdx.x;
    bitSeeds[threadIdx.x] = deviceRan0p(seed + threadIdx.x, threadIdx.x);

    for (uint i = 0; i < N; i++) {
        randomBlock[threadIdx.x] = deviceRan0p(seed,threadIdx.x) | (deviceIrbit2(bitSeeds[threadIdx.x]) << 31);
        __syncthreads();
        seed = randomBlock[blockDim.x-1];
        __syncthreads();
        threadErrorCount[threadIdx.x] += BITSDIFF(*(THREAD_ADDRESS(base,N,i)), randomBlock[threadIdx.x]);
    }
    for (uint stride = blockDim.x>>1; stride > 0; stride >>= 1) {
        __syncthreads();
        if (threadIdx.x < stride)
            threadErrorCount[threadIdx.x] += threadErrorCount[threadIdx.x + stride];
    }
    __syncthreads();
    if (threadIdx.x == 0)
        blockErrorCount[blockIdx.x] = threadErrorCount[0];
}

// --- Modulo-X ---
__global__ void deviceWritePairedModulo(uint* base, const uint N, const uint shift, const uint pattern1, const uint pattern2, const uint modulus, const uint iters) {
    uint offset;
    for (uint i = 0 ; i < N; i++) {
        offset = THREAD_OFFSET(N,i);
        if ((offset % modulus) == shift) *(base+offset) = pattern1;
    }
    __syncthreads();
    for (uint j = 0; j < iters; j++) {
        for (uint i = 0 ; i < N; i++) {
            offset = THREAD_OFFSET(N,i);
            if ((offset % modulus) != shift) *(base+offset) = pattern2;
        }
    }
}

__global__ void deviceVerifyPairedModulo(uint* base, uint N, const uint shift, const uint pattern1, const uint modulus, uint* blockErrorCount) {
    extern __shared__ uint threadErrorCount[];
    threadErrorCount[threadIdx.x] = 0;
    uint offset;

    for (uint i = 0; i < N; i++) {
        offset = THREAD_OFFSET(N,i);
        if ((offset % modulus) == shift) threadErrorCount[threadIdx.x] += BITSDIFF(*(base+offset), pattern1);
    }
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
