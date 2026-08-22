// build_session3.js — 세션 3: 공유 메모리와 병렬 리덕션 (MemtestG80의 백미)
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, arrow, nodeBox, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

titleSlide(
  "CUDA 세미나 · 세션 3",
  "공유 메모리와\n병렬 리덕션",
  "52만 개 스레드의 오류 수를 하나의 숫자로 — MemtestG80의 백미",
  [ ln("threadErrorCount[threadIdx.x] += __popc(readback ^ constant);", C.AMBER2),
    ln("for (stride = blockDim.x>>1; stride>0; stride>>=1) { ... }   // 트리 리덕션", C.TEAL) ]
);

// 2 — 목표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "오늘의 목표");
  const items = [
    ["공유 메모리 활용", "extern __shared__ 로 블록 내 협업 버퍼를 만든다"],
    ["__popc 인트린식", "틀린 비트 개수를 세는 BITSDIFF의 원리를 안다"],
    ["병렬 트리 리덕션", "stride를 반씩 줄이는 합산 패턴을 한 줄씩 설명한다"],
    ["__syncthreads", "왜 동기화가 없으면 리덕션이 틀리는지 안다"],
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
  s.addNotes("이 회차가 MemtestG80를 교재로 택한 진짜 이유입니다 — 교과서적 병렬 리덕션이 실코드에 있습니다.");
})();

