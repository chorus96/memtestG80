/*
 * ============================================================================
 * memtestG80_kernels.cu — GPU 커널 (CUDA Driver API · 교육용 최소 예제)
 * ============================================================================
 *
 * 【이 파일만 읽어도 되는 세미나 노트】
 *
 * ■ 이 파일의 역할
 *   GPU(디바이스)에서 실행되는 "커널" 함수만 들어 있습니다. CPU(호스트) 코드는
 *   전혀 없습니다. nvcc 로 memtestG80.cubin 으로 컴파일되고, 호스트 프로그램
 *   (memtestG80_cli.cpp)이 실행 중에 CUDA Driver API 로 이 cubin 을 로드해 실행합니다.
 *
 * ■ CUDA 실행 모델 한 컷 (커널을 이해하는 데 필요한 최소 지식)
 *   커널을 실행하면 수많은 "스레드(thread)"가 동시에 같은 함수 본문을 실행합니다.
 *   스레드는 2단으로 조직됩니다:
 *       그리드(grid)  ─ 블록(block) 여러 개
 *       블록(block)   ─ 스레드(thread) 여러 개
 *   이 예제는 블록 1024개 × 블록당 스레드 512개 = 524,288개 스레드로 실행합니다.
 *   각 스레드는 내장 변수로 자기 위치를 압니다:
 *       blockIdx.x   : 내 블록 번호 (0 ~ 1023)
 *       threadIdx.x  : 블록 안에서 내 번호 (0 ~ 511)
 *       blockDim.x   : 블록당 스레드 수 (= 512, 모든 스레드 공통)
 *       gridDim.x    : 블록 수 (= 1024, 공통)
 *   → 이 값들로 "내가 메모리의 어디를 담당하는지"를 계산합니다 (아래 THREAD_ADDRESS).
 *
 * ■ 함수 한정자(qualifier)
 *       __global__ : CPU가 호출하고 GPU가 실행하는 함수 = "커널". 반환형은 항상 void.
 *       __device__ : GPU에서 GPU만 호출하는 보조 함수 (이 파일엔 지금 없음).
 *
 * ■ extern "C" 가 왜 필요한가 (★ Driver API 의 핵심 전제)
 *   C++ 컴파일러는 오버로딩을 위해 함수 이름을 "맹글링(name mangling)"해
 *   deviceWriteConstant → _Z19deviceWriteConstant... 같은 내부 이름으로 바꿉니다.
 *   그러면 호스트가 cuModuleGetFunction(module, "deviceWriteConstant") 로 커널을
 *   "이름으로" 찾을 수 없습니다. extern "C" 로 감싸면 맹글링이 꺼져 cubin 안에
 *   소스에 쓴 이름 그대로 심볼이 남습니다. → 호스트가 이름으로 커널을 찾을 수 있음.
 *   (확인: 빌드 후 `cuobjdump -symbols memtestG80.cubin | grep device`)
 *
 * ■ 남긴 커널 2개
 *       deviceWriteConstant  : 각 스레드가 자기 담당 메모리에 상수를 "쓴다"
 *       deviceVerifyConstant : 되읽어 상수와 다른 비트 수를 "센다"(공유 메모리 리덕션)
 *   이 둘만으로 "쓰고 → 되읽어 검증"이라는 메모리 테스트의 뼈대가 완성됩니다.
 *
 * 라이선스: LGPL v3 (원본과 동일) · Author: Imran Haque, 2009 (원본) 교육용 분리판
 * ============================================================================
 */

typedef unsigned int uint;

/*
 * THREAD_ADDRESS — 스레드 t 가 i 번째 반복에서 다룰 word(4바이트) 의 주소.
 *
 *   base + blockIdx.x * N * blockDim.x   ← 이 블록이 담당하는 큰 구역의 시작
 *        + i          * blockDim.x       ← 블록 안에서 i 번째 반복의 오프셋
 *        + threadIdx.x                   ← 그 안에서 내 스레드의 자리(0~511)
 *
 *   N(=loopIters) 은 스레드 하나가 담당하는 word 개수. 블록은 N*512 word 구역을 맡고,
 *   같은 반복 i 에서 "이웃 스레드(threadIdx.x)가 이웃한 주소"를 담당합니다.
 *   → 워프(warp, 32스레드)의 접근이 한 트랜잭션으로 묶이는 "메모리 병합(coalescing)"이
 *     일어나 대역폭을 최대한 활용합니다. (주소 매핑이 성능까지 좌우한다는 점이 포인트)
 */
