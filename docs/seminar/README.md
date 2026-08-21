# MemtestG80 심층 분석 — 세미나 자료

CUDA로 구현된 오픈소스 GPU 메모리 테스터 **MemtestG80**의 내부 구조를 코드로 읽는 세미나 자료입니다.

## 파일

| 파일 | 설명 |
|------|------|
| [`memtestG80-seminar.html`](./memtestG80-seminar.html) | 16장짜리 발표 슬라이드 덱 (브라우저에서 바로 열기). 방향키/스페이스/스와이프로 이동, 하단 도트로 점프. |
| `README.md` | 발표자 노트 및 슬라이드별 요약 (이 문서) |

슬라이드 조작: `←` `→` `Space` 이동 · `Home`/`End` 처음·끝 · 하단 도트 클릭 점프 · URL 해시(`#7`)로 특정 슬라이드 딥링크.

---

## 발표자 노트 (슬라이드별)

### 1. 표지
- 주제: ECC 없는 GPU에서 조용히 발생하는 비트 오류를, 수십만 스레드의 병렬성으로 잡아내는 도구를 코드로 읽는다.

### 2. 왜 GPU 메모리를 테스트하는가
- 소비자용 GPU는 대개 **ECC가 없다** → 비트 플립이 조용히 계산에 섞인다.
- 오버클럭·발열·전압 마진 부족은 **산발적(intermittent) 오류**를 만든다.
- CPU의 `Memtest86`는 GPU VRAM을 직접 두드릴 수 없다 → GPU 위에서 도는 테스터가 필요.
- README 인용: "문제 있는 카드조차 5만 번에 한 번 꼴로만 실패할 수 있다" → **크게, 오래** 돌려야 한다.

### 3. MemtestG80 개요
- Stanford Folding@home 팀, 2009, LGPL v3. Memtest86 테스트들의 CUDA 이식.
- **라이브러리 우선** 설계(`memtestG80_core.h`) + 예제 겸용 CLI(`memtestG80_cli.cu`).
- 기본 그리드 **1024 blocks × 512 threads = 524,288 스레드**.

### 4. CUDA 실행 모델 (배경)
- 커널(`__global__`)은 grid(→block→thread) 위에서 실행.
- 각 스레드는 `blockIdx.x`/`threadIdx.x`/`blockDim.x`로 자기 위치를 알아 담당 주소를 계산.
- 메모리 계층: **global**(VRAM=테스트 대상) / **shared**(블록 공유) / register.
- `__syncthreads()`가 병렬 리덕션의 열쇠. MemtestG80은 전부 **1차원 선형** 인덱싱.

### 5. 스레드 → 주소 매핑 `THREAD_ADDRESS` (핵심 ①)
```c
#define THREAD_ADDRESS(base,N,i) \
    (base + blockIdx.x*N*blockDim.x + i*blockDim.x + threadIdx.x)
```
- 이웃 스레드가 이웃 주소를 맡아 **메모리 coalescing** → 대역폭 최대화.
- 그리드당 테스트 용량 = `1024 × 512 × N × 4B = 2·N MiB`.

### 6. 쓰기 → 검증 뼈대 (핵심 ②)
- 모든 테스트 = 알려진 패턴 쓰기 → (필요 시 반전/반복) → 되읽어 비교.
- `deviceWriteConstant`: 각 스레드가 자기 word들을 채운다.

### 7. 오류 카운팅의 두 묘수 (핵심 ③ — 가장 영리)
- **묘수 1**: `BITSDIFF(x,y) = __popc((x)^(y))` → 뒤집힌 **비트 개수**를 센다(다중 비트 오류 포착).
- **묘수 2**: 스레드별 카운트를 shared memory 트리 리덕션으로 블록 내 합산 → 블록 합만 호스트로 복사 → CPU가 ~1k개 최종 합산.

