// build_session4.js — 세션 4: 테스트 알고리즘과 성능 측정
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, arrow, nodeBox, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

titleSlide(
  "CUDA 세미나 · 세션 4",
  "테스트 알고리즘과\n성능 측정",
  "쓰기·검증 뼈대 위에 세운 13종 테스트, 그리고 대역폭",
  [ ln("for (shift=0; shift<8; shift++)  gpuWalking8BitM86(err, shift);", C.AMBER2),
    ln("gpuMemoryBandwidth(...)   // D2D cudaMemcpy 반복으로 대역폭 측정", C.TEAL) ]
);

// 2 — 목표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "오늘의 목표");
  const items = [
    ["테스트 카탈로그", "13종 테스트가 각각 어떤 결함을 노리는지 개관한다"],
    ["패턴 생성 로직", "Walking bits·Modulo가 비트 연산으로 패턴을 만드는 법을 안다"],
    ["Logic 테스트(LCG)", "메모리가 아니라 연산 로직을 검사하는 아이디어를 이해한다"],
    ["대역폭 측정", "CUDA 이벤트 대신 D2D memcpy로 대역폭을 재는 법을 안다"],
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
  s.addNotes("세션 1~3에서 배운 뼈대(주소 매핑·검증·리덕션)가 모든 테스트에 재사용됨을 계속 짚으세요.");
})();

// 3 — 카탈로그 표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "한 iteration이 돌리는 13종 테스트");
  const rows = [
    ["Moving Inversions (1/0)", "Memtest86 #2", "stuck bit · 인접 간섭", C.AMBER],
    ["Walking 8-bit (M86)", "Memtest86 #3", "데이터 라인 단락", C.TEAL],
    ["True Walking 8-bit (0/1)", "변형", "주소·데이터 결합 결함", C.TEAL],
    ["Moving Inversions (random)", "Memtest86 #4", "값 의존적 오류", C.AMBER],
    ["Walking 32-bit (0/1)", "Memtest86 #6", "전체 워드폭 데이터 라인", C.TEAL],
    ["Random Blocks", "Memtest86 #7", "무작위 패턴·재현 검증", C.AMBER],
    ["Modulo-20", "Memtest86 #8", "주기적 주소 간섭", C.TEAL],
    ["Logic / Short LCG (+shmem)", "고유", "연산 로직·반복 카운트", C.AMBER],
  ];
  const y0 = 1.65, rh = 0.58;
  // header row
  s.addText("테스트", { x: M+0.2, y: y0, w: 4.5, h: 0.4, fontFace: MONO, fontSize: 12, bold: true, color: C.TEAL, margin: 0 });
  s.addText("계보", { x: M+5.0, y: y0, w: 2.5, h: 0.4, fontFace: MONO, fontSize: 12, bold: true, color: C.TEAL, margin: 0 });
  s.addText("노리는 결함", { x: M+7.8, y: y0, w: 4.0, h: 0.4, fontFace: MONO, fontSize: 12, bold: true, color: C.TEAL, margin: 0 });
  let y = y0+0.45;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.line, { x: M, y: y-0.02, w: W-2*M, h: 0, line: { color: C.LINE, width: 1 } });
    s.addText(r[0], { x: M+0.2, y: y+0.06, w: 4.6, h: rh-0.1, valign: "middle", fontFace: KFONT, fontSize: 14.5, bold: true, color: C.TEXT, margin: 0 });
    s.addText(r[1], { x: M+5.0, y: y+0.06, w: 2.6, h: rh-0.1, valign: "middle", fontFace: MONO, fontSize: 12.5, color: r[3], margin: 0 });
    s.addText(r[2], { x: M+7.8, y: y+0.06, w: 4.4, h: rh-0.1, valign: "middle", fontFace: KFONT, fontSize: 13.5, color: C.MUTED, margin: 0 });
    y += rh;
  });
  s.addText("Walking 계열은 shift(8/32/20회)만큼 커널을 반복 → 실제 실행 횟수는 표의 행 수보다 훨씬 많습니다.", {
    x: M, y: 6.5, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("cli.cu:185의 for 루프가 이 표를 순서대로 실행합니다. 계보(Memtest86)를 언급하며 검증된 알고리즘임을 강조.");
})();

