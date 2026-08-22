# 부록 1 — CUDA Driver API로 보는 **빌드 & 커널 로딩** (`driver_api/` 분석)

> **위치**: 본편(세션 0~5)을 마친 뒤 읽는 심화 부록입니다.
> **원본**: `driver_api/` 디렉터리 — 런타임 API로 짜인 MemtestG80을 **드라이버 API(`cu*`)** 로 다시 구현한 판.
> **이 부록이 집중하는 두 가지**: ① **빌드 과정**(호스트/디바이스 분리 컴파일, cubin) · ② **커널 로딩 과정**(cuModuleLoad → cuModuleGetFunction → cuLaunchKernel).
> **표기**: 한글 용어 옆에 원어(영어)를 병기합니다. 예) 모듈(module)

---

## 왜 이 부록인가 — 런타임 API가 "숨겨 주던" 것

본편에서 읽은 MemtestG80은 **CUDA 런타임 API**(`cudaMalloc`, `커널<<<grid,block>>>(...)`, `cudaMemcpy`)로 작성돼 있습니다. 런타임 API는 편하지만, GPU 프로그램이 실제로 어떻게 **빌드되고 로드되는지**를 컴파일러(`nvcc`)가 대신 처리해 **감춰** 줍니다.

**드라이버 API(driver API)** 는 그 감춰진 단계를 개발자가 직접 씁니다. 그래서 배우기엔 더 번거롭지만, 다음을 눈으로 볼 수 있습니다.

| 런타임 API가 자동으로 해 주던 일 | 드라이버 API에서는 직접 |
|---|---|
| 컨텍스트(context) 생성 | `cuInit` → `cuCtxCreate` |
| 커널을 실행 파일에 **내장**(fatbin) | 커널을 **별도 `.cubin`** 으로 두고 실행 중 `cuModuleLoad` |
| 커널 이름 → 함수 핸들 연결 | `cuModuleGetFunction(module, "이름")` |
| `<<<>>>` 인자 마샬링(marshalling) | `void* args[]` 배열을 손으로 구성 → `cuLaunchKernel` |

이 부록은 그중에서도 **빌드 과정**(Part A)과 **커널 로딩 과정**(Part B)에 집중합니다.

---

## 0. 전체 그림 — 소스에서 실행까지

`driver_api/` 는 **디바이스 코드(커널)** 와 **호스트 코드**가 완전히 분리돼 있습니다. 이 분리가 빌드·로딩 전체를 이해하는 열쇠입니다.

```mermaid
flowchart LR
    subgraph SRC["소스 (driver_api/)"]
        KCU["memtestG80_kernels.cu<br/>디바이스 커널만<br/>(__global__ / __device__)"]
        CPP["memtestG80_core.cpp<br/>memtestG80_cli.cpp<br/>호스트 코드 (cu* 호출)"]
        HDR["memtestG80_core.h<br/>ezOptionParser.hpp"]
    end
    subgraph BUILD["빌드 (Makefile)"]
        NVCC["nvcc -cubin"]
        GXX["g++ -c + 링크(-lcuda)"]
    end
    subgraph OUT["산출물"]
        CUBIN["memtestG80.cubin<br/>(GPU 바이너리·별도 파일)"]
        EXE["memtestG80<br/>(호스트 실행 파일)"]
    end
    KCU --> NVCC --> CUBIN
    CPP --> GXX
    HDR -.include.-> GXX
    GXX --> EXE
    EXE -. "실행 시 cuModuleLoad" .-> CUBIN

    classDef dev fill:#241A16,stroke:#E8A33D,color:#E8A33D;
    classDef host fill:#12212A,stroke:#3FB8C4,color:#3FB8C4;
    class KCU,NVCC,CUBIN dev;
    class CPP,GXX,EXE host;
```

> **한 줄 요약**: 커널은 `nvcc` 로 **cubin**(GPU 전용 바이너리)이 되어 따로 남고, 호스트는 `g++` 로 실행 파일이 되며, 실행 파일은 **실행 중에** cubin을 읽어 커널을 불러옵니다.

### 디렉터리 구성

