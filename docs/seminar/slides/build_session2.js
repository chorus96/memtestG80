// build_session2.js — 세션 2: 메모리 모델과 쓰기·검증 패턴
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

titleSlide(
  "CUDA 세미나 · 세션 2",
  "메모리 모델과\n쓰기·검증 패턴",
  "모든 메모리 테스트의 뼈대: 쓰고 → 되읽어 비교한다",
  [ ln("gpuWriteConstant(..., 0xFFFFFFFF);   // 쓰기", C.AMBER2),
    ln("errorCount = gpuVerifyConstant(..., 0xFFFFFFFF);   // 검증", C.TEAL) ]
);

// 2 — 목표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "오늘의 목표");
  const items = [
    ["GPU 메모리 계층", "전역(global)·공유(shared)·레지스터의 역할을 구분한다"],
    ["메모리 할당·전송 API", "cudaMalloc·cudaMemcpy·cudaFree를 어디에 쓰는지 안다"],
    ["쓰기→검증 패턴", "왜 커널을 나눠 실행하는지(메모리 반영) 설명할 수 있다"],
    ["Moving Inversions", "패턴과 그 보수를 번갈아 쓰는 고전 알고리즘을 이해한다"],
  ];
  let y = 1.7;
  items.forEach((it, i) => {
    card(s, M, y, W-2*M, 1.06);
    s.addText(String(i+1), { x: M+0.22, y: y+0.2, w: 0.66, h: 0.66, align:"center", valign:"middle",
      fontFace: MONO, fontSize: 22, bold: true, color: C.BG, fill: { color: i%2 ? C.TEAL : C.AMBER }, shape: p.ShapeType.roundRect, rectRadius: 0.33 });
    s.addText(it[0], { x: M+1.15, y: y+0.14, w: W-2*M-1.4, h: 0.44, fontFace: KFONT, fontSize: 19, bold: true, color: C.TEXT, margin: 0, valign: "middle" });
    s.addText(it[1], { x: M+1.15, y: y+0.55, w: W-2*M-1.4, h: 0.42, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "middle" });
    y += 1.24;
  });
  s.addNotes("세션 1의 write 커널을 read 커널과 짝지어 완결하는 회차입니다.");
})();

// 3 — 메모리 계층
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "GPU 메모리 계층");
  const cards = [
    ["전역 메모리 (global)", C.AMBER, ["가장 크고 느림 (VRAM 수 GB)", "모든 스레드가 접근", "★ 테스트 대상 = 이 메모리", "cudaMalloc으로 할당"]],
    ["공유 메모리 (shared)", C.TEAL, ["블록 안에서만 공유, 빠름", "extern __shared__ 로 선언", "리덕션·LCG에 사용 (세션 3)", "블록당 수십 KB"]],
    ["레지스터 (register)", C.MUTED, ["스레드 전용, 가장 빠름", "지역 변수 (uint i, value)", "개수 제한 → 세션 3 -Xptxas", "자동 관리"]],
  ];
  const cw = (W - 2*M - 0.8) / 3;
  cards.forEach((c, i) => {
    const x = M + i*(cw+0.4);
    card(s, x, 1.8, cw, 4.5, C.CARD, c[1]);
    s.addText(c[0], { x: x+0.28, y: 2.05, w: cw-0.56, h: 0.9, fontFace: KFONT, fontSize: 18, bold: true, color: c[1], margin: 0, valign: "top" });
    bullets(s, x+0.28, 3.0, cw-0.56, 3.1, c[2].map((t) => [t, C.TEXT]), { fontSize: 14, gap: 11 });
  });
  s.addText("MemtestG80은 이 세 계층을 모두 활용합니다 — 그래서 좋은 교재입니다.", {
    x: M, y: 6.55, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, align: "center", margin: 0 });
  s.addNotes("테스트 '대상'은 전역 메모리. 공유 메모리는 '도구'로 쓰인다는 구분을 명확히 하세요.");
})();