// 1b — CUDA 메모리 계층 조망 (공유 메모리의 위치) + MemtestG80 매핑
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "CUDA 메모리 계층 · 공유 메모리는 어디에 있나", C.TEAL);
  s.addText("위로 갈수록 빠르고 작으며(스레드 전용), 아래로 갈수록 느리고 크다(공유 범위 넓음). 이 세션의 주인공은 2번 계층 — 공유 메모리.", {
    x: M, y: 1.45, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0 });

  // 왼쪽: 계층 스택 (빠름·작음 → 느림·큼)
  const lx = M, lw = 6.1, ty0 = 2.0, th = 0.82, gap = 0.16;
  const tiers = [
    ["① 레지스터 (register)", "스레드 전용 · 가장 빠름 · 수 KB/스레드", C.AMBER, C.CODEBG],
    ["② 공유 메모리 / L1 (shared)", "블록 전용 · 매우 빠름 · 수십 KB/블록  ★", C.TEAL, "12212A"],
    ["③ L2 캐시", "전 SM 공유 · 빠름 · 수 MB", C.MUTED, C.CODEBG],
    ["④ 전역 메모리 (global · VRAM)", "모든 스레드 · 느림 · 수 GB · 테스트 대상", C.AMBER, "241A16"],
    ["⑤ 호스트 메모리 (system RAM)", "CPU 측 · PCIe 경유로만 접근", C.FAINT, C.CODEBG],
  ];
  tiers.forEach((t, i) => {
    const y = ty0 + i*(th+gap);
    nodeBox(s, lx, y, lw, th, t[0], t[1], t[2], t[3]);
    // ④↔⑤ 사이 PCIe 표시
    if (i === 3) {
      s.addText("▲ 온칩/디바이스     ▼ PCIe (cuMemcpy/cudaMemcpy)", { x: lx+0.1, y: y+th-0.02, w: lw-0.2, h: gap+0.04, align: "center", fontFace: KFONT, fontSize: 9, italic: true, color: C.FAINT, margin: 0 });
    }
  });
  // 속도/용량 축 화살표 (왼쪽 여백)
  s.addText("빠름·작음", { x: lx-0.02, y: ty0-0.02, w: 1.2, h: 0.3, fontFace: KFONT, fontSize: 9, color: C.MUTED, margin: 0 });
  s.addText("느림·큼",   { x: lx-0.02, y: ty0+5*(th+gap)-0.34, w: 1.2, h: 0.3, fontFace: KFONT, fontSize: 9, color: C.MUTED, margin: 0 });

  // 오른쪽: MemtestG80 대응
  const rx = lx+lw+0.4, rw = W-M-(lx+lw+0.4);
  card(s, rx, 2.0, rw, 4.62, C.CARD, C.AMBER);
  s.addText("MemtestG80에서의 대응", { x: rx+0.25, y: 2.15, w: rw-0.5, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: C.AMBER, margin: 0 });
  const maps = [
    ["레지스터", "커널 지역변수 — uint i, value, pattern", C.AMBER],
    ["공유 메모리", "threadErrorCount[] (리덕션), LCG shmem, randomBlock", C.TEAL],
    ["전역 메모리", "devTestMem (시험 대상), devTempMem (블록 오류)", C.AMBER],
    ["호스트 메모리", "hostTempMem — 1024개 블록합 최종 합산", C.MUTED],
  ];
  let my = 2.7;
  maps.forEach((m) => {
    s.addText(m[0], { x: rx+0.25, y: my, w: rw-0.5, h: 0.32, fontFace: KFONT, fontSize: 13.5, bold: true, color: m[2], margin: 0 });
    s.addText(m[1], { x: rx+0.25, y: my+0.32, w: rw-0.5, h: 0.55, fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
    my += 1.0;
  });
  s.addText("리덕션은 ④전역(느림)을 최소로 왕복하고 ②공유(빠름)에서 접어 합칩니다 — 그래서 빠릅니다.", {
    x: rx+0.25, y: 6.15, w: rw-0.5, h: 0.45, fontFace: KFONT, fontSize: 11.5, italic: true, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
  s.addNotes("메모리 계층 전체 조망. 세션 2가 '범위(scope) 중첩'으로 봤다면, 여기선 '속도 계층 + MemtestG80 버퍼 대응'으로 봅니다. 공유 메모리가 리덕션의 무대임을 강조.");
})();

// 3 — 문제 제기: 52만 개를 어떻게 합치나
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "문제 · 52만 개의 부분합을 어떻게 합치나");
  s.addText("각 스레드가 자기 word들을 검사해 오류 수를 셌습니다. 이제 전체 합이 필요합니다.", {
    x: M, y: 1.6, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 16.5, color: C.MUTED, margin: 0 });
  const colW = (W - 2*M - 0.4) / 2;
  card(s, M, 2.25, colW, 4.0, C.CARD, C.RED);
  s.addText("순진한 방법 ✗", { x: M+0.3, y: 2.45, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 19, bold: true, color: C.RED, margin: 0 });
  bullets(s, M+0.3, 3.05, colW-0.6, 3.1, [
    "모든 스레드가 하나의 전역 카운터에 += ?",
    "→ 경쟁 조건(race) — 값이 뭉개짐",
    "atomicAdd로 직렬화? → 52만 번 경합, 느림",
    "전역 메모리 왕복도 비쌈",
  ], { fontSize: 15, gap: 11 });
  const x2 = M+colW+0.4;
  card(s, x2, 2.25, colW, 4.0, C.CARD, C.TEAL);
  s.addText("MemtestG80의 방법 ✓", { x: x2+0.3, y: 2.45, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 19, bold: true, color: C.TEAL, margin: 0 });
  bullets(s, x2+0.3, 3.05, colW-0.6, 3.1, [
    "① 블록 안에서 공유 메모리로 트리 합산",
    "② 블록당 결과 1개만 전역에 저장 (1024개)",
    "③ 그 1024개만 CPU로 복사해 최종 합",
    "→ 경합 없이, 로그 단계로 빠르게",
  ], { fontSize: 15, gap: 11 });
  s.addNotes("전역 원자연산을 피하고 계층적으로 줄이는 것이 GPU 리덕션의 정석. 3단계 구조를 각인시키세요.");
})();

