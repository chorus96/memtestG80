// build_session0.js — 세션 0: 환경 구축과 큰 그림
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

// 1 — Title
titleSlide(
  "CUDA 세미나 · 세션 0",
  "환경 구축과 큰 그림",
  "MemtestG80 — 수십만 스레드로 GPU 메모리를 검증하는 오픈소스 도구",
  [ ln("$ make -f Makefiles/Makefile.linux64", C.AMBER2),
    ln("$ ./memtestG80 128 50      # 128MB, 50회 반복", C.TEAL) ]
);

// 2 — 목표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "오늘의 목표");
  const items = [
    ["GPU와 CPU의 차이", "처리량(throughput) vs 지연시간(latency)을 한 문장으로 설명할 수 있다"],
    ["MemtestG80 빌드·실행", "Makefile로 직접 빌드하고 128MB 테스트를 돌릴 수 있다"],
    ["이 도구가 푸는 문제", "GPU 메모리의 하드/소프트 오류가 무엇인지 설명할 수 있다"],
    ["출력 읽는 법", "한 iteration이 13종 테스트를 돌린다는 큰 그림을 안다"],
  ];
  let y = 1.7;
  items.forEach((it, i) => {
    card(s, M, y, W - 2*M, 1.06);
    s.addText(String(i+1), { x: M+0.22, y: y+0.2, w: 0.66, h: 0.66, align:"center", valign:"middle",
      fontFace: MONO, fontSize: 22, bold: true, color: C.BG, fill: { color: i%2 ? C.TEAL : C.AMBER }, shape: p.ShapeType.roundRect, rectRadius: 0.33 });
    s.addText(it[0], { x: M+1.15, y: y+0.14, w: W-2*M-1.4, h: 0.44, fontFace: KFONT, fontSize: 19, bold: true, color: C.TEXT, margin: 0, valign: "middle" });
    s.addText(it[1], { x: M+1.15, y: y+0.55, w: W-2*M-1.4, h: 0.42, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "middle" });
    y += 1.24;
  });
  s.addNotes("네 가지 목표를 예고하고, 세션 끝에 다시 돌아와 자가 점검하겠다고 알려주세요.");
})();