| 파일 | 역할 | 컴파일러 |
|---|---|---|
| `memtestG80_kernels.cu` | **디바이스 커널만** (`__global__`/`__device__`). `extern "C"` 로 노출 | `nvcc -cubin` → `memtestG80.cubin` |
| `memtestG80_core.h` | 공개 API — `memtestState`, SOFTWAIT, 센티넬, 모듈 관리 선언 | (헤더) |
| `memtestG80_core.cpp` | 호스트 구현 — 모듈 로딩, `cuLaunchKernel`, 메모리(`cuMem*`) | `g++` |
| `memtestG80_cli.cpp` | `main()` — 디바이스 열거·컨텍스트·cubin 로드 + 13종 테스트 루프 | `g++` |
| `ezOptionParser.hpp` | 명령행 인자 파서 (자체 포함용 복사본) | (헤더) |
| `Makefile` | Linux x64 빌드 (cubin + 호스트 링크 `-lcuda`) | — |

---

# PART A — 빌드 과정 (Build) ★핵심 1

## A.1 두 갈래 컴파일 — 왜 나눠야 하나

런타임 API 원본(`memtestG80_core.cu`)은 커널과 호스트가 **한 파일**에 섞여 있어 전체를 `nvcc` 로 컴파일했습니다. `nvcc` 는 내부적으로 디바이스 코드를 뽑아 GPU 바이너리로 만들고 이를 실행 파일에 **fatbin**으로 끼워 넣습니다(개발자는 이 과정을 보지 못함).

드라이버 API 판은 이를 **두 갈래**로 명시적으로 쪼갭니다.

```mermaid
flowchart TD
    subgraph DEVICE["① 디바이스 경로 (GPU 코드)"]
        K["memtestG80_kernels.cu"] -->|"nvcc -cubin -arch=SMARCH"| CUBIN["memtestG80.cubin"]
    end
    subgraph HOST["② 호스트 경로 (CPU 코드)"]
        C1["memtestG80_core.cpp"] -->|"g++ -c"| O1["memtestG80_core.o"]
        C2["memtestG80_cli.cpp"] -->|"g++ -c"| O2["memtestG80_cli.o"]
        O1 --> L["g++ 링크"]
        O2 --> L
        L -->|"-lcuda"| EXE["memtestG80"]
    end
    CUBIN -. "런타임에만 만남<br/>(빌드 시엔 서로 독립)" .- EXE

    classDef dev fill:#241A16,stroke:#E8A33D,color:#E8A33D;
    classDef host fill:#12212A,stroke:#3FB8C4,color:#3FB8C4;
    class K,CUBIN dev;
    class C1,C2,O1,O2,L,EXE host;
```

핵심은 **두 경로가 빌드 시점에는 완전히 독립**이라는 점입니다. cubin과 실행 파일은 서로를 링크하지 않습니다. 둘은 오직 **실행 시**(`cuModuleLoad`)에만 만납니다. 이것이 "런타임 커널 로딩"의 본질입니다.

## A.2 디바이스 컴파일 — `nvcc -cubin` 뜯어보기

```make
$(CUBIN): memtestG80_kernels.cu
	$(NVCC) -cubin -arch=$(SMARCH) -Xptxas -v -o $(CUBIN) memtestG80_kernels.cu
```

`nvcc -cubin` 은 `.cu` 안의 디바이스 코드를 **SASS**(특정 GPU 세대의 실제 기계어)로 컴파일해 `.cubin` 파일 하나로 내보냅니다. 내부 단계는 이렇습니다.

```mermaid
flowchart LR
    CU["memtestG80_kernels.cu<br/>(CUDA C++)"] -->|"프런트엔드"| PTX["PTX<br/>(가상 ISA·중간표현)"]
    PTX -->|"ptxas -arch=sm_XX"| SASS["SASS<br/>(sm_XX 전용 기계어)"]
    SASS --> CUBIN["memtestG80.cubin<br/>(ELF 컨테이너)"]

    classDef dev fill:#241A16,stroke:#E8A33D,color:#E8A33D;
    class CU,PTX,SASS,CUBIN dev;
```