// 4 — 할당/전송 API (allocate)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "메모리 할당 · memtestState::allocate");
  codePanel(s, M, 1.65, W-2*M, 2.5, [
    ln("// core.cu:51", C.FAINT),
    ln("uint memtestState::allocate(uint mbToTest) {", C.TEXT),
    ln("    if (mbToTest % 2) mbToTest++;              // 2MiB 단위로 반올림", C.AMBER2),
    ln("    megsToTest = mbToTest;  loopIters = megsToTest/2;   // N = MB/2", C.TEXT),
    ln("    cudaMalloc(&devTestMem, (size_t)megsToTest*1048576);  // 테스트 영역", C.TEAL),
    ln("    cudaMalloc(&devTempMem, sizeof(uint)*nBlocks);        // 블록별 오류 수", C.TEAL),
    ln("    hostTempMem = (uint*)malloc(sizeof(uint)*nBlocks);    // 호스트 사본", C.TEXT),
    ln("}", C.TEXT),
  ], { fontSize: 13 });
  const items = [
    ["devTestMem", C.AMBER, "실제로 검사할 전역 메모리 (수백 MB~GB)"],
    ["devTempMem", C.TEAL, "블록마다 오류 수 1개 — nBlocks(1024)개의 uint"],
    ["hostTempMem", C.MUTED, "devTempMem을 CPU로 복사해 최종 합산할 버퍼"],
  ];
  let y = 4.5;
  items.forEach((it) => {
    s.addText(it[0], { x: M, y, w: 2.7, h: 0.55, valign: "top", fontFace: MONO, fontSize: 14, bold: true, color: it[1], margin: 0 });
    s.addText(it[2], { x: M+2.9, y, w: W-2*M-2.9, h: 0.55, valign: "top", fontFace: KFONT, fontSize: 15, color: C.TEXT, margin: 0 });
    y += 0.62;
  });
  s.addNotes("N(loopIters) = MB/2 인 이유: 2·N MiB가 한 그리드 용량이므로. 이 세 버퍼가 이후 모든 테스트의 재료입니다.");
})();

// 5 — 쓰기→검증 흐름
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "모든 테스트의 뼈대 · 쓰고 → 되읽는다");
  const steps = [
    ["STEP 1", "패턴 쓰기", "알려진 비트 패턴을 전 영역에 기록\ndeviceWriteConstant", C.AMBER],
    ["STEP 2", "커널 종료 대기", "SOFTWAIT()로 GPU 완료를 기다림\n= 메모리에 값이 확실히 반영", C.TEAL],
    ["STEP 3", "되읽고 검증", "기대값과 비교, 틀린 비트 수 집계\ndeviceVerifyConstant", C.AMBER],
  ];
  const cw = (W - 2*M - 1.6) / 3;
  steps.forEach((st, i) => {
    const x = M + i*(cw+0.8);
    card(s, x, 2.0, cw, 3.0, C.CARD, st[3]);
    s.addText(st[0], { x: x+0.25, y: 2.2, w: cw-0.5, h: 0.4, fontFace: MONO, fontSize: 13, bold: true, color: st[3], margin: 0 });
    s.addText(st[1], { x: x+0.25, y: 2.65, w: cw-0.5, h: 0.5, fontFace: KFONT, fontSize: 20, bold: true, color: C.TEXT, margin: 0 });
    s.addText(st[2], { x: x+0.25, y: 3.3, w: cw-0.5, h: 1.5, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.2 });
    if (i < 2) s.addText("→", { x: x+cw+0.15, y: 3.1, w: 0.5, h: 0.8, align: "center", valign: "middle", fontFace: KFONT, fontSize: 30, color: C.FAINT, margin: 0 });
  });
  card(s, M, 5.35, W-2*M, 1.0, "241A16", C.AMBER);
  s.addText([
    ln("왜 쓰기와 읽기를 나눌까? ", C.AMBER, { bold: true, breakLine: false }),
    ln("커널이 끝나야 모든 스레드의 쓰기가 전역 메모리에 확실히 반영됩니다. 그 다음에 읽어야 올바른 값을 검증할 수 있습니다.", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: 5.55, w: W-2*M-0.6, h: 0.7, fontFace: KFONT, fontSize: 15, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  s.addNotes("SOFTWAIT는 스핀 대신 슬립 폴링으로 커널 완료를 기다리는 매크로(core.h:49). 커널 경계 = 메모리 배리어 개념을 강조.");
})();

// 6 — SOFTWAIT
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "커널 완료 기다리기 · SOFTWAIT");
  s.addText("커널 launch는 비동기 — 호스트는 곧바로 리턴합니다. 결과를 읽기 전에 GPU 완료를 기다려야 합니다.", {
    x: M, y: 1.6, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 16, color: C.MUTED, margin: 0 });
  codePanel(s, M, 2.15, W-2*M, 2.4, [
    ln("// core.h:40 — 스핀 대신 슬립하며 폴링 (드라이버 스핀웨이트 회피)", C.FAINT),
    ln("inline int _pollStatus(unsigned length=1, unsigned limit=15000) {", C.TEXT),
    ln("    unsigned startTime = getTimeMilliseconds();", C.TEXT),
    ln("    while (cudaStreamQuery(0) == cudaErrorNotReady) {", C.AMBER2),
    ln("        if ((getTimeMilliseconds() - startTime) > limit) return -1;  // 타임아웃", C.RED),
    ln("        SLEEPMS(length);", C.TEXT),
    ln("    }", C.TEXT),
    ln("    return 0;", C.TEXT),
    ln("}", C.TEXT),
    ln("#define SOFTWAIT() if (_pollStatus() != 0) { return 0xFFFFFFFE; }  // 타임아웃 센티넬", C.TEAL),
  ], { fontSize: 12.5 });
  s.addText("기본 15초 안에 커널이 안 끝나면 타임아웃 → 0xFFFFFFFE 반환. 디스플레이 구동 GPU의 워치독 대비책.", {
    x: M, y: 4.7, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("cudaStreamQuery로 완료 폴링. 타임아웃 센티넬(0xFFFFFFFE)은 세션 4·5의 오류 관례와 연결됩니다.");
})();