// 3 — CPU vs GPU + 왜 GPU 메모리 테스트
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "GPU는 왜 다른가, 왜 검사가 필요한가");
  const colW = (W - 2*M - 0.4) / 2;
  const mkCol = (x, title, color, rows) => {
    card(s, x, 1.7, colW, 3.4);
    s.addText(title, { x: x+0.3, y: 1.9, w: colW-0.6, h: 0.55, fontFace: KFONT, fontSize: 20, bold: true, color, margin: 0 });
    bullets(s, x+0.3, 2.55, colW-0.6, 2.4, rows, { fontSize: 15 });
  };
  mkCol(M, "CPU — 지연시간 최적화", C.TEAL, ["소수의 강력한 코어", "복잡한 분기·순차 작업에 강함", "큰 캐시, 정교한 분기 예측"]);
  mkCol(M+colW+0.4, "GPU — 처리량 최적화", C.AMBER, ["수천 개의 단순한 코어", "같은 연산을 대량 데이터에 동시에 (SIMT)", "메모리 대역폭이 핵심 (수백 GB/s)"]);
  card(s, M, 5.35, W-2*M, 1.4, "241A16", C.AMBER);
  s.addText([
    ln("소비자용 GPU는 대개 ECC(오류 정정)가 없다.", C.AMBER, { bold: true, breakLine: true, paraSpaceAfter: 4 }),
    ln("비트가 뒤집혀도 아무도 모른 채 잘못된 값이 계산에 섞인다 — 오버클럭·발열·전압 마진 부족이 원인. MemtestG80은 이 조용한 오류를 능동적으로 찾아낸다.", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: 5.5, w: W-2*M-0.6, h: 1.1, fontFace: KFONT, fontSize: 15, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  s.addNotes("SIMT = 같은 명령을 수천 스레드가 서로 다른 데이터에 실행. ECC 부재가 이 도구의 존재 이유임을 강조하세요.");
})();

// 4 — MemtestG80이란
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "MemtestG80이란");
  s.addText("Stanford Folding@home 팀이 만든, Memtest86의 메모리 테스트를 CUDA 커널로 이식한 도구 (2009, LGPL v3).", {
    x: M, y: 1.6, w: W-2*M, h: 0.6, fontFace: KFONT, fontSize: 17, color: C.MUTED, margin: 0 });
  const cards = [
    ["라이브러리 우선", C.TEAL, "개발자가 자기 코드에 링크해 실행 전 GPU 건전성 검증. 핵심 API = memtestG80_core.h"],
    ["+ CLI 프런트엔드", C.AMBER, "memtestG80_cli.cu는 사용 예제이자 독립 실행형 테스터. 13종 테스트 순차 실행"],
    ["단일 GPU · 이식성", C.TEAL, "--gpu N 으로 카드 선택. Linux/macOS/Windows Makefile 제공"],
  ];
  const cw = (W - 2*M - 0.8) / 3;
  cards.forEach((c, i) => {
    const x = M + i*(cw+0.4);
    card(s, x, 2.35, cw, 2.1);
    s.addText(c[0], { x: x+0.25, y: 2.55, w: cw-0.5, h: 0.5, fontFace: KFONT, fontSize: 18, bold: true, color: c[1], margin: 0 });
    s.addText(c[2], { x: x+0.25, y: 3.1, w: cw-0.5, h: 1.25, fontFace: KFONT, fontSize: 14, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  });
  const stats = [["1024 × 512", "기본 그리드 — 블록 × 스레드 = 524,288 스레드", C.AMBER], ["2·N MiB", "N words/스레드일 때 한 그리드가 덮는 메모리", C.TEAL]];
  stats.forEach((st, i) => {
    const x = M + i*((W-2*M)/2);
    s.addText(st[0], { x, y: 4.8, w: (W-2*M)/2, h: 0.7, fontFace: MONO, fontSize: 34, bold: true, color: st[2], margin: 0 });
    s.addText(st[1], { x, y: 5.55, w: (W-2*M)/2 - 0.3, h: 0.7, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "top" });
  });
  s.addNotes("cuda_memtest와 달리 MemtestG80은 블록당 스레드가 512개 — 병렬 리덕션·coalescing이 이 도구의 특징. 세션 1·3에서 깊게 다룹니다.");
})();

// 5 — 코드베이스 지도
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "코드베이스 지도 · 파일은 단 4개");
  const rows = [
    ["memtestG80_core.h", "공개 API — memtestState 클래스, 매크로(THREAD_ADDRESS 등)", "세션 1,5", C.AMBER],
    ["memtestG80_core.cu", "핵심 — 모든 커널·호스트 함수·리덕션·대역폭", "세션 1~4", C.TEAL],
    ["memtestG80_cli.cu", "main() — 13종 테스트를 순차 실행하는 프런트엔드", "세션 0,5", C.AMBER],
    ["ezOptionParser.hpp", "헤더 전용 명령행 인자 파서 (보조)", "—", C.FAINT],
  ];
  let y = 1.8;
  rows.forEach((r) => {
    card(s, M, y, W-2*M, 0.95);
    s.addText(r[0], { x: M+0.3, y: y+0.1, w: 4.3, h: 0.72, valign: "middle", fontFace: MONO, fontSize: 16, bold: true, color: r[3], margin: 0 });
    s.addText(r[1], { x: M+4.8, y: y+0.1, w: W-2*M-6.6, h: 0.72, valign: "middle", fontFace: KFONT, fontSize: 14.5, color: C.TEXT, margin: 0 });
    s.addText(r[2], { x: W-M-1.7, y: y+0.1, w: 1.5, h: 0.72, align: "right", valign: "middle", fontFace: KFONT, fontSize: 13, color: C.MUTED, margin: 0 });
    y += 1.1;
  });
  s.addText("500여 줄의 프로덕션 CUDA 코드 — 장난감 예제가 아니라 실제로 GPU 오류를 찾는 도구를 교재로 삼습니다.", {
    x: M, y: 6.5, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, align: "center", margin: 0 });
  s.addNotes("core.cu 하나에 커널·호스트·리덕션이 다 있음. 세션마다 이 지도를 다시 펴서 오늘 다룰 곳을 짚으세요.");
})();