- **`-arch=$(SMARCH)`**: 어느 GPU 세대의 SASS를 낼지 지정. `sm_52`(Maxwell), `sm_75`(Turing/T4), `sm_86`(Ampere), `sm_89`(Ada) 등.
- **`-Xptxas -v`**: PTX 어셈블러에 verbose 옵션을 넘겨 **레지스터/공유 메모리 사용량**을 출력 → 커널 점유율(occupancy) 감 잡기용.
- **산출물 `memtestG80.cubin`**: 여러 커널을 담은 **ELF 형식 컨테이너**. `cuobjdump -sass memtestG80.cubin` 으로 디스어셈블해 볼 수 있습니다.

### ⚠️ cubin은 "그 아키텍처 전용"

cubin에는 특정 `sm_XX` 의 SASS만 들어 있어, **다른 세대 GPU에서는 로드가 실패**합니다(아래 Part B의 오류 표 참조). 이것이 cubin의 가장 큰 특징이자 제약입니다.

### `extern "C"` — 빌드가 만들어 낼 "이름"을 고정

```c
extern "C" {
__global__ void deviceWriteConstant(uint* base, uint N, const uint constant) { ... }
...
} // extern "C"
```

C++ 컴파일러는 오버로딩을 위해 함수 이름을 **맹글링(name mangling)** 합니다(`deviceWriteConstant` → `_Z19deviceWriteConstant...`). 그러면 나중에 이름으로 커널을 찾을 수 없습니다. `extern "C"` 로 감싸면 맹글링이 꺼져, cubin 안에 **소스에 쓴 이름 그대로** 심볼이 남습니다. → Part B의 `cuModuleGetFunction(module, "deviceWriteConstant")` 가 성립하는 이유입니다.

## A.3 호스트 컴파일 — `nvcc` 없이 `g++` 로

```make
memtestG80_core.o: memtestG80_core.cpp memtestG80_core.h
	$(CXX) -c $(CXXFLAGS) -o memtestG80_core.o memtestG80_core.cpp
# CXXFLAGS = -O2 -Wall -m64 -I$(CUDA_INC)
```

호스트 코드에는 **디바이스 코드가 한 줄도 없습니다**(`__global__`/`<<<>>>` 없음). 필요한 건 드라이버 API 헤더 `cuda.h` 뿐입니다(`-I$(CUDA_INC)`). 그래서 평범한 `g++` 로 컴파일됩니다 — 이 판의 중요한 성질입니다. **GPU 툴체인(nvcc)은 오직 cubin을 만들 때만** 필요합니다.

## A.4 링크 — `-lcuda` (드라이버 라이브러리)

```make
$(TARGET): $(OBJS)
	$(CXX) -m64 -o $(TARGET) $(OBJS) $(LDFLAGS)
# LDFLAGS = -L$(CUDA_LIB) -L$(CUDA_STUB) -lcuda
```

여기서 링크하는 것은 **`libcuda.so`(드라이버 라이브러리)** 이지 런타임(`libcudart`)이 아닙니다. 둘의 차이:

| | `libcudart` (런타임) | `libcuda` (드라이버) |
|---|---|---|
| 제공 심볼 | `cudaMalloc`, `cudaMemcpy`, … | `cuInit`, `cuMemAlloc`, `cuLaunchKernel`, … |
| 배포 | CUDA Toolkit과 함께 | **드라이버 설치 시** 시스템에 설치 |
| 이 판에서 | 사용 안 함 | **사용** (`-lcuda`) |

- **`-L$(CUDA_STUB)`**(`.../lib64/stubs`): 빌드 머신에 실제 드라이버가 없어도 **링크만** 되도록 `libcuda.so` 스텁(stub)을 제공합니다. 실제 실행 시에는 시스템에 설치된 진짜 `libcuda.so` 가 로드됩니다.

## A.5 Makefile을 의존성 그래프로 읽기

`make` 는 아래 의존 관계를 보고 **바뀐 부분만** 다시 빌드합니다.

```mermaid
flowchart TD
    ALL(("all")) --> CUBIN["memtestG80.cubin"]
    ALL --> TARGET["memtestG80"]

    CUBIN -->|nvcc -cubin| KCU["memtestG80_kernels.cu"]

    TARGET -->|"g++ 링크 -lcuda"| O1["memtestG80_core.o"]
    TARGET --> O2["memtestG80_cli.o"]
    O1 -->|g++ -c| CORECPP["memtestG80_core.cpp"]
    O1 --> COREH["memtestG80_core.h"]
    O2 -->|g++ -c| CLICPP["memtestG80_cli.cpp"]
    O2 --> COREH
    O2 --> EZ["ezOptionParser.hpp"]

    classDef dev fill:#241A16,stroke:#E8A33D,color:#E8A33D;
    classDef host fill:#12212A,stroke:#3FB8C4,color:#3FB8C4;
    class CUBIN,KCU dev;
    class TARGET,O1,O2,CORECPP,CLICPP,COREH,EZ host;
```