// 2b — 전역 원자합 vs 계층 리덕션 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "두 가지 합산 전략 · 그림으로", C.TEAL);
  const colW = (W - 2*M - 0.5) / 2;
  // LEFT: naive global atomic
  card(s, M, 1.7, colW, 4.6, C.CARD, C.RED);
  s.addText("① 전역 원자합 (순진한 방법)", { x: M+0.25, y: 1.85, w: colW-0.5, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: C.RED, margin: 0 });
  // many threads -> one counter
  for (let i=0;i<5;i++){ const tx=M+0.35+i*1.02; nodeBox(s, tx, 2.4, 0.9, 0.6, "T"+i, null, C.LINE); }
  s.addText("… 52만 스레드", { x: M+0.35, y: 3.02, w: colW-0.7, h: 0.3, align: "left", fontFace: KFONT, fontSize: 10.5, italic: true, color: C.MUTED, margin: 0 });
  const cxL = M+colW/2;
  for (let i=0;i<5;i++){ const tx=M+0.35+i*1.02+0.45; arrow(s, tx, 3.05, cxL-tx, 1.15, C.RED, { width: 1.2 }); }
  nodeBox(s, cxL-1.0, 4.25, 2.0, 0.7, "전역 카운터 1개", null, C.RED, "2A1618");
  s.addText("→ 52만 번 경합·직렬화. 느리고, 락 없으면 값이 뭉개짐.", { x: M+0.25, y: 5.15, w: colW-0.5, h: 0.9, fontFace: KFONT, fontSize: 13, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  // RIGHT: hierarchical reduction
  const x2 = M+colW+0.5;
  card(s, x2, 1.7, colW, 4.6, C.CARD, C.TEAL);
  s.addText("② 계층 리덕션 (MemtestG80)", { x: x2+0.25, y: 1.85, w: colW-0.5, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: C.TEAL, margin: 0 });
  // threads -> block trees -> blockresults -> CPU
  for (let b=0;b<3;b++){ const bx=x2+0.4+b*1.9; nodeBox(s, bx, 2.4, 1.7, 0.75, "블록 "+b, "트리 합산", C.TEAL, C.CODEBG);
    arrow(s, bx+0.85, 3.18, 0, 0.5, C.TEAL, { width: 1.4 });
    nodeBox(s, bx+0.45, 3.7, 0.8, 0.5, "합", null, C.TEAL, "12212A"); }
  s.addText("블록당 1개 (총 1024개)", { x: x2+0.4, y: 4.25, w: colW-0.8, h: 0.3, align: "center", fontFace: KFONT, fontSize: 10.5, italic: true, color: C.MUTED, margin: 0 });
  const cx2 = x2+colW/2;
  arrow(s, cx2, 4.55, 0, 0.35, C.AMBER, { width: 1.6 });
  nodeBox(s, cx2-1.3, 4.95, 2.6, 0.6, "CPU 최종 합 (1024개)", null, C.AMBER, "241A16");
  s.addText("→ 경합 없이 로그 단계로. GPU가 52만→1024, CPU가 마무리.", { x: x2+0.25, y: 5.65, w: colW-0.5, h: 0.5, fontFace: KFONT, fontSize: 13, color: C.TEXT, margin: 0, valign: "top" });
  s.addNotes("왼쪽의 병목(모든 화살표가 한 점으로)과 오른쪽의 분산(계층적으로 좁아짐)을 시각적으로 대비시키세요.");
})();

// 4 — __popc / BITSDIFF
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "틀린 비트 세기 · __popc");
  codePanel(s, M, 1.65, W-2*M, 1.1, [
    ln("#define BITSDIFF(x,y) __popc((x) ^ (y))    // core.cu:28", C.AMBER2),
    ln("//  __popc = population count = 1인 비트의 개수", C.FAINT),
  ], { fontSize: 14 });
  card(s, M, 2.95, W-2*M, 1.9, C.CARD, C.AMBER);
  codePanel(s, M+0.3, 3.15, W-2*M-0.6, 1.5, [
    ln("기대값 constant = 1111 1111 1111 1111", C.TEAL),
    ln("실제값 readback = 1111 1011 1111 0111   ← 2비트 손상", C.TEXT),
    ln("XOR (^)        = 0000 0100 0000 1000", C.AMBER2),
    ln("__popc(XOR)    = 2                       ← 오류 2개로 집계", C.RED),
  ], { fontSize: 13 });
  s.addText([
    ln("단순히 '맞다/틀리다'(1)가 아니라 ", C.TEXT, { breakLine: false }),
    ln("뒤집힌 비트의 개수", C.AMBER, { bold: true, breakLine: false }),
    ln("를 셉니다. 한 word에서 여러 비트가 손상돼도 모두 포착 — 오류율 추정이 정밀해집니다.", C.TEXT, { breakLine: true }),
  ], { x: M, y: 5.1, w: W-2*M, h: 1.1, fontFace: KFONT, fontSize: 16, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.2 });
  s.addNotes("__popc는 하드웨어 인트린식(단일 명령). XOR로 다른 비트만 남기고 그 개수를 센다는 흐름을 짚으세요.");
})();