// 6 — 빌드
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "빌드하기 · Makefile");
  s.addText("CMake가 아니라 OS별 Makefile을 씁니다. nvcc 툴체인이 PATH에 있어야 합니다.", {
    x: M, y: 1.6, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 16, color: C.MUTED, margin: 0 });
  codePanel(s, M, 2.15, W-2*M, 1.7, [
    ln("# 저장소 루트에서 OS에 맞는 Makefile 선택", C.FAINT),
    ln("make -f Makefiles/Makefile.linux64     # linux32 / osx / windows 도 있음", C.AMBER2),
    ln("", C.TEXT),
    ln("# 산출물", C.FAINT),
    ln("./memtestG80                            # 즉시 실행 가능", C.TEAL),
  ], { fontSize: 13.5 });
  codePanel(s, M, 4.15, W-2*M, 1.7, [
    ln("# Makefile.linux64 핵심", C.FAINT),
    ln("NVCC = nvcc", C.TEXT),
    ln("NVCCFLAGS = -DLINUX -O2 -Xptxas -v -m64   # -Xptxas -v = 레지스터/shmem 사용량 출력", C.AMBER2),
    ln("memtestG80: memtestG80_core.o memtestG80_cli.cu", C.TEXT),
    ln("        $(NVCC) $(NVCCFLAGS) -o memtestG80 memtestG80_core.o memtestG80_cli.cu", C.TEXT),
  ], { fontSize: 12.5 });
  s.addText("-Xptxas -v 플래그는 커널의 레지스터·공유 메모리 사용량을 보여줍니다 — 세션 3에서 유용합니다.", {
    x: M, y: 6.1, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("빌드 실패 대부분은 CUDA_DIR 경로 문제. Makefile 상단의 CUDA_DIR를 자기 환경에 맞추라고 안내하세요.");
})();

// 7 — 실행과 출력
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "실행하고 출력 읽기");
  codePanel(s, M, 1.65, W-2*M, 1.35, [
    ln("./memtestG80                 # 기본: GPU 0, 128MB, 50 iters", C.AMBER2),
    ln("./memtestG80 256 100         # 256MB를 100회", C.TEXT),
    ln("./memtestG80 --gpu 2 512 20  # 3번째 GPU, 512MB, 20회", C.TEAL),
  ], { fontSize: 13.5 });
  codePanel(s, M, 3.2, W-2*M, 3.0, [
    ln("Running 50 iterations of tests over 128 MB ...", C.FAINT),
    ln("  Estimated bandwidth 142000.00 MB/s", C.TEAL),
    ln("Test iteration 1 (GPU 0, 128 MiB): 0 errors so far", C.TEXT),
    ln("  Moving Inversions (ones and zeros): 0 errors (12 ms)", C.TEXT),
    ln("  Memtest86 Walking 8-bit: 0 errors (85 ms)", C.TEXT),
    ln("  ...  (한 iteration 당 13종 테스트)", C.FAINT),
    ln("Final error count after 50 iterations ...: 0 errors", C.AMBER2),
  ], { fontSize: 13 });
  s.addText("테스트 영역은 2MB 단위로 반올림. 오류가 있으면 종료 코드가 non-zero → 스크립트 연동이 쉽습니다.", {
    x: M, y: 6.4, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("첫 줄의 대역폭 측정 후 iteration 루프가 돈다는 구조를 보여주세요. 각 테스트는 세션 4에서 하나씩 해부합니다.");
})();