주요 변수(덮어쓰기 가능):

| 변수 | 기본값 | 뜻 |
|---|---|---|
| `SMARCH` | `sm_52` | cubin 대상 GPU 아키텍처. **자기 GPU에 맞게 반드시 조정** |
| `CUDA_PATH` | `/usr/local/cuda` | 툴킷 경로(`nvcc`, 헤더, `lib64`, `stubs`) |
| `NVCC` | `$(CUDA_PATH)/bin/nvcc` | 디바이스 컴파일러 |
| `CXX` | `g++` | 호스트 컴파일러 |

```bash
make SMARCH=sm_75      # Turing/T4용 cubin + 실행 파일
make clean             # *.o, 실행 파일, cubin 삭제
```

## A.6 cubin vs PTX vs fatbin — 무엇을 남길까

| 산출물 | 담긴 것 | 이식성 | 이 판의 선택 |
|---|---|---|---|
| **cubin** | 특정 `sm_XX` SASS | ❌ 그 세대 전용 | ✅ (요청대로 "cubin 로딩 구조" 시연) |
| **PTX** | 가상 ISA | ✅ 드라이버가 실행 시 JIT | 대안 (아래) |
| **fatbin** | 여러 SASS + PTX 묶음 | ✅ 넓음 | 런타임 API 원본이 내부적으로 사용 |

> PTX로 바꾸려면 Makefile의 `-cubin` → `-ptx`, 산출물 `memtestG80.ptx` 로만 바꾸면 됩니다. **로드 코드(Part B)는 그대로** — `cuModuleLoad` 는 cubin/PTX/fatbin을 모두 같은 방식으로 받습니다(PTX면 드라이버가 로드 시 JIT 컴파일).

---

# PART B — 커널 로딩 & 실행 과정 (Kernel Loading) ★핵심 2

빌드가 끝나면 실행 파일과 cubin이 따로 존재합니다. 이제 실행 파일이 **실행 중에** cubin을 불러와 커널을 돌리는 과정을 봅니다. 전체 수명주기는 다음과 같습니다.

```mermaid
flowchart TD
    A["cuInit(0)<br/>드라이버 초기화"] --> B["cuDeviceGet · cuDeviceGetName<br/>cuDeviceGetAttribute(compute capability)"]
    B --> C["cuCtxCreate<br/>컨텍스트 생성 (이후 모든 cu* 의 대상)"]
    C --> D["findCubin() → cuModuleLoad<br/>cubin 파일 → CUmodule"]
    D --> E["cuModuleGetFunction<br/>이름 → CUfunction (K() 캐시)"]
    E --> F["cuMemAlloc<br/>테스트 메모리 확보"]
    F --> G["반복: cuLaunchKernel + SOFTWAIT + cuMemcpyDtoH<br/>(13종 테스트)"]
    G --> H["cuMemFree · cuModuleUnload · cuCtxDestroy"]

    classDef load fill:#241A16,stroke:#E8A33D,color:#E8A33D;
    class D,E load;
```

로딩의 핵심 3단계는 **③ `cuModuleLoad` → ④ `cuModuleGetFunction` → ⑥ `cuLaunchKernel`** 입니다. 하나씩 봅니다.

## B.1 초기화 — `cuInit` → 디바이스 조회 → 컨텍스트

`memtestG80_cli.cpp:main()` 도입부:

```c
CUresult res = cuInit(0);                 // ① 드라이버 초기화 (한 번만)
cuDeviceGetCount(&devCount);              // 디바이스 개수
cuDeviceGet(&cuDev, gpuID);               // gpuID번 디바이스 핸들
cuDeviceGetName(devName, sizeof(devName), cuDev);
cuDeviceGetAttribute(&ccMajor, CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR, cuDev);
cuDeviceGetAttribute(&ccMinor, CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MINOR, cuDev);
CUcontext cuCtx;
res = cuCtxCreate(&cuCtx, 0, cuDev);      // ② 컨텍스트 생성
```

