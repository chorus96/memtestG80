# MemtestG80 오픈소스 에디션 README (한국어판)

> 이 문서는 저장소 루트 [`README.md`](README.md)의 한국어 번역판입니다. 원문이 갱신되면 이 파일도 함께 갱신하세요.
> 명령·플래그·파일명 등 코드 표기는 원문 그대로 두었습니다.

## 목차

1. 설명
2. 빌드 방법
3. MemtestG80을 라이브러리로 사용하기
4. CLI 독립 실행형 — 기본 사용법
5. CLI 독립 실행형 — 고급 사용법
6. 자주 묻는 질문(FAQ)
7. 라이선스


## 설명

MemtestG80은 NVIDIA CUDA 지원 GPU의 메모리와 로직에 오류가 있는지 시험하는 프로그램입니다.

이것은 MemtestG80의 오픈소스 버전으로, 폐쇄형(closed-source) 버전과 동일한 메모리 테스트를 구현합니다.
의도된 사용 방식은 **라이브러리**로 쓰는 것으로, 다른 소프트웨어 개발자가 자신의 코드에서 GPU의 올바른
동작을 검증하는 데 MemtestG80 테스트를 활용할 수 있도록 하는 것입니다. 핵심 메모리 테스트 라이브러리에
더해, 이 패키지에는 폐쇄형 빌드에 포함된 명령행 인터페이스(CLI) 독립 실행형 테스터의 제한된 버전 소스
코드가 들어 있습니다. 결과를 Stanford로 전송하는 기능 같은 일부 기능은 오픈소스 버전에는 없습니다.

폐쇄형 버전은 https://simtk.org/home/memtest 에서 찾을 수 있습니다. 오픈소스 버전은
http://github.com/ihaque/memtestG80 에 있습니다.

이 문서는 오픈소스 버전에 관한 것입니다.

## 빌드 방법

먼저, `nvcc` 툴체인을 실행하고 CUDA 프로그램을 정상적으로 구동할 수 있도록, CUDA 툴킷의 바이너리와
라이브러리가 시스템의 적절한 경로 변수에 포함되어 있는지 확인하세요.

32비트·64비트 Linux, Mac OS X, 32비트 Windows용 Makefile이 포함되어 있습니다. 소스 패키지의 루트에서
다음을 실행하면 MemtestG80을 빌드할 수 있습니다.

    make -f Makefiles/Makefile.OS

여기서 `OS`는 linux32, linux64, osx, windows 중 하나입니다. Windows에서는 Microsoft nmake가 아니라
(예를 들어 Cygwin에 포함된) GNU make를 사용한다고 가정합니다.

생성된 실행 파일 memtestG80은 Linux와 OS X 플랫폼에서는 바로 실행할 수 있습니다. Windows에서는
libiconv-2.dll, libintl-2.dll, popt1.dll을 popt/win32 하위 디렉터리에서 DLL 검색 경로상의 디렉터리
(가장 편리하게는 소스 배포판의 루트)로 복사해야 합니다. MemtestG80은 명령행 인자 처리에 MIT/X 라이선스의
popt 라이브러리를 사용합니다. 사전 컴파일된 정적 라이브러리가 Linux와 OS X용으로 제공되며, Windows용은
동적 라이브러리로 제공됩니다.

## MEMTESTG80을 라이브러리로 사용하기

우리는 소프트웨어 개발자가 자신의 프로그램에서 실행 대상 GPU의 올바른 동작을 검증하기 위해 MemtestG80을
코드 라이브러리로 사용하기를 권장합니다. 이 코드는 LGPL로 라이선스되므로, 오픈소스·클로즈드소스 소프트웨어
개발자 모두 사용할 수 있습니다. 클로즈드소스 소프트웨어 개발자는 공유 라이브러리(.so, .dll) 방식으로
MemtestG80에 링크해야 하며, 오픈소스 소프트웨어는 정적 링크로 통합할 수 있습니다.

메모리 테스트용 API는 memtestG80_core.h에 정의되어 있습니다. 두 가지 API가 있습니다 — CUDA `__host__`
함수로 정의된 저수준 API와, memtestState 클래스로 정의된 고수준 API입니다. 더 낮은 수준에서는 개별
테스트가 CUDA `__global__` 함수로 구현되어 있습니다. 명명 규칙은 memtestG80_core.cu의 주석에 설명되어
있습니다.

일반적으로 사용 편의를 위해 고수준(객체지향) API 사용을 권장합니다. API 사용 예시는 독립 실행형 테스터
memtestG80_cli.cu에서 찾을 수 있습니다.

## CLI 독립 실행형 — 기본 사용법

MemtestG80은 Windows, Linux, Mac OS X 기반 머신에서 사용할 수 있습니다. 아래 설명에서 "MemtestG80"은
사용하는 운영체제용 배포판에 포함된 프로그램 이름으로 바꿔서 읽으세요.

MemtestG80은 명령행 애플리케이션입니다. 실행하려면 명령 프롬프트(Windows에서는 시작→실행→cmd, OS X에서는
Terminal.app)에서 시작합니다. 기본 동작은 명령 프롬프트에서 그냥 실행하면 됩니다.

    MemtestG80