// 5 — 리덕션 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "트리 리덕션 · stride를 반씩 줄인다");
  s.addText("공유 배열의 값을 로그 단계로 접어 합칩니다. 512 → 256 → 128 → … → 1.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 15, color: C.MUTED, margin: 0 });
  // draw 3 rounds of 8-element reduction
  const vals = [
    ["3","1","4","1","5","9","2","6"],
    ["8","10","6","7","","","",""],
    ["14","17","","","","","",""],
    ["31","","","","","","",""],
  ];
  const labels = ["초기 (stride=4)", "1단계 후 (stride=2)", "2단계 후 (stride=1)", "3단계 후 = 블록 합"];
  const x0 = M+2.6, cellw = 0.82, gap = 0.12, rh = 1.05, y0 = 2.15;
  for (let r=0;r<4;r++) {
    s.addText(labels[r], { x: M, y: y0+r*rh+0.15, w: 2.4, h: 0.6, valign: "middle", align: "right", fontFace: KFONT, fontSize: 12.5, color: r===3?C.AMBER:C.MUTED, bold: r===3, margin: 0 });
    for (let c=0;c<8;c++) {
      if (vals[r][c] === "") continue;
      const active = (r < 3 && c < (8 >> (r+1)));
      s.addShape(p.ShapeType.roundRect, { x: x0+c*(cellw+gap), y: y0+r*rh, w: cellw, h: 0.68, rectRadius: 0.05,
        fill: { color: r===3 ? "241A16" : C.CODEBG }, line: { color: r===3 ? C.AMBER : (active?C.TEAL:C.LINE), width: r===3||active?1.5:1 } });
      s.addText(vals[r][c], { x: x0+c*(cellw+gap), y: y0+r*rh, w: cellw, h: 0.68, align: "center", valign: "middle", fontFace: MONO, fontSize: 15, bold: true, color: r===3?C.AMBER:C.TEXT, margin: 0 });
    }
  }
  s.addText("각 단계: threadErrorCount[i] += threadErrorCount[i + stride]  — 절반의 스레드만 일함", {
    x: M, y: 6.35, w: W-2*M, h: 0.4, align: "center", fontFace: MONO, fontSize: 12.5, color: C.TEAL, margin: 0 });
  s.addNotes("8개 예시로 3단계면 끝. 512개면 9단계(log2 512). '절반씩 접는다'는 이미지를 손으로 그려 보이세요.");
})();