// 4 — Walking bits 패턴 생성
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "패턴 생성 · Walking Bits");
  const cards = [
    ["M86 Walking 8-bit", C.AMBER, "1<<shift 를 32비트로 복제해 전 영역에 동일 기록·검증 후 보수도 검증"],
    ["True Walking 8-bit", C.TEAL, "워드 안에서 켜진 비트가 실제 이동 — 인접 라인 결합 결함에 민감"],
    ["Walking 32-bit", C.AMBER, "32비트 전 폭에서 단일 비트 이동(shift 0~31)으로 각 데이터 라인 자극"],
  ];
  const cw = (W - 2*M - 0.8) / 3;
  cards.forEach((c, i) => {
    const x = M + i*(cw+0.4);
    card(s, x, 1.75, cw, 2.0, C.CARD, c[1]);
    s.addText(c[0], { x: x+0.25, y: 1.95, w: cw-0.5, h: 0.5, fontFace: KFONT, fontSize: 16, bold: true, color: c[1], margin: 0 });
    s.addText(c[2], { x: x+0.25, y: 2.5, w: cw-0.5, h: 1.15, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  });
  codePanel(s, M, 4.0, W-2*M, 1.6, [
    ln("// core.cu:392 — gpuWalking8BitM86 의 패턴 생성", C.FAINT),
    ln("shift &= 0x7;", C.TEXT),
    ln("uint pattern = 1 << shift;", C.AMBER2),
    ln("pattern = pattern | (pattern<<8) | (pattern<<16) | (pattern<<24);  // 8비트→워드 복제", C.TEAL),
  ], { fontSize: 13 });
  s.addText("비트 연산만으로 패턴을 만들고, 세션 1~3의 write/verify 뼈대를 그대로 재사용합니다.", {
    x: M, y: 5.75, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("핵심: 테스트마다 다른 건 '패턴 생성'뿐, 쓰기·검증·리덕션은 공통. 이 재사용이 좋은 설계의 증거입니다.");
})();

// 3b — Walking 비트 진행 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "Walking 비트가 걷는 모습", C.TEAL);
  s.addText("shift가 0→7로 증가하면 켜진 비트(1) 하나가 한 칸씩 이동합니다. 각 위상에서 그 비트와 이웃을 검사합니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });
  const rows = 5;                 // shift 0..4 표시
  const cell = 0.62, gap = 0.1, x0 = M+1.7, y0 = 2.15, rh = 0.82;
  for (let r=0;r<rows;r++){
    const y = y0 + r*rh;
    s.addText("shift="+r, { x: M, y: y+0.02, w: 1.5, h: cell, valign: "middle", align: "right", fontFace: "Courier New", fontSize: 13, color: C.MUTED, margin: 0 });
    for (let b=0;b<8;b++){
      const on = (b === (7-r));   // 왼쪽이 상위비트로 보이도록 7-r
      s.addShape(p.ShapeType.roundRect, { x: x0+b*(cell+gap), y, w: cell, h: cell, rectRadius: 0.05,
        fill: { color: on ? C.AMBER : C.CODEBG }, line: { color: on ? C.AMBER : C.LINE, width: 1 } });
      s.addText(on ? "1" : "0", { x: x0+b*(cell+gap), y, w: cell, h: cell, align: "center", valign: "middle", fontFace: "Courier New", fontSize: 15, bold: on, color: on ? C.BG : C.FAINT, margin: 0 });
    }
    const pat = (1 << r); const dup = (pat | (pat<<8) | (pat<<16) | (pat<<24)) >>> 0;
    s.addText("0x"+dup.toString(16).toUpperCase().padStart(8,"0"), { x: x0+8*(cell+gap)+0.2, y: y+0.02, w: 2.3, h: cell, valign: "middle", fontFace: "Courier New", fontSize: 13, color: C.TEAL, margin: 0 });
  }
  s.addText("← 8비트 패턴을 32비트 워드로 복제한 값", { x: x0+8*(cell+gap)+0.2, y: y0+rows*rh+0.05, w: 4.5, h: 0.35, fontFace: KFONT, fontSize: 11.5, italic: true, color: C.MUTED, margin: 0 });
  s.addText("이 표를 손으로 채워보는 것이 Lab 4 Exercise 2입니다. shift 0~7까지 8칸을 모두 훑습니다.", {
    x: M, y: 6.4, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, align: "center", margin: 0 });
  s.addNotes("켜진 비트가 대각선으로 내려가는 모습이 'walking'. 오른쪽 16진수는 워드 복제 결과로, 코드와 대조하게 하세요.");
})();

// 5 — Random & Modulo
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "Random Blocks & Modulo-20");
  const colW = (W - 2*M - 0.4) / 2;
  card(s, M, 1.8, colW, 4.4, C.CARD, C.AMBER);
  s.addText("Random Blocks (#7)", { x: M+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 19, bold: true, color: C.AMBER, margin: 0 });
  bullets(s, M+0.3, 2.6, colW-0.6, 2.2, [
    "rand() 시드로 재현 가능한 난수를 채움",
    "검증 시 같은 시드로 수열을 재생성해 비교",
    "공유 메모리로 난수 블록을 병렬 생성 (core.cu:723)",
  ], { fontSize: 14.5, gap: 10 });
  s.addText("구조화된 패턴이 놓치는 값 의존적 결함을 잡습니다.", { x: M+0.3, y: 5.4, w: colW-0.6, h: 0.7, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0, valign: "top" });
  const x2 = M+colW+0.4;
  card(s, x2, 1.8, colW, 4.4, C.CARD, C.TEAL);
  s.addText("Modulo-20 (#8)", { x: x2+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 19, bold: true, color: C.TEAL, margin: 0 });
  bullets(s, x2+0.3, 2.6, colW-0.6, 2.2, [
    "20개 word마다 패턴을 배치, 나머지는 보수로 채움",
    "shift를 0~19로 돌려 모든 위상을 커버",
    "주기적 주소 간섭 결함을 표적",
  ], { fontSize: 14.5, gap: 10 });
  s.addText("특정 간격의 셀들이 서로 영향을 주는 결함을 찾습니다.", { x: x2+0.3, y: 5.4, w: colW-0.6, h: 0.7, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0, valign: "top" });
  s.addNotes("둘 다 매 iteration마다 새 rand() 값을 받아 실행마다 커버리지를 넓힙니다(cli.cu:268,278).");
})();

