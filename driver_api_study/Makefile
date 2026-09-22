# ============================================================================
# Makefile — MemtestG80 (CUDA Driver API · 교육용 최소 예제)  [Linux x86-64 전용]
# ============================================================================
#
# 【이 파일만 읽어도 되는 세미나 노트】
#
# ■ 왜 Makefile 이 필요한가
#   빌드는 두 갈래로 나뉩니다. (1) GPU에서 도는 "커널"과 (2) CPU에서 도는 "호스트"
#   프로그램은 서로 다른 컴파일러로 만들어야 합니다. make 는 "무엇을 무엇으로,
#   어떤 순서로 만드는지"를 규칙(rule)으로 적어 자동화하는 도구입니다.
#
# ■ Makefile 문법 3줄 요약
#   - 변수:      NAME = value , 사용은 $(NAME)
#   - `?=` :     "이미 정의돼 있지 않으면" 대입 (환경변수/커맨드라인으로 덮어쓰기 허용)
#                 예) `make SMARCH=sm_75` 하면 아래 SMARCH ?= sm_52 는 무시됨.
#   - 규칙:      target: prerequisites   (대상 : 재료들)
#                <TAB>recipe             (대상을 만드는 명령. 반드시 '탭'으로 들여쓰기!)
#                make 는 대상이 재료보다 오래됐을 때만 recipe 를 실행 → 바뀐 것만 재빌드.
#
# ■ 이 프로젝트의 빌드 흐름
#   1) memtestG80_kernels.cu  --(nvcc -cubin)-->  memtestG80.cubin   (GPU 바이너리)
#   2) memtestG80_cli.cpp      --(g++)--------->  memtestG80          (호스트 실행 파일)
#   3) 링크 시 드라이버 라이브러리 -lcuda 를 연결 (cuInit/cuLaunchKernel 등 cu* 제공)
#   4) 실행 시 프로그램이 memtestG80.cubin 을 cuModuleLoad 로 읽어 커널을 로드
#   ※ (1)과 (2)는 빌드 시점엔 서로 독립 — cubin과 실행 파일은 오직 실행 중에 만난다.
#
# ■ 사용법
#   make                 # 기본값(SMARCH=sm_52)으로 cubin + 실행 파일 빌드
#   make SMARCH=sm_75    # 대상 GPU 세대 지정 (Turing/T4=75, Ampere=86, Ada=89 …)
#   make clean           # 산출물 삭제
# ============================================================================

# ---- 도구·경로 변수 (모두 `?=` → 커맨드라인/환경변수로 덮어쓰기 가능) ----
CUDA_PATH ?= /usr/local/cuda          # CUDA 툴킷 설치 경로
NVCC      ?= $(CUDA_PATH)/bin/nvcc     # 디바이스(커널) 컴파일러
CXX       ?= g++                       # 호스트(C++) 컴파일러

# 대상 GPU 아키텍처 = 생성할 SASS(실제 기계어)의 세대.
#   cubin 은 이 세대 "전용"이라, 실제 GPU 와 맞지 않으면 실행 시 로드가 실패합니다.
#   본인 GPU 의 compute capability 에 맞춰 바꾸세요. (예: sm_75)
SMARCH    ?= sm_52

# 헤더/라이브러리 경로
CUDA_INC  ?= $(CUDA_PATH)/include       # cuda.h (드라이버 API 선언) 위치
CUDA_LIB  ?= $(CUDA_PATH)/lib64         # 라이브러리 위치
CUDA_STUB ?= $(CUDA_PATH)/lib64/stubs   # libcuda.so 스텁(빌드용 껍데기) 위치
                                        #   실제 드라이버가 없는 머신에서도 "링크"는 되게 해 줌.
                                        #   실행 시에는 시스템에 설치된 진짜 libcuda.so 가 로드됨.

# 호스트 컴파일 플래그: -O2 최적화, -Wall 경고 전체, -m64 64비트, -I 로 cuda.h 경로 추가.
CXXFLAGS  ?= -O2 -Wall -m64 -I$(CUDA_INC)
# 링크 플래그: 라이브러리 경로(-L) 지정 + 드라이버 라이브러리(-lcuda) 연결.
#   ※ 여기서 링크하는 건 런타임(-lcudart)이 아니라 "드라이버"(-lcuda) 입니다.
LDFLAGS   ?= -L$(CUDA_LIB) -L$(CUDA_STUB) -lcuda

# ---- 산출물 이름 ----
CUBIN     = memtestG80.cubin   # nvcc 가 만드는 GPU 바이너리
TARGET    = memtestG80         # g++ 가 만드는 실행 파일

# ---- 기본 대상: `make` 만 치면 all 이 실행됨 (첫 규칙이 기본 대상) ----
#   all 은 재료(cubin, target)를 요구 → make 가 아래 두 규칙을 알아서 순서대로 수행.
all: $(CUBIN) $(TARGET)

# 1) 커널 → cubin  (디바이스 전용 컴파일)
#    -cubin      : 링크 가능한 오브젝트가 아니라 "cubin"(GPU 바이너리)을 직접 산출
#    -arch=..    : 대상 SASS 세대 지정
#    -Xptxas -v  : PTX 어셈블러(ptxas)에 verbose 전달 → 커널의 레지스터/공유메모리 사용량 출력
#                  (점유율 occupancy 감을 잡는 데 유용)
$(CUBIN): memtestG80_kernels.cu
	$(NVCC) -cubin -arch=$(SMARCH) -Xptxas -v -o $(CUBIN) memtestG80_kernels.cu

# 2) 호스트(단일 파일) → 컴파일 + 링크를 한 번에
#    호스트 코드에는 디바이스 코드(<<<>>> 등)가 전혀 없어 nvcc 가 필요 없습니다.
#    필요한 건 cuda.h(드라이버 API 선언)와 -lcuda(구현) 뿐.
$(TARGET): memtestG80_cli.cpp
	$(CXX) $(CXXFLAGS) -o $(TARGET) memtestG80_cli.cpp $(LDFLAGS)

# 산출물 정리
clean:
	rm -f *.o $(TARGET) $(CUBIN)

# all/clean 은 실제 "파일 이름"이 아니라 명령 이름임을 make 에 알림
# (혹시 all/clean 이라는 파일이 있어도 규칙이 항상 실행되도록).
.PHONY: all clean
