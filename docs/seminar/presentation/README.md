# 발표 자료 한국어판 — *Hard Data on Soft Errors* (LACSS 2010)

MemtestG80 논문의 **발표 슬라이드**(Imran Haque, Resilience Summit @ LACSS, 2010-10-13)를 한국어로 번역한 PPTX입니다.
이 발표본은 논문(2009)에 **Fermi(GF100)·AMD/CPU 후속 결과**를 더한 확장판입니다.

## 파일

| 파일 | 내용 |
|---|---|
| [`소프트오류_실측데이터_LACSS2010_한국어.pptx`](소프트오류_실측데이터_LACSS2010_한국어.pptx) | 번역 발표 덱 (21슬라이드) |
| `gpuser_lacss_oct_2010.pdf` | 원본 발표 PDF (영문) |
| `slides/build_talk.js` | 위 PPTX를 생성한 pptxgenjs 스크립트 |
| `slides/images/` | 원 PDF에서 추출한 차트 6종 (양성 대조, 카드 수, 결과 CDF, 아키텍처별, GeForce vs Tesla, 상호정보량) |

## 구성 (21슬라이드)

표지 → 동기(2·3) → MemtestG80/CL 개요(4) → 검증: 음성·양성 대조(5·6·7) →
방법론: Folding@home(8·9) → 결과 분포(10·11) → 분석: 아키텍처·Tesla·상호정보량(12·13·14) →
**Fermi(15·16)** → **AMD·CPU(17·18)** → 감사의 글(19) → 요약(20) → 결론(21).

차트 6종은 원 PDF에서 추출해 삽입했고, 슬라이드 9의 카드 분포 표는 한국어로 재작성했습니다.

## 다시 만들기

```bash
cd slides
npm install pptxgenjs          # 최초 1회 (또는 상위 seminar/slides 의 설치 재사용)
node build_talk.js             # ../소프트오류_실측데이터_LACSS2010_한국어.pptx 생성
```

> 한글 폰트는 **맑은 고딕(Malgun Gothic)**, 코드/수치는 **Courier New**. 흰 배경 학술 테마로,
> 원 PDF의 흰 배경 차트가 자연스럽게 어울립니다. PowerPoint(한국어 Office)에서 정상 표시됩니다.

## 관련 자료

- 논문 전체 번역(EPUB): [`../소프트오류_실측데이터_GPGPU_한국어판.epub`](../소프트오류_실측데이터_GPGPU_한국어판.epub)
- 원논문 PDF: [`../paper/haque_pande_2009_memtestG80.pdf`](../paper/haque_pande_2009_memtestG80.pdf)