### 8. 테스트 카탈로그
- 한 iteration이 13종 테스트를 순차 실행. Walking 계열은 shift(8/32/20)만큼 커널을 반복하므로 실제 실행 횟수는 더 많다.
- Memtest86 계보: #2 Moving Inversions, #3 Walking 8-bit, #4 random, #6 Walking 32-bit, #7 Random Blocks, #8 Modulo-20 (+ 고유 Logic 테스트).

### 9. Moving Inversions
- `0xFFFFFFFF` 쓰고 검증 → `0x0`으로 반전해 다시 검증. 모든 셀이 1과 0을 안정적으로 저장하는지 + 이웃 오염 검사.
- random 변형은 값 의존적 결함을 노린다.

### 10. Walking Bits
- **M86 8-bit**: `1<<shift`를 32비트로 복제해 전 영역 동일 기록·검증 + 보수 검증.
- **True Walking 8-bit**: 워드 내에서 비트가 실제 이동 → 인접 라인 결합 결함에 민감.
- **32-bit**: 32비트 전 폭에서 단일 비트 이동(shift 0~31).

### 11. Random Blocks & Modulo-20
- **Random Blocks**: `rand()` 시드로 **재현 가능한** 난수 기록, 검증 시 같은 시드로 재생성해 비교.
- **Modulo-20**: 20 word마다 패턴 배치, 나머지는 보수 → 주기적 주소 간섭 표적.

### 12. Logic Test — Short LCG (메모리가 아니라 연산)
- 짧은 주기 LCG를 `k·period`번 실행 → 결과는 항상 0으로 복귀하도록 설계. k가 달라도 결과가 같아야 하므로 차이=로직 오류.
- 짝 XOR(`^0xFFFFFFF0 ^0xF`)로 명령 다양성 확보(단일 XOR은 NOT으로 최적화돼 사라짐 — decuda로 검증).
- **shmem 버전**은 중간값을 shared memory에 둬 셰이더 오버클럭 오류에 민감.

### 13. 메모리 대역폭 측정
- D2D `cudaMemcpy` 반복 → **비동기**이므로 `cudaThreadSynchronize()` 후 타이밍. 읽기+쓰기라 대역폭 **×2**.

### 14. 3계층 API 아키텍처
- **Layer 3**: `memtestState` 클래스(OO, 사용자 권장) → **Layer 2**: `__host__ gpuXxx`(커널+동기화+리덕션) → **Layer 1**: `__global__ deviceXxx`(내부 커널).
- 네이밍: `gpuXxx`/`cpuXxx`=공개, `deviceXxx`=내부. `SOFTWAIT()`=스핀 대신 슬립 폴링.
- 센티넬: `0xFFFFFFFF`=런치 실패, `0xFFFFFFFE`=타임아웃.

### 15. 사용법 · 결과 해석
- `memtestG80 --gpu 2 256 100` (256MB, 100회, 3번째 GPU). 영역은 2MB 단위 반올림. 오류 있으면 종료 코드 non-zero.
- **40억 넘는 오류 = 진짜 결함 아님**, 드라이버 워치독 타임아웃. 영역 줄이면 사라짐.
- 원칙: 의심되면 **크게, 수천 회**.

### 16. 정리
1. 검증된 알고리즘(Memtest86)의 병렬 이식.
2. 단순한 뼈대(쓰고 되읽기) + 영리한 디테일(`__popc`, 병렬 리덕션).
3. 메모리 + 로직 둘 다 검증.
- 읽을 순서: `cli.cu` 메인 루프 → `core.cu`의 `THREAD_ADDRESS` → `deviceVerifyConstant` 리덕션.

---

## 참고 소스 위치

- `memtestG80_core.h` — 공개 API (`memtestState` 클래스, `gpuXxx` 선언)
- `memtestG80_core.cu` — 커널·호스트 함수 본체 (`THREAD_ADDRESS`는 26행, `deviceVerifyConstant`는 리덕션)
- `memtestG80_cli.cu` — CLI 메인 루프와 13종 테스트 실행 순서
