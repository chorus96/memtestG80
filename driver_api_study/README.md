# MemtestG80 — CUDA Driver API **교육용 간결 버전** (`driver_api_study/`)

이 디렉터리는 [`driver_api/`](../driver_api/)(CUDA Driver API 판)를 **교재로 더 읽기 쉽게** 다듬어 가는 버전입니다.
목표는 **CUDA(빌드·커널 로딩·실행)와 직접 관련 없는 코드를 걷어내** 핵심만 남기는 것입니다.

> 원리·개념 설명은 세미나 부록을 참고하세요: [`docs/seminar/부록1_DriverAPI_빌드와_커널로딩.md`](../docs/seminar/부록1_DriverAPI_빌드와_커널로딩.md)

## `driver_api/` 대비 변경 (단계별)

1. **ezOptionParser.hpp 제거** ✅
   - 서드파티 명령행 파서(`ezOptionParser.hpp`)는 CUDA와 직접 관련이 없어 삭제했습니다.
   - `memtestG80_cli.cpp` 가 표준 C++ 만으로 인자를 직접 파싱합니다
     (`-g/--gpu N`, 위치 인자 `[MB] [iters]` — 동작·기본값은 동일).

2. **라이선스 출력 제거** ✅
   - `-l/--license` 플래그와 `print_licensing()`(라이선스 문구 출력)을 삭제했습니다. CUDA 동작과 무관한 부가 기능입니다.
   - (라이선스는 여전히 LGPL v3 — 코드 상단 주석·본 README 참조.)

3. **대역폭 측정 제거** ✅
   - 시작 시의 device-to-device 복사 기반 대역폭 측정 블록을 삭제했습니다.
   - 이제 쓰이지 않는 `gpuMemoryBandwidth`(free 함수 + `memtestState` 메서드)도 `core`에서 함께 제거했습니다.

4. **13종 테스트 → 대표 1종만** ✅
   - CLI 테스트 루프를 **Moving Inversions (ones and zeros)** 한 종류만 남겼습니다.
   - 이 테스트는 **쓰기 커널(`deviceWriteConstant`)** 과 **공유 메모리 트리 리덕션이 있는 검증 커널(`deviceVerifyConstant`)** 을 모두 사용해, 커널 로딩·실행 흐름을 온전히 보여줍니다.
   - 여러 테스트의 합산용 배열(`errorCounts[]`)·미사용 변수·`<cstring>` include도 함께 정리했습니다.
   - ⚠️ 아직 `core`/`kernels.cu` 에는 지금 쓰이지 않는 다른 테스트용 함수·커널이 남아 있습니다(다음 단계에서 정리 예정).

## 구성

| 파일 | 역할 |
|---|---|
| `memtestG80_kernels.cu` | 디바이스 커널 (`__global__`/`__device__`, `extern "C"`) → cubin |
| `memtestG80_core.h` | 공개 API (`memtestState`, SOFTWAIT, 센티넬, 모듈 관리) |
| `memtestG80_core.cpp` | 호스트 구현 (모듈 로딩, `cuLaunchKernel`, `cuMem*`) |
| `memtestG80_cli.cpp` | `main()` — 디바이스/컨텍스트/cubin 로드 + 13종 테스트 (인자 파싱 자체 구현) |
| `Makefile` | Linux x64 빌드 (cubin + 호스트 링크 `-lcuda`) |

## 빌드 & 실행

```bash
cd driver_api_study
make SMARCH=sm_75        # 대상 GPU 아키텍처 지정
./memtestG80 128 50      # 128MB, 50회
./memtestG80 --gpu 0 256 100
```

- 대상: **Linux x86-64 전용** · 단일 GPU
- 라이선스: LGPL v3 (원본과 동일)