// 8 — 하드/소프트 오류
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "이 도구가 찾는 것 · 하드 vs 소프트 오류");
  const colW = (W - 2*M - 0.4) / 2;
  card(s, M, 1.8, colW, 4.3, C.CARD, C.RED);
  s.addText("하드 오류 (hard error)", { x: M+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 20, bold: true, color: C.RED, margin: 0 });
  bullets(s, M+0.3, 2.65, colW-0.6, 3.3, [
    "항상 재현되는 물리적 결함",
    "특정 셀이 stuck-at-0 / stuck-at-1",
    "인접 셀·데이터 라인 단락",
    "제조 결함, 영구 손상",
    "→ Walking/Moving 패턴 테스트로 검출",
  ], { fontSize: 15 });
  const x2 = M+colW+0.4;
  card(s, x2, 1.8, colW, 4.3, C.CARD, C.AMBER);
  s.addText("소프트 오류 (soft error)", { x: x2+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 20, bold: true, color: C.AMBER, margin: 0 });
  bullets(s, x2+0.3, 2.65, colW-0.6, 3.3, [
    "간헐적으로만 나타나는 오류",
    "오버클럭·발열·전압 마진 부족",
    "우주선(cosmic ray) 비트 플립",
    "5만 번에 한 번 꼴로도 발생 가능",
    "→ 크게·오래 반복해야 잡힘",
  ], { fontSize: 15 });
  s.addNotes("소프트 오류는 산발적이라 '오래 돌려라'가 핵심 메시지. 안정성 검증은 스트레스 테스트임을 각인시키세요.");
})();

// 9 — 실습 미리보기
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "8", "실습 미리보기 · Lab 0");
  const labs = [
    ["Ex 1", "빌드하기", "Makefile로 memtestG80를 빌드한다", C.AMBER],
    ["Ex 2", "기본 실행", "./memtestG80 로 128MB 테스트를 돌린다", C.TEAL],
    ["Ex 3", "GPU 관찰", "nvidia-smi로 사용률·메모리를 관찰한다", C.AMBER],
    ["Ex 4", "인자 실험", "메모리 크기·반복 수를 바꿔 실행 시간 비교", C.TEAL],
  ];
  const cw = (W - 2*M - 0.5) / 2, ch = 2.1;
  labs.forEach((l, i) => {
    const x = M + (i%2)*(cw+0.5);
    const y = 1.75 + Math.floor(i/2)*(ch+0.35);
    card(s, x, y, cw, ch);
    s.addText(l[0], { x: x+0.28, y: y+0.22, w: 1.3, h: 0.55, align: "center", valign: "middle", fontFace: MONO, fontSize: 17, bold: true, color: C.BG, fill: { color: l[3] }, shape: p.ShapeType.roundRect, rectRadius: 0.08 });
    s.addText(l[1], { x: x+1.75, y: y+0.24, w: cw-2.0, h: 0.9, fontFace: KFONT, fontSize: 18, bold: true, color: C.TEXT, margin: 0, valign: "top" });
    s.addText(l[2], { x: x+0.28, y: y+1.2, w: cw-0.56, h: 0.8, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  });
  s.addNotes("GPU가 없는 참석자는 Google Colab(무료 GPU)로 대체. 강사는 실행 로그를 미리 캡처해 두세요.");
})();

// 10 — 정리/예고
outroSlide(
  "다음 세션 예고",
  "세션 1 · CUDA 스레드 모델과 주소 매핑",
  [ ln("524,288개 스레드가 어떻게 각자 자기 메모리 주소를 찾을까?", C.TEXT, { breakLine: true, paraSpaceAfter: 6 }),
    ln("THREAD_ADDRESS 매크로 한 줄이 모든 테스트의 심장입니다.", C.MUTED, { breakLine: true }) ],
  [ ln("#define THREAD_ADDRESS(base,N,i) \\", C.AMBER2),
    ln("  (base + blockIdx.x*N*blockDim.x + i*blockDim.x + threadIdx.x)", C.TEAL) ],
  "실습 랩 0(빌드·실행)을 먼저 완료하고 오세요."
);

p.writeFile({ fileName: "세션0_환경구축과_큰그림.pptx" }).then((f) => console.log("wrote", f));