// 6 — deviceVerifyConstant 완독
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "코드 완독 · deviceVerifyConstant");
  codePanel(s, M, 1.6, W-2*M, 4.5, [
    ln("__global__ void deviceVerifyConstant(uint* base, uint N, uint constant,", C.AMBER, { breakLine: true }),
    ln("                                     uint* blockErrorCount) {", C.AMBER, { breakLine: true }),
    ln("    extern __shared__ uint threadErrorCount[];        // 블록 공유 버퍼 (512개)", C.TEAL, { breakLine: true }),
    ln("    threadErrorCount[threadIdx.x] = 0;", C.TEXT, { breakLine: true }),
    ln("    for (uint i = 0; i < N; i++)                       // 내 word들 검사", C.TEXT, { breakLine: true }),
    ln("        threadErrorCount[threadIdx.x] += BITSDIFF(*(THREAD_ADDRESS(base,N,i)), constant);", C.AMBER2, { breakLine: true }),
    ln("", C.TEXT, { breakLine: true }),
    ln("    for (uint stride = blockDim.x>>1; stride > 0; stride >>= 1) {   // 트리 리덕션", C.TEAL, { breakLine: true }),
    ln("        __syncthreads();                              // ★ 단계마다 동기화 필수", C.RED, { breakLine: true }),
    ln("        if (threadIdx.x < stride)", C.TEXT, { breakLine: true }),
    ln("            threadErrorCount[threadIdx.x] += threadErrorCount[threadIdx.x + stride];", C.TEXT, { breakLine: true }),
    ln("    }", C.TEXT, { breakLine: true }),
    ln("    if (threadIdx.x == 0) blockErrorCount[blockIdx.x] = threadErrorCount[0];  // 대표 1개", C.AMBER2, { breakLine: true }),
    ln("}", C.TEXT, { breakLine: true }),
  ], { fontSize: 12, lineSpacing: 1.12 });
  s.addText("core.cu:213 — 이 15줄이 세미나 전체에서 가장 밀도 높은 코드입니다.", {
    x: M, y: 6.25, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("한 줄씩: 0으로 초기화 → 부분합 → 트리로 접기 → 대표 스레드(0)가 저장. 4*blockDim.x 바이트 공유 메모리를 launch에서 지정(core.cu:198).");
})();

// 7 — __syncthreads 중요성
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "왜 __syncthreads가 없으면 틀리나");
  const colW = (W - 2*M - 0.4) / 2;
  card(s, M, 1.8, colW, 4.4, C.CARD, C.TEAL);
  s.addText("__syncthreads() 의 역할", { x: M+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 18, bold: true, color: C.TEAL, margin: 0 });
  bullets(s, M+0.3, 2.6, colW-0.6, 3.5, [
    "블록 안 모든 스레드가 이 지점에 도달할 때까지 대기",
    "= 공유 메모리 쓰기가 서로에게 보이도록 보장하는 배리어",
    "다음 stride 단계는 이전 단계 결과에 의존",
    "동기화 없이 읽으면 아직 안 써진 값을 읽음",
  ], { fontSize: 14.5, gap: 12 });
  const x2 = M+colW+0.4;
  card(s, x2, 1.8, colW, 4.4, C.CARD, C.RED);
  s.addText("빠뜨리면?", { x: x2+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 18, bold: true, color: C.RED, margin: 0 });
  bullets(s, x2+0.3, 2.6, colW-0.6, 3.5, [
    "일부 스레드가 앞서가 이웃의 옛 값을 더함",
    "합계가 실행마다 달라짐 (비결정적)",
    "오류가 0인데 0이 아니게 나오거나 그 반대",
    "디버깅이 극도로 어려운 종류의 버그",
  ], { fontSize: 14.5, gap: 12 });
  s.addNotes("배리어 = '모두 여기서 만나자'. 공유 메모리 협업에는 반드시 필요. 실습 랩에서 직접 빼보고 결과 흔들림을 관찰합니다.");
})();

