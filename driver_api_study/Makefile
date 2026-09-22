# Makefile — MemtestG80 (CUDA Driver API 판 · 교육용 간결 버전) · Linux x86-64 전용
#
# driver_api/ 판과의 차이:
#   - ezOptionParser.hpp 의존 제거 → 호스트 오브젝트는 core/cli 두 개뿐, 헤더 의존 단순화
#
# 구조:
#   1) 디바이스 커널(memtestG80_kernels.cu) → nvcc 로 **cubin** 컴파일
#   2) 호스트 코드(*.cpp)          → g++ 로 컴파일 (CUDA 런타임 불필요)
#   3) 링크                        → 드라이버 라이브러리(-lcuda)와 링크
#   4) 실행 시                     → 프로그램이 cubin 을 cuModuleLoad 로 로드
#
# 사용:
#   make                 # 기본: sm_52 로 cubin 빌드 + 실행 파일 링크
#   make SMARCH=sm_75    # 대상 GPU 아키텍처 지정 (T4=75, Ampere=86, Ada=89 …)
#   make clean

CUDA_PATH ?= /usr/local/cuda
NVCC      ?= $(CUDA_PATH)/bin/nvcc
CXX       ?= g++

# 대상 GPU 아키텍처 (SASS). 실제 GPU 에 맞게 바꾸세요.
SMARCH    ?= sm_52

# 헤더/라이브러리 경로
CUDA_INC  ?= $(CUDA_PATH)/include
CUDA_LIB  ?= $(CUDA_PATH)/lib64
CUDA_STUB ?= $(CUDA_PATH)/lib64/stubs

CXXFLAGS  ?= -O2 -Wall -m64 -I$(CUDA_INC)
LDFLAGS   ?= -L$(CUDA_LIB) -L$(CUDA_STUB) -lcuda

CUBIN     = memtestG80.cubin
OBJS      = memtestG80_core.o memtestG80_cli.o
TARGET    = memtestG80

all: $(CUBIN) $(TARGET)

# 1) 커널 → cubin (디바이스 전용 컴파일)
$(CUBIN): memtestG80_kernels.cu
	$(NVCC) -cubin -arch=$(SMARCH) -Xptxas -v -o $(CUBIN) memtestG80_kernels.cu

# 2) 호스트 오브젝트 (g++, 드라이버 API 헤더만 필요)
memtestG80_core.o: memtestG80_core.cpp memtestG80_core.h
	$(CXX) -c $(CXXFLAGS) -o memtestG80_core.o memtestG80_core.cpp

memtestG80_cli.o: memtestG80_cli.cpp memtestG80_core.h
	$(CXX) -c $(CXXFLAGS) -o memtestG80_cli.o memtestG80_cli.cpp

# 3) 링크 (드라이버 라이브러리)
$(TARGET): $(OBJS)
	$(CXX) -m64 -o $(TARGET) $(OBJS) $(LDFLAGS)

clean:
	rm -f *.o $(TARGET) $(CUBIN)

.PHONY: all clean