#define THREAD_ADDRESS(base,N,i) (base + blockIdx.x * N * blockDim.x + i * blockDim.x + threadIdx.x)

/*
 * BITSDIFF — 두 값이 서로 다른 비트의 개수(해밍 거리).
 *   __popc(x) 는 x 의 1 비트 개수를 세는 GPU 내장 함수(population count).
 *   (a ^ b) 는 서로 다른 비트만 1 이 되므로, __popc(a ^ b) = "틀린 비트 수" = 오류 비트 수.
 */
#define BITSDIFF(x,y)            __popc((x) ^ (y))

/* =====================================================================
 * __global__ 커널 — 전부 extern "C" 로 노출 (호스트가 이름으로 찾도록)
 * ===================================================================== */
extern "C" {

/*
 * deviceWriteConstant — 각 스레드가 자기 담당 word 들(i=0..N-1)에 constant 를 채운다.
 *   인자:  base     테스트 영역의 시작 주소(디바이스 포인터)
 *          N        스레드당 word 수
 *          constant 써 넣을 32비트 패턴
 *   반환은 없음(void). 결과는 전역 메모리에 남는다 → 커널의 전형적 패턴.
 */
__global__ void deviceWriteConstant(uint* base, uint N, const uint constant) {
    for (uint i = 0 ; i < N; i++) {
        *(THREAD_ADDRESS(base,N,i)) = constant;   // 내 자리(주소)에 상수 쓰기
    }
}

/*
 * deviceVerifyConstant — 되읽어 constant 와 다른 비트 수를 세고,
 *                        블록 안에서 합쳐 blockErrorCount[blockIdx.x] 에 남긴다.
 *
 *   ★ 공유 메모리(shared memory)와 트리 리덕션(tree reduction)이 이 커널의 핵심.
 *
 *   extern __shared__ uint threadErrorCount[];
 *       블록 안 스레드들이 공유하는 고속 메모리 배열. 크기는 실행 시 지정합니다
 *       (호스트의 cuLaunchKernel 에 shmem = sizeof(uint)*nThreads 로 전달).
 *       스레드마다 한 칸(threadErrorCount[threadIdx.x])씩 자기 오류 수를 적습니다.
 */
__global__ void deviceVerifyConstant(uint* base, uint N, const uint constant, uint* blockErrorCount) {
    extern __shared__ uint threadErrorCount[];
    threadErrorCount[threadIdx.x] = 0;                    // 내 칸 0으로 초기화

    // 1) 각 스레드가 자기 담당 word 들을 되읽어 "틀린 비트 수"를 누적
    for (uint i = 0; i < N; i++) {
        threadErrorCount[threadIdx.x] += BITSDIFF(*(THREAD_ADDRESS(base,N,i)), constant);
    }

    // 2) 블록 내 트리 리덕션: 512 → 256 → 128 → ... → 1 로 반씩 접어 합산.
    //    __syncthreads() 는 블록 내 모든 스레드가 이 지점에 도달할 때까지 대기하는 장벽.
    //    (앞 단계의 쓰기가 끝나기 전에 다음 단계가 읽으면 안 되므로 반드시 동기화)
    for (uint stride = blockDim.x>>1; stride > 0; stride >>= 1) {
        __syncthreads();
        if (threadIdx.x < stride)
            threadErrorCount[threadIdx.x] += threadErrorCount[threadIdx.x + stride];
    }
    __syncthreads();

    // 3) 대표 스레드(0번)가 이 블록의 총 오류 수를 전역 메모리에 기록.
    //    호스트는 나중에 blockErrorCount[] 를 CPU 로 복사해 블록들을 최종 합산한다.
    if (threadIdx.x == 0)
        blockErrorCount[blockIdx.x] = threadErrorCount[0];
}

} // extern "C"