- 런타임 API에서는 이 모든 것이 첫 `cudaXxx` 호출 때 **자동**으로 일어납니다. 드라이버 API에서는 순서를 직접 맞춰야 합니다(`cuInit` → 디바이스 → 컨텍스트).
- `cuDeviceGetAttribute` 로 읽은 **compute capability**(예: `sm_75`)는 cubin의 `SMARCH` 와 맞아야 로드가 성공합니다. — 사용자가 GPU/cubin 불일치를 진단할 단서.

## B.2 cubin 찾기 — `findCubin()`

`cuModuleLoad` 는 **파일 경로**를 받으므로, 실행 파일이 cubin의 위치를 알아야 합니다. 탐색 우선순위:

```mermaid
flowchart TD
    S["findCubin(argv0)"] --> E{"환경변수<br/>MEMTESTG80_CUBIN?"}
    E -->|있음| USE1["그 경로 사용"]
    E -->|없음| X{"실행 파일 옆<br/>dir(argv0)/memtestG80.cubin?"}
    X -->|존재| USE2["그 경로 사용"]
    X -->|없음| USE3["현재 디렉터리<br/>&quot;memtestG80.cubin&quot;"]
```

```c
const char* env = getenv("MEMTESTG80_CUBIN");   // ① 환경변수 우선
if (env && *env) return std::string(env);
// ② 실행 파일이 있는 폴더 옆
std::string cand = dir(argv0) + "/memtestG80.cubin";
if (fopen(cand.c_str(),"rb")) return cand;
return std::string("memtestG80.cubin");          // ③ 현재 디렉터리
```

## B.3 로드 — `cuModuleLoad` (cubin → 모듈)

`memtestG80_core.cpp`:

```c
static CUmodule g_module = 0;

bool memtestG80_initKernels(const char* cubinPath) {
    if (cuModuleLoad(&g_module, cubinPath) != CUDA_SUCCESS) {  // 파일 → CUmodule
        g_module = 0;
        return false;
    }
    return true;
}
```

`cuModuleLoad` 는 cubin(또는 PTX/fatbin) 파일을 읽어 현재 컨텍스트에 **모듈(module)** 로 올립니다. 반환된 `CUmodule` 핸들이 이후 커널 조회의 대상입니다. (파일이 없거나 아키텍처가 안 맞으면 여기서 실패 → CLI가 친절한 오류를 출력.)

## B.4 심볼 해석 — `cuModuleGetFunction` + 캐싱

```c
static std::map<std::string, CUfunction> g_funcs;   // 이름→핸들 캐시

static CUfunction K(const char* name) {
    auto it = g_funcs.find(name);
    if (it != g_funcs.end()) return it->second;      // 이미 찾았으면 재사용
    CUfunction f = 0;
    if (cuModuleGetFunction(&f, g_module, name) != CUDA_SUCCESS) return 0;
    g_funcs[name] = f;                               // 캐시에 저장
    return f;
}
```

- `cuModuleGetFunction(&f, module, "deviceWriteConstant")` 는 모듈 안에서 **그 이름의 커널**을 찾아 `CUfunction` 핸들을 돌려줍니다.
- 이름이 그대로 통하는 건 A.2의 **`extern "C"`** 덕분입니다.
- **`K()` 헬퍼**는 조회 결과를 `map` 에 캐시해, 같은 커널을 반복 실행할 때 매번 심볼을 다시 찾지 않게 합니다(13종 테스트를 수십 번 반복하므로 효과적).

cubin에 노출된 12개 커널(모두 `cuModuleGetFunction` 이름 매칭 대상):

```
deviceWriteConstant        deviceVerifyConstant
deviceShortLCG0            deviceShortLCG0Shmem
deviceWritePairedConstants deviceVerifyPairedConstants
deviceWriteWalking32Bit    deviceVerifyWalking32Bit
deviceWriteRandomBlocks    deviceVerifyRandomBlocks
deviceWritePairedModulo    deviceVerifyPairedModulo
```

## B.5 실행 — `cuLaunchKernel` (인자 마샬링)