// 7 — Moving Inversions
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "Moving Inversions · 가장 고전적인 테스트");
  codePanel(s, M, 1.65, W-2*M, 2.3, [
    ln("// core.cu:370 — gpuMovingInversionsOnesZeros", C.FAINT),
    ln("gpuWriteConstant (..., 0xFFFFFFFF);          // 전부 1을 쓴다", C.AMBER2),
    ln("err  = gpuVerifyConstant(..., 0xFFFFFFFF);   // 1이 유지되는지 검증", C.TEAL),
    ln("", C.TEXT),
    ln("gpuWriteConstant (..., 0x0);                 // 보수(전부 0)를 덮어쓴다", C.AMBER2),
    ln("err += gpuVerifyConstant(..., 0x0);          // 0이 유지되는지 검증", C.TEAL),
    ln("return err;                                  // 두 위상의 오류 합", C.TEXT),
  ], { fontSize: 13 });
  card(s, M, 4.25, W-2*M, 2.0, C.CARD, C.TEAL);
  bullets(s, M+0.35, 4.5, W-2*M-0.7, 1.6, [
    ["모든 셀이 1과 0을 모두 안정적으로 저장하는지 검사 (stuck-at 결함 검출)", C.TEXT],
    ["패턴을 쓴 뒤 보수로 덮어써, 이웃 셀이 값을 오염시키는지(간섭)도 확인", C.TEXT],
    ["random 변형(core.cu:527)은 상수 대신 난수를 써서 값 의존적 결함을 노린다", C.TEXT],
  ], { fontSize: 15, gap: 9 });
  s.addNotes("Memtest86 Test 2 계보. 세션 1의 write 커널이 여기서 verify와 짝을 이뤄 완결됩니다.");
})();

// 8 — 실습 미리보기
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "실습 미리보기 · Lab 2");
  const labs = [
    ["Ex 1", "패턴 바꿔보기", "gpuWriteConstant의 상수를 0xAAAAAAAA 등으로", C.AMBER],
    ["Ex 2", "오류 인위 주입", "일부러 메모리를 훼손해 오류 검출 재현", C.TEAL],
    ["Ex 3", "cpuVerify와 비교", "CPU 버전(core.cu:254)과 결과·속도 비교", C.AMBER],
    ["Ex 4", "N(loopIters) 관찰", "테스트 MB를 바꿔 N이 어떻게 변하는지 출력", C.TEAL],
  ];
  const cw = (W - 2*M - 0.5) / 2, ch = 2.1;
  labs.forEach((l, i) => {
    const x = M + (i%2)*(cw+0.5);
    const y = 1.75 + Math.floor(i/2)*(ch+0.35);
    card(s, x, y, cw, ch);
    s.addText(l[0], { x: x+0.28, y: y+0.22, w: 1.3, h: 0.55, align: "center", valign: "middle", fontFace: MONO, fontSize: 17, bold: true, color: C.BG, fill: { color: l[3] }, shape: p.ShapeType.roundRect, rectRadius: 0.08 });
    s.addText(l[1], { x: x+1.75, y: y+0.24, w: cw-2.0, h: 0.9, fontFace: KFONT, fontSize: 18, bold: true, color: C.TEXT, margin: 0, valign: "top" });
    s.addText(l[2], { x: x+0.28, y: y+1.2, w: cw-0.56, h: 0.8, fontFace: KFONT, fontSize: 13.5, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  });
  s.addNotes("Ex 2는 검증 로직이 정말 오류를 잡는지 확인하는 핵심 실습입니다.");
})();

// 9 — 예고
outroSlide(
  "다음 세션 예고",
  "세션 3 · 공유 메모리와 병렬 리덕션",
  [ ln("52만 개 스레드가 각자 센 오류 수를, 어떻게 ", C.TEXT, { breakLine: false }),
    ln("하나의 숫자로 합칠까?", C.TEAL, { bold: true, breakLine: false }),
    ln(" MemtestG80의 가장 우아한 코드를 만납니다.", C.TEXT, { breakLine: true }) ],
  [ ln("__popc(x ^ constant)   →  뒤집힌 비트 개수를 센다", C.AMBER2),
    ln("트리 리덕션           →  블록 안에서 병렬로 합산", C.TEAL) ],
  "실습 랩 2(쓰기·검증)를 먼저 완료하고 오세요."
);

p.writeFile({ fileName: "세션2_메모리모델과_쓰기검증.pptx" }).then((f) => console.log("wrote", f));