// 8 — 호스트 최종 합산 + 공유메모리 다른 활용
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "3단계: 호스트가 마무리 · 공유 메모리 재활용");
  codePanel(s, M, 1.65, W-2*M, 1.9, [
    ln("// core.cu:195 — gpuVerifyConstant (호스트)", C.FAINT),
    ln("cudaMemcpy(errorCounts, blockErrorCount, sizeof(uint)*nBlocks, D2H);  // 1024개만", C.TEAL),
    ln("uint totalErrors = 0;", C.TEXT),
    ln("for (uint i = 0; i < nBlocks; i++) totalErrors += errorCounts[i];    // ~1k 합산", C.AMBER2),
    ln("return totalErrors;", C.TEXT),
  ], { fontSize: 13 });
  s.addText("GPU는 52만 → 1024로 줄이고, CPU는 그 1024개만 더합니다. 각자 잘하는 일을 맡습니다.", {
    x: M, y: 3.7, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 15.5, color: C.MUTED, margin: 0 });
  card(s, M, 4.35, W-2*M, 1.9, C.CARD, C.AMBER);
  s.addText("같은 공유 메모리, 다른 쓰임 — 세션 3에서 함께 보는 두 사례", { x: M+0.3, y: 4.55, w: W-2*M-0.6, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: C.AMBER, margin: 0 });
  bullets(s, M+0.3, 5.05, W-2*M-0.6, 1.1, [
    ["deviceShortLCG0Shmem (core.cu:346) — LCG 중간값을 공유 메모리에 둬 셰이더 오버클럭 오류에 민감", C.TEXT],
    ["deviceWriteRandomBlocks (core.cu:723) — 공유 메모리로 난수 블록을 병렬 생성 후 전역에 기록", C.TEXT],
  ], { fontSize: 13.5, gap: 8 });
  s.addNotes("공유 메모리는 리덕션뿐 아니라 '협업 버퍼'로도 쓰인다는 확장. 리덕션이 핵심이지만 두 사례로 일반화하세요.");
})();

// 9 — 실습 미리보기
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "8", "실습 미리보기 · Lab 3");
  const labs = [
    ["Ex 1", "__syncthreads 빼보기", "리덕션 동기화를 지워 합계가 흔들리는지 관찰", C.RED],
    ["Ex 2", "__popc 확인", "손상 비트 수와 집계 오류 수가 일치하는지", C.AMBER],
    ["Ex 3", "블록 합 훔쳐보기", "blockErrorCount를 출력해 분포 확인", C.TEAL],
    ["Ex 4", "shmem 크기 실험", "공유 메모리 지정을 바꿔 동작 변화 관찰", C.AMBER],
  ];
  const cw = (W - 2*M - 0.5) / 2, ch = 2.1;
  labs.forEach((l, i) => {
    const x = M + (i%2)*(cw+0.5);
    const y = 1.75 + Math.floor(i/2)*(ch+0.35);
    card(s, x, y, cw, ch);
    s.addText(l[0], { x: x+0.28, y: y+0.22, w: 1.55, h: 0.55, align: "center", valign: "middle", fontFace: MONO, fontSize: 15, bold: true, color: C.BG, fill: { color: l[3] }, shape: p.ShapeType.roundRect, rectRadius: 0.08 });
    s.addText(l[1], { x: x+2.0, y: y+0.24, w: cw-2.25, h: 0.9, fontFace: KFONT, fontSize: 17, bold: true, color: C.TEXT, margin: 0, valign: "top" });
    s.addText(l[2], { x: x+0.28, y: y+1.2, w: cw-0.56, h: 0.8, fontFace: KFONT, fontSize: 13.5, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  });
  s.addNotes("Ex 1은 이 세션의 하이라이트 — 동기화의 필요성을 몸으로 배웁니다. 반드시 원복하도록 안내하세요.");
})();

// 10 — 예고
outroSlide(
  "다음 세션 예고",
  "세션 4 · 테스트 알고리즘과 성능 측정",
  [ ln("이제 뼈대를 알았으니, 그 위에 세운 ", C.TEXT, { breakLine: false }),
    ln("13종 테스트", C.TEAL, { bold: true, breakLine: false }),
    ln("를 훑고, 대역폭을 CUDA로 재는 법을 배웁니다.", C.TEXT, { breakLine: true }) ],
  [ ln("Walking bits · Modulo-20 · Logic(LCG) · Random blocks", C.AMBER2),
    ln("gpuMemoryBandwidth →  D2D cudaMemcpy로 대역폭 측정", C.TEAL) ],
  "실습 랩 3(리덕션)을 먼저 완료하고 오세요."
);

p.writeFile({ fileName: "세션3_공유메모리와_병렬리덕션.pptx" }).then((f) => console.log("wrote", f));