런타임 API의 `<<<grid,block,shmem>>>(a,b,c)` 를 드라이버 API로 풀어 쓴 것이 이 판의 `launch()` 헬퍼입니다.

```c
static CUresult launch(CUfunction f, uint grid, uint block, uint shmem, void** args) {
    if (!f) return CUDA_ERROR_NOT_FOUND;
    return cuLaunchKernel(f,
                          grid, 1, 1,   // gridDim.{x,y,z}
                          block, 1, 1,  // blockDim.{x,y,z}
                          shmem,        // 동적 공유 메모리 바이트
                          0,            // 스트림(기본)
                          args,         // 커널 인자 포인터 배열
                          0);           // extra
}
```

**가장 큰 차이는 인자 전달**입니다. `<<<>>>` 는 컴파일러가 인자를 자동으로 포장하지만, 드라이버 API는 **각 인자의 주소를 담은 `void*` 배열**을 직접 만듭니다.

```c
// 런타임 API (원본)
deviceVerifyConstant<<<nBlocks, nThreads, sizeof(uint)*nThreads>>>(base, N, constant, blockErrorCount);

// 드라이버 API (이 판)  — 각 인자의 "주소"를 배열로
void* args[] = { &base, &N, &constant, &blockErrorCount };
launch(K("deviceVerifyConstant"), nBlocks, nThreads, sizeof(uint)*nThreads, args);
```

```mermaid
flowchart LR
    subgraph RT["런타임 API"]
        R1["kernel&lt;&lt;&lt;grid,block,shmem&gt;&gt;&gt;(a,b,c)"] --> R2["컴파일러가<br/>인자 자동 마샬링"]
    end
    subgraph DR["드라이버 API"]
        D1["void* args[] = { &amp;a, &amp;b, &amp;c }"] --> D2["cuLaunchKernel(f,<br/>grid,1,1, block,1,1,<br/>shmem, 0, args, 0)"]
    end
    RT -.동등.- DR

    classDef host fill:#12212A,stroke:#3FB8C4,color:#3FB8C4;
    class R1,R2,D1,D2 host;
```

> **주의**: `args[]` 에는 값이 아니라 **주소**가 들어갑니다. 그래서 임시값도 lvalue여야 합니다 — `gpuModuloX` 가 `pattern2` 같은 지역 변수를 따로 두는 이유입니다. `shmem`(동적 공유 메모리 바이트 수)은 검증 커널의 `threadErrorCount[]` 리덕션 버퍼 크기(`sizeof(uint)*nThreads`)로 넘어갑니다.

## B.6 완료 대기 — `SOFTWAIT` = `cuStreamQuery` 폴링

커널 런치는 **비동기**라 곧바로 반환됩니다. 결과를 CPU로 복사하기 전에 완료를 기다려야 합니다. 이 판은 바쁜 대기 대신 **슬립 폴링(sleep-poll)** 을 씁니다(`memtestG80_core.h`).

```c
inline int _pollStatus(unsigned length=1, unsigned limit=15000) {
    unsigned startTime = getTimeMilliseconds();
    while (cuStreamQuery(0) == CUDA_ERROR_NOT_READY) {   // 아직 실행 중?
        if ((getTimeMilliseconds() - startTime) > limit) return -1;  // 타임아웃
        SLEEPMS(length);                                 // 잠깐 자고 다시 확인
    }
    return 0;
}
#define SOFTWAIT() if (_pollStatus() != 0) { return MEMTEST_TIMEOUT; }
```

- `cuStreamQuery(0)` 가 `CUDA_ERROR_NOT_READY` 를 돌려주는 동안 1ms씩 자며 대기 → CPU를 100% 태우지 않음.
- 15초를 넘기면 **타임아웃 센티넬**(`MEMTEST_TIMEOUT = 0xFFFFFFFE`)을 반환. 런치 실패는 `MEMTEST_LAUNCH_FAILED = 0xFFFFFFFF`. (원본과 동일한 관례.)

## B.7 한 번의 테스트 호출 — 호스트↔드라이버↔GPU 시퀀스

`gpuVerifyConstant` 한 번이 실제로 밟는 경로:

```mermaid
sequenceDiagram
    participant H as 호스트 (core.cpp)
    participant D as CUDA 드라이버
    participant G as GPU

    H->>D: K("deviceVerifyConstant")  (cuModuleGetFunction, 캐시)
    D-->>H: CUfunction
    H->>D: cuLaunchKernel(f, 1024,1,1, 512,1,1, shmem, 0, args, 0)
    D->>G: 커널 디스패치 (비동기)
    Note over H,D: SOFTWAIT — cuStreamQuery(0) 폴링
    loop 완료까지 (최대 15s)
        H->>D: cuStreamQuery(0)
        D-->>H: CUDA_ERROR_NOT_READY / SUCCESS
    end
    G-->>D: 커널 완료 (블록별 오류 수 기록)
    H->>D: cuMemcpyDtoH(errorCounts, blockErrorCount, ...)
    D-->>H: 블록별 오류 배열
    Note over H: CPU에서 nBlocks개 합산 → 총 오류 수
```

이 시퀀스가 13종 테스트마다 반복되고, 그 전체가 `maxIters` 번 반복됩니다(`memtestG80_cli.cpp` 의 메인 루프).

## B.8 정리 — 자원 해제

```c
tester.deallocate();          // cuMemFree
memtestG80_unloadKernels();   // cuModuleUnload → g_module=0, 캐시 clear
cuCtxDestroy(cuCtx);          // 컨텍스트 파괴
```

로드했던 것을 역순으로 해제합니다. `memtestState` 는 소멸자에서 `deallocate()` 를 부르는 **RAII**(자원 획득이 곧 초기화) 패턴이라, 메모리 해제는 예외/조기 반환에도 안전합니다.

---

## PART C — 런타임 API ↔ 드라이버 API 대응표

| 작업 | 런타임 API (원본) | 드라이버 API (이 판) |
|---|---|---|
| 초기화 | (자동) | `cuInit`, `cuCtxCreate` |
| 디바이스 열거 | `cudaGetDeviceCount` / `cudaGetDeviceProperties` | `cuDeviceGetCount` / `cuDeviceGetName` / `cuDeviceGetAttribute` |
| **커널 로딩** | (실행 파일에 fatbin 내장) | **`cuModuleLoad(cubin)` → `cuModuleGetFunction`** |
| **커널 실행** | `kernel<<<grid,block,shmem>>>(args)` | **`cuLaunchKernel(func, grid,1,1, block,1,1, shmem, 0, args, 0)`** |
| 메모리 할당 | `cudaMalloc` / `cudaFree` | `cuMemAlloc` / `cuMemFree` |
| 메모리 복사 | `cudaMemcpy(...,DtoH/DtoD)` | `cuMemcpyDtoH` / `cuMemcpyDtoD` |
| 완료 대기 | `cudaStreamQuery(0)` | `cuStreamQuery(0)` |
| 동기화 | `cudaThreadSynchronize` | `cuCtxSynchronize` |
| 디바이스 포인터 | `uint*` | `CUdeviceptr` (바이트 주소) |
| 링크 라이브러리 | `-lcudart` | **`-lcuda`** |

---

## PART D — 직접 해보기 (Hands-on)

> GPU와 CUDA 툴킷이 있는 리눅스 x64 환경 기준. 없다면 각 실습의 "관찰 포인트"만 읽어도 흐름을 이해할 수 있습니다.

### Exercise 1 — 빌드하고 cubin 안을 들여다보기
```bash
cd driver_api
make SMARCH=sm_75              # 자기 GPU 아키텍처로
ls -l memtestG80 memtestG80.cubin   # 실행 파일과 cubin이 "따로" 생김
cuobjdump -symbols memtestG80.cubin | grep device   # extern "C" 이름들이 그대로 보임
cuobjdump -sass memtestG80.cubin | head             # SASS 디스어셈블
```
**관찰**: cubin은 실행 파일과 **별도 파일**이다. 심볼 이름이 맹글링되지 않았다.

### Exercise 2 — 아키텍처 불일치로 로드 실패 재현
```bash
make clean && make SMARCH=sm_30   # 일부러 안 맞는 (구/타 세대) 아키텍처
./memtestG80 64 1                 # cuModuleLoad 실패 → 친절한 오류 메시지
```
**관찰**: cubin은 그 세대 전용이라, GPU와 안 맞으면 **로드 단계**에서 걸린다(빌드는 성공하는데 실행이 실패). → cubin의 이식성 한계.

