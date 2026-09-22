# Makefile — MemtestG80 (CUDA Driver API 판 · 교육용 간결 버전) · Linux x86-64 전용
#
# driver_api/ 판과의 차이:
#   - ezOptionParser.hpp 제거, memtestG80_core.{h,cpp} 를 cli.cpp 로 합침
#     → 호스트는 단일 파일(memtestG80_cli.cpp) + 커널(memtestG80_kernels.cu) 뿐
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
TARGET    = memtestG80

all: $(CUBIN) $(TARGET)

# 1) 커널 → cubin (디바이스 전용 컴파일)
$(CUBIN): memtestG80_kernels.cu
	$(NVCC) -cubin -arch=$(SMARCH) -Xptxas -v -o $(CUBIN) memtestG80_kernels.cu

# 2) 호스트 (단일 파일) → 컴파일 + 드라이버 라이브러리 링크
$(TARGET): memtestG80_cli.cpp
	$(CXX) $(CXXFLAGS) -o $(TARGET) memtestG80_cli.cpp $(LDFLAGS)

clean:
	rm -f *.o $(TARGET) $(CUBIN)

.PHONY: all clean