// 6 — Logic / LCG
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "Logic 테스트 · 메모리가 아니라 연산을 본다");
  codePanel(s, M, 1.6, W-2*M, 2.4, [
    ln("// core.cu:298 — LCGLOOP 매크로", C.FAINT),
    ln("for (rep = 0; rep < repeats; rep++) {", C.TEXT),
    ln("    value = ~value;", C.TEXT),
    ln("    for (iter = 0; iter < period; iter++) {   // 짧은 주기 LCG", C.TEAL),
    ln("        value = ~value;  value = a*value + c; // 선형합동생성기 스텝", C.AMBER2),
    ln("        value ^= 0xFFFFFFF0;  value ^= 0xF;    // 짝 XOR — 명령 다양성", C.TEXT),
    ln("    }", C.TEXT),
    ln("    value = ~value;", C.TEXT),
    ln("}  // 끝나면 value는 0 이어야 정상", C.FAINT),
  ], { fontSize: 12.5 });
  bullets(s, M, 4.25, W-2*M, 2.0, [
    ["결과가 항상 0으로 되돌아오도록 설계 → 반복 횟수 k가 달라도 결과가 같아야 함. 다르면 로직 오류.", C.TEXT],
    ["짝 XOR은 단일 XOR이 NOT으로 최적화돼 사라지는 것을 막아 명령 스트림에 다양성을 줌 (decuda로 검증).", C.TEXT],
    ["shmem 버전은 중간값을 공유 메모리에 둬 셰이더 오버클럭 오류에 더 민감 (세션 3 연결).", C.TEXT],
  ], { fontSize: 14, gap: 9 });
  s.addNotes("메모리 저장이 아니라 ALU·반복 제어를 검사한다는 발상이 독특. 오버클럭 안정성 검증에 특히 유용합니다.");
})();

// 7 — 대역폭
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "대역폭 측정 · D2D memcpy");
  codePanel(s, M, 1.65, W-2*M, 2.2, [
    ln("// core.cu:168 — gpuMemoryBandwidth", C.FAINT),
    ln("uint start = getTimeMilliseconds();", C.TEXT),
    ln("for (uint i = 0; i < iters; i++)", C.TEXT),
    ln("    cudaMemcpy(dst, src, bytes, cudaMemcpyDeviceToDevice);  // 디바이스 내부 복사", C.AMBER2),
    ln("cudaThreadSynchronize();    // ★ D2D는 비동기 → 반드시 동기화 후 시간 측정", C.RED),
    ln("double bw = 2.0 * (mbToTest*iters) / seconds;   // 읽기+쓰기 → ×2", C.TEAL),
  ], { fontSize: 13 });
  const items = [
    ["비동기 함정", C.RED, "D2D memcpy는 논블로킹 → 동기화 없이 시간 재면 0에 가까운 엉터리 값"],
    ["×2의 이유", C.TEAL, "복사는 읽기와 쓰기를 동시에 함 → 실효 대역폭은 전송량의 2배"],
    ["진단 가치", C.AMBER, "기대치보다 크게 낮으면 그 자체가 하드웨어·드라이버 이상 신호"],
  ];
  let y = 4.15;
  items.forEach((it) => {
    s.addText(it[0], { x: M, y, w: 2.6, h: 0.6, valign: "top", fontFace: KFONT, fontSize: 15, bold: true, color: it[1], margin: 0 });
    s.addText(it[2], { x: M+2.8, y, w: W-2*M-2.8, h: 0.6, valign: "top", fontFace: KFONT, fontSize: 14.5, color: C.TEXT, margin: 0, lineSpacingMultiple: 1.05 });
    y += 0.72;
  });
  s.addNotes("CUDA 이벤트 대신 밀리초 타이머 + cudaThreadSynchronize를 씀. 비동기성이 왜 함정인지가 핵심 교훈입니다.");
})();