### Exercise 3 — `MEMTESTG80_CUBIN` 으로 경로 바꾸기
```bash
mv memtestG80.cubin /tmp/k.cubin
./memtestG80 64 1                       # 이제 못 찾음 (또는 cwd 탐색 실패)
MEMTESTG80_CUBIN=/tmp/k.cubin ./memtestG80 64 1   # 환경변수로 지정 → 로드 성공
```
**관찰**: `findCubin()` 의 탐색 우선순위(환경변수 → 실행 파일 옆 → cwd)를 눈으로 확인.

### Exercise 4 — cubin 대신 PTX로 바꾸기
Makefile에서 `-cubin` → `-ptx`, `CUBIN = memtestG80.ptx` 로 바꾸고 재빌드.
```bash
# 로드 코드(cuModuleLoad)는 그대로 — findCubin/파일명만 ptx로 맞추면 됨
```
**관찰**: PTX는 드라이버가 실행 시 JIT 컴파일하므로 **다른 세대 GPU에서도** 로드된다(첫 실행이 살짝 느림). cubin↔PTX 이식성 트레이드오프 체감.

### Exercise 5 — 커널을 하나 추가해 이름으로 로드해 보기
`memtestG80_kernels.cu` 의 `extern "C" { … }` 안에 간단한 커널을 추가하고, 호스트에서 `K("myKernel")` 로 조회·실행.
**관찰**: `extern "C"` 를 빼면 `cuModuleGetFunction` 이 이름을 못 찾는다(맹글링 확인) → A.2의 이유를 몸으로 이해.

---

## 부록 — 자주 겪는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| `cuModuleLoad` 실패 / `failed to load kernel module` | cubin 아키텍처(`SMARCH`)가 GPU와 불일치 | GPU의 compute capability 확인 후 `make SMARCH=sm_XX` 재빌드 (또는 PTX 사용) |
| cubin을 못 찾음 | 실행 파일과 다른 폴더에서 실행 | `MEMTESTG80_CUBIN` 지정 또는 실행 파일 옆에 cubin 배치 |
| 링크 시 `undefined reference to cu...` | `-lcuda` 누락 | `LDFLAGS` 에 `-lcuda` 확인 |
| 링크 시 `cannot find -lcuda` | `libcuda.so` 경로 없음 | `-L$(CUDA_STUB)`(stubs) 추가 확인 |
| `cuLaunchKernel` 인자 오류/크래시 | `args[]` 에 값이 아닌 **주소**를 넣어야 함 | 각 인자를 lvalue로 두고 `&` 로 주소 전달 |
| 타임아웃 센티넬(`0xFFFFFFFE`) | 커널이 15초 초과(과도한 크기/워치독) | 테스트 크기 축소, 디스플레이 GPU면 워치독 유의 |

---

## 한눈 요약

- **빌드**: 커널 `.cu` → `nvcc -cubin` → **별도 cubin**, 호스트 `.cpp` → `g++` → **실행 파일**(`-lcuda`). 둘은 빌드 시 독립.
- **로딩**: 실행 중 `cuModuleLoad`(파일→모듈) → `cuModuleGetFunction`(이름→함수, `extern "C"` 덕분) → `cuLaunchKernel`(`void* args[]` 로 인자 전달).
- **대기/정리**: `SOFTWAIT`(=`cuStreamQuery` 폴링) → `cuMemcpyDtoH` → 합산; 끝나면 `cuMemFree`/`cuModuleUnload`/`cuCtxDestroy`.
- 런타임 API가 자동으로 해 주던 초기화·커널 내장·인자 마샬링을, 드라이버 API에서는 **개발자가 명시적으로** 수행한다 — 그래서 "커널이 어떻게 로드되는가"를 눈으로 배울 수 있다.

## 참고
- 원본 소스: `driver_api/` (README: `driver_api/README.md`)
- 런타임 API 원본과 비교: 본편 세션 1(커널 실행)·세션 5(3계층 API)
- NVIDIA CUDA Driver API 공식 문서 (`cuModuleLoad`, `cuLaunchKernel`)