기본적으로 MemtestG80은 첫 번째 비디오 카드의 메모리 128메가바이트를 대상으로, 테스트를 50회 이터레이션
실행합니다. 일반적인 머신에서는 이 매개변수로 각 이터레이션이 10초 이내에 완료됩니다(속도는 시험 대상
카드의 속도와 시험 메모리 양에 따라 달라집니다). 시험 메모리 양과 테스트 이터레이션 횟수는 다음과 같이
명령행 매개변수를 추가해 바꿀 수 있습니다.

    MemtestG80 [시험할 RAM 메가바이트 수] [테스트 이터레이션 횟수]

예를 들어, RAM 256메가바이트를 대상으로 테스트 100회 이터레이션으로 MemtestG80을 실행하려면 다음 명령을
실행합니다.

    MemtestG80 256 100

비디오 카드의 메모리 전부를 시험할 수는 없다는 점에 유의하세요. 일부는 운영체제가 사용하도록 예약되어
있기 때문입니다. 너무 큰 시험 영역을 지정하면 프로그램이 경고를 출력하고 종료합니다. 또한 시험 대상 GPU가
현재 그래픽 데스크톱을 구동 중이면, NVIDIA 드라이버가 테스트 실행에 시간 제한을 걸어 매우 큰 시험 영역에
대한 테스트가 타임아웃될 수 있습니다. 이는 테스트 오류 수가 **40억을 초과**하는 것으로 쉽게 알아챌 수
있으며, 더 작은 영역을 시험하면 사라집니다.

그래픽 카드에 문제가 있다고 의심되면(예: Folding@home 작업 단위 실행에 실패하는 경우), 실용적인 범위에서
가능한 한 큰 메모리 영역을 대상으로 수천 회의 테스트 이터레이션을 실행하기를 강력히 권장합니다. 우리의
테스트 경험상, "문제 있는" 카드조차 산발적으로만(예: 50,000회 테스트 이터레이션당 한 번) 실패할 수
있습니다. 다른 스트레스 테스트 도구와 마찬가지로, 안정성을 제대로 검증하려면 MemtestG80을 오랜 시간
실행해야 합니다.

## CLI 독립 실행형 — 고급 사용법

MemtestG80은 고급 기능을 활성화하는 다양한 명령행 플래그를 지원합니다. 플래그는 순서에 상관없이 지정할 수
있으며, 메모리 크기·이터레이션 횟수 매개변수보다 앞에 오거나 뒤에 올 수 있습니다(단, 메모리 크기는 항상
이터레이션 횟수보다 앞에 와야 합니다).

첫 번째가 아닌 다른 GPU에서 MemtestG80을 실행하려면 --gpu 또는 -g 플래그에 시험할 GPU의 인덱스(0부터
시작)를 전달합니다. 예를 들어 시스템의 세 번째 GPU에서 MemtestG80을 실행하려면 다음과 같이 합니다.

    MemtestG80 --gpu 2

끝으로, MemtestG80의 라이선스 계약을 표시하려면 --license 또는 -l 옵션을 지정합니다.

    MemtestG80 -l

## 6. 자주 묻는 질문(FAQ)

- **{ATI, NVIDIA 5/6/7 시리즈} 비디오 카드가 있는데 동작하지 않아요!**
        * 현재는 NVIDIA CUDA 지원 GPU만 지원됩니다. 이 문서 작성 시점 기준으로, NVIDIA 제품 중
          GeForce 8·9·GTX 시리즈, Quadro FX 시리즈, Tesla 시리즈만 CUDA를 지원합니다.

- **CUDA 지원 카드가 있는데도 여전히 동작하지 않아요!**
        * CUDA 지원 그래픽 드라이버가 설치되어 있어야 합니다. CUDA 드라이버를 얻으려면
          http://nvidia.com/cuda 의 Downloads 섹션을 참고하세요.

- **Windows에서 "cudart.dll"이 없다는 오류가 나요!**
        * 이는 CUDA 런타임 파일로, 현재 MemtestG80과 함께 재배포할 수 없습니다. 다만 이 파일의 한 버전이
          Folding@home GPU 클라이언트에 함께 제공되며, 그 파일을 MemtestG80 실행 디렉터리로 복사하면
          동작합니다.

## 라이선스

MemtestG80 오픈소스 에디션의 소스 코드는 Copyright 2009, Stanford University이며, GNU Lesser General
Public License 버전 3의 조건에 따라 라이선스됩니다.

> **번역 안내:** 아래 라이선스 전문은 **법적 효력을 갖는 공식 원문(영문)이므로 번역하지 않고 그대로**
> 싣습니다. 라이선스의 법적 해석은 언제나 영어 원문을 기준으로 하며, 전체 조건은 배포판에 포함된
> [`COPYING`](COPYING) 파일과 아래 원문을 참조하세요. (라이선스 텍스트를 번역한 것은 법적 근거로 사용할
> 수 없습니다.)

아래는 GNU Lesser General Public License 버전 3의 원문입니다 (원문 `README.md`의 라이선스 섹션과 동일):

```
           GNU LESSER GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <http://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.


  This version of the GNU Lesser General Public License incorporates
the terms and conditions of version 3 of the GNU General Public
License, supplemented by the additional permissions listed below.

  (전문은 저장소 루트의 README.md 라이선스 섹션 및 COPYING 파일을 참조하세요.)
```

전체 라이선스 조건은 원문 [`README.md`](README.md#licensing)의 "Licensing" 섹션과
[`COPYING`](COPYING) 파일에 수록되어 있습니다.