// 6b — D2D 대역폭 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "대역폭은 왜 ×2인가 · 그림으로", C.TEAL);
  s.addText("device-to-device 복사는 같은 VRAM 안에서 읽기와 쓰기를 동시에 합니다. 그래서 실효 전송량은 2배입니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });
  const bw = 3.6, bh = 1.4, y0 = 2.6;
  const sxx = M+1.0, dxx = W-M-1.0-bw;
  nodeBox(s, sxx, y0, bw, bh, "src (원본 영역)", "VRAM 읽기 (read)", C.TEAL, C.CODEBG);
  nodeBox(s, dxx, y0, bw, bh, "dst (대상 영역)", "VRAM 쓰기 (write)", C.AMBER, C.CODEBG);
  arrow(s, sxx+bw+0.1, y0+0.45, dxx-(sxx+bw)-0.2, 0, C.TEAL, { width: 3 });
  s.addText("① 읽기", { x: sxx+bw, y: y0+0.02, w: dxx-(sxx+bw), h: 0.35, align: "center", fontFace: KFONT, fontSize: 12.5, bold: true, color: C.TEAL, margin: 0 });
  arrow(s, sxx+bw+0.1, y0+0.95, dxx-(sxx+bw)-0.2, 0, C.AMBER, { width: 3 });
  s.addText("② 쓰기", { x: sxx+bw, y: y0+1.02, w: dxx-(sxx+bw), h: 0.35, align: "center", fontFace: KFONT, fontSize: 12.5, bold: true, color: C.AMBER, margin: 0 });
  s.addText("cudaMemcpy(dst, src, bytes, DeviceToDevice)", { x: M, y: y0+bh+0.25, w: W-2*M, h: 0.4, align: "center", fontFace: "Courier New", fontSize: 13, color: C.MUTED, margin: 0 });
  card(s, M, 5.15, W-2*M, 1.2, "241A16", C.AMBER);
  s.addText([
    ln("bw = 2.0 × (전송 MB × 반복) / 초", C.AMBER2, { bold: true, breakLine: true, paraSpaceAfter: 4 }),
    ln("★ D2D memcpy는 비동기 → cudaThreadSynchronize() 후에 시간을 재야 정확합니다.", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: 5.35, w: W-2*M-0.6, h: 0.9, fontFace: KFONT, fontSize: 14.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  s.addNotes("읽기 화살표 + 쓰기 화살표 두 개로 '왜 ×2'를 시각화. 동기화 함정은 Lab 4 Exercise 4에서 직접 재현합니다.");
})();

// 8 — 실습 미리보기
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "실습 미리보기 · Lab 4");
  const labs = [
    ["Ex 1", "테스트 순서 읽기", "cli.cu의 for 루프에서 13종 실행 순서 확인", C.AMBER],
    ["Ex 2", "패턴 손으로 계산", "shift별 Walking 패턴을 종이에 적고 코드와 대조", C.TEAL],
    ["Ex 3", "LCG 0 확인", "value가 0으로 돌아오는지 중간값 출력", C.AMBER],
    ["Ex 4", "대역폭 재보기", "bw_iters를 바꿔 측정값 안정성 관찰", C.TEAL],
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
  s.addNotes("Ex 2로 비트 연산을 손으로 따라가면 패턴 생성이 확실히 이해됩니다.");
})();

// 9 — 예고
outroSlide(
  "다음 세션 예고",
  "세션 5 · 객체지향 API·라이브러리·캡스톤",
  [ ln("커널·호스트 함수를 감싼 ", C.TEXT, { breakLine: false }),
    ln("memtestState 클래스", C.TEAL, { bold: true, breakLine: false }),
    ln("를 보고, 내 프로그램에 라이브러리로 임베드한 뒤, 나만의 테스트를 만듭니다.", C.TEXT, { breakLine: true }) ],
  [ ln("memtestState tester;  tester.allocate(128);", C.AMBER2),
    ln("tester.gpuMovingInversionsOnesZeros(errorCount);   // 3계층 API의 꼭대기", C.TEAL) ],
  "실습 랩 4(테스트·대역폭)를 먼저 완료하고 오세요."
);

p.writeFile({ fileName: "세션4_테스트알고리즘과_성능측정.pptx" }).then((f) => console.log("wrote", f));
