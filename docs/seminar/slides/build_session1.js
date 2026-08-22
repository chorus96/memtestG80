// build_session1.js — 세션 1: CUDA 스레드 모델과 주소 매핑
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, arrow, nodeBox, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

// 1 — Title
titleSlide(
  "CUDA 세미나 · 세션 1",
  "CUDA 스레드 모델과\n주소 매핑",
  "524,288개의 스레드가 각자 자기 메모리를 찾는 원리",
  [ ln("__global__ void deviceWriteConstant(uint* base, uint N, const uint constant);", C.AMBER2),
    ln("//  ▲ 커널        ▲ 반환형은 항상 void", C.FAINT) ]
);

// 2 — 목표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "오늘의 목표");
  const items = [
    ["커널이란 무엇인가", "__global__ 함수가 일반 C 함수와 어떻게 다른지 설명할 수 있다"],
    ["실행 구성 <<<1024, 512>>>", "그리드·블록·스레드의 3단 계층을 이해한다"],
    ["스레드는 자기 데이터를 어떻게 찾나", "blockIdx·threadIdx·blockDim의 역할을 안다"],
    ["THREAD_ADDRESS 완독", "이 매크로 한 줄과 메모리 병합(coalescing)의 관계를 안다"],
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
  s.addNotes("MemtestG80의 THREAD_ADDRESS는 cuda_memtest보다 정교합니다(스레드 인터리빙). 오늘의 하이라이트로 예고하세요.");
})();

// 3 — 커널이란
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "커널(kernel)이란?");
  s.addText([
    ln("커널", C.AMBER, { bold: true, breakLine: false }),
    ln("은 GPU에서 실행되는 함수입니다. CPU(호스트)가 호출하고, GPU(디바이스)의 수많은 스레드가 ", C.TEXT, { breakLine: false }),
    ln("동시에", C.TEAL, { bold: true, breakLine: false }),
    ln(" 실행합니다.", C.TEXT, { breakLine: true }),
  ], { x: M, y: 1.6, w: W-2*M, h: 0.8, fontFace: KFONT, fontSize: 18, color: C.TEXT, margin: 0, valign: "top" });
  codePanel(s, M, 2.5, W-2*M, 1.35, [
    ln("__global__", C.AMBER, { breakLine: false }),
    ln(" void deviceWriteConstant(uint* base, uint N, const uint constant)", C.TEXT, { breakLine: true }),
    ln("//  ▲ 한정자        ▲ 반환형 void        ▲ 인자는 값 또는 디바이스 포인터", C.FAINT, { breakLine: true }),
  ], { fontSize: 13.5 });
  const cards = [
    ["__global__", C.AMBER, "CPU가 호출 → GPU가 실행\n= 커널. <<<>>>로 부른다"],
    ["__device__", C.TEAL, "GPU에서 GPU만 호출\n커널이 쓰는 보조 함수 (예: deviceRan0p)"],
    ["__host__", C.MUTED, "일반 CPU 함수 (기본값)\n예: gpuWriteConstant"],
  ];
  const cw = (W - 2*M - 0.8) / 3;
  cards.forEach((c, i) => {
    const x = M + i*(cw+0.4);
    card(s, x, 4.3, cw, 2.05);
    s.addText(c[0], { x: x+0.25, y: 4.5, w: cw-0.5, h: 0.5, fontFace: MONO, fontSize: 18, bold: true, color: c[1], margin: 0 });
    s.addText(c[2], { x: x+0.25, y: 5.05, w: cw-0.5, h: 1.15, fontFace: KFONT, fontSize: 14, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.12 });
  });
  s.addNotes("반환형이 항상 void, 결과는 인자 포인터를 통해 메모리에 남긴다는 점을 강조. core.cu:189.");
})();

// 4 — 실행 계층 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "실행 계층 · Grid → Block → Thread");
  s.addText("커널을 실행하면 스레드가 3단 계층으로 조직됩니다. MemtestG80은 <<<1024, 512>>> — 블록 1024개, 블록당 스레드 512개.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });
  // Grid box
  const gx=M, gy=1.95, gw=7.1, gh=4.35;
  card(s, gx, gy, gw, gh, C.CARD, C.AMBER);
  s.addText("그리드(Grid) · gridDim.x = 1024", { x: gx+0.25, y: gy+0.12, w: gw-0.5, h: 0.4, fontFace: KFONT, fontSize: 14, bold: true, color: C.AMBER, margin: 0 });
  const bx0=gx+0.3, by0=gy+0.65, bw=1.95, bh=0.9, gapx=0.28, gapy=0.2; let bn=0;
  for (let r=0;r<3;r++) for (let c=0;c<3;c++) {
    const x=bx0+c*(bw+gapx), y=by0+r*(bh+gapy); const hot=(r===0&&c===2);
    s.addShape(p.ShapeType.roundRect, { x, y, w: bw, h: bh, rectRadius: 0.05, fill: { color: C.CODEBG }, line: { color: hot?C.TEAL:C.LINE, width: hot?2:1 } });
    s.addText("블록 "+bn, { x, y: y+0.14, w: bw, h: 0.32, align: "center", fontFace: KFONT, fontSize: 12, bold: true, color: hot?C.TEAL:C.TEXT, margin: 0 });
    s.addText("blockIdx.x="+bn, { x, y: y+0.46, w: bw, h: 0.3, align: "center", fontFace: MONO, fontSize: 10, color: C.MUTED, margin: 0 });
    bn++;
  }
  s.addText("… 블록 1023까지", { x: bx0, y: by0+3*(bh+gapy)-0.02, w: gw-0.6, h: 0.3, fontFace: KFONT, fontSize: 11, italic: true, color: C.MUTED, margin: 0 });
  s.addShape(p.ShapeType.line, { x: gx+gw+0.02, y: gy+1.4, w: 0.75, h: 0, line: { color: C.TEAL, width: 2.5, endArrowType: "triangle" } });
  s.addText("확대", { x: gx+gw-0.02, y: gy+0.95, w: 0.8, h: 0.35, align: "center", fontFace: KFONT, fontSize: 11, color: C.TEAL, margin: 0 });
  // Block zoom
  const zx=gx+gw+0.85, zy=1.95, zw=W-M-(gx+gw+0.85), zh=4.35;
  card(s, zx, zy, zw, zh, C.CARD, C.TEAL);
  s.addText("블록(Block) · blockIdx.x", { x: zx+0.25, y: zy+0.12, w: zw-0.5, h: 0.4, fontFace: KFONT, fontSize: 14, bold: true, color: C.TEAL, margin: 0 });
  s.addText("스레드(Thread) · threadIdx.x = 0 ~ 511", { x: zx+0.25, y: zy+0.6, w: zw-0.5, h: 0.35, fontFace: KFONT, fontSize: 12, color: C.MUTED, margin: 0 });
  const tx0=zx+0.3, ty0=zy+1.1, tw=0.72, thh=0.72, tgx=0.18, tgy=0.25; let tn=0;
  for (let r=0;r<2;r++) for (let c=0;c<4;c++) {
    const x=tx0+c*(tw+tgx), y=ty0+r*(thh+tgy);
    s.addShape(p.ShapeType.roundRect, { x, y, w: tw, h: thh, rectRadius: 0.04, fill: { color: C.CODEBG }, line: { color: C.LINE, width: 1 } });
    s.addText("T"+tn, { x, y, w: tw, h: thh, align: "center", valign: "middle", fontFace: MONO, fontSize: 13, bold: true, color: C.TEXT, margin: 0 }); tn++;
  }
  s.addText("… T511 까지 (blockDim.x = 512)", { x: tx0, y: ty0+2*(thh+tgy)-0.05, w: zw-0.6, h: 0.3, fontFace: KFONT, fontSize: 10.5, italic: true, color: C.MUTED, margin: 0 });
  card(s, zx, zy+zh-1.0, zw, 0.9, "241A16");
  s.addText([ ln("총 스레드", C.AMBER, { bold: true, breakLine: true }), ln("1024 × 512 = 524,288개", C.TEXT, { breakLine: true }) ],
    { x: zx+0.2, y: zy+zh-0.92, w: zw-0.4, h: 0.8, fontFace: KFONT, fontSize: 12, color: C.TEXT, margin: 0, valign: "top" });
  s.addNotes("각 스레드는 (blockIdx, threadIdx)로 자기 위치를 안다. cuda_memtest는 블록당 1개였지만 MemtestG80은 512개 — 이 차이가 리덕션·coalescing으로 이어짐.");
})();

// 3c — 실행 모델: 소프트웨어(논리) → 하드웨어(물리) 매핑 (워프/SM/SIMT)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "실행 모델 · 소프트웨어 → 하드웨어 매핑", C.TEAL);
  s.addText("논리적 계층(왼쪽)이 실제 GPU 하드웨어(오른쪽)에 어떻게 배정되어 실행되는지를 보여줍니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });

  // 열 헤더
  const swx = M, sww = 4.7, hwx = 7.5, hww = W-M-7.5;
  s.addText("소프트웨어 (논리)", { x: swx, y: 2.0, w: sww, h: 0.35, align: "center", fontFace: KFONT, fontSize: 13, bold: true, color: C.TEAL, margin: 0 });
  s.addText("하드웨어 (물리)",   { x: hwx, y: 2.0, w: hww, h: 0.35, align: "center", fontFace: KFONT, fontSize: 13, bold: true, color: C.AMBER, margin: 0 });

  const rows = [
    ["그리드 (Grid)", "커널 실행 전체", "GPU (디바이스)", "여러 SM으로 구성"],
    ["블록 (Block)", "blockIdx.x · 최대 1024 스레드", "SM (Streaming Multiprocessor)", "블록을 배정받아 실행"],
    ["워프 (Warp) = 32 스레드", "블록을 32개씩 묶음", "워프 스케줄러 (SIMT)", "32 스레드가 같은 명령 동시 실행"],
    ["스레드 (Thread)", "threadIdx.x", "CUDA 코어 (lane)", "한 스레드의 연산 담당"],
  ];
  const y0 = 2.45, rh = 0.9, gap = 0.16;
  rows.forEach((r, i) => {
    const y = y0 + i*(rh+gap);
    nodeBox(s, swx, y, sww, rh, r[0], r[1], C.TEAL, "12212A");
    nodeBox(s, hwx, y, hww, rh, r[2], r[3], C.AMBER, "241A16");
    arrow(s, swx+sww+0.08, y+rh/2, (hwx-(swx+sww))-0.16, 0, C.FAINT, { width: 1.8 });
  });

  card(s, M, y0+4*(rh+gap)-0.02, W-2*M, 0.95, "12212A", C.TEAL);
  s.addText([
    ln("MemtestG80: 블록당 512 스레드 = 16 워프. ", C.TEAL, { bold: true, breakLine: false }),
    ln("같은 워프의 32 스레드가 인접 주소를 읽어 메모리 병합(coalescing)이 일어납니다 (다음 슬라이드). SIMT = 한 명령을 32 스레드가 함께 실행.", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: y0+4*(rh+gap)+0.14, w: W-2*M-0.6, h: 0.7, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.12 });
  s.addNotes("실행 계층(앞 슬라이드)이 하드웨어에 매핑되는 관점. Grid→GPU, Block→SM, Warp(32)→스케줄러(SIMT), Thread→코어. 워프 개념이 다음 coalescing 슬라이드의 전제입니다.");
})();

// 3d — SM 내부 구조 (하나의 SM 확대도)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "SM 내부 구조 · 하나의 SM 을 들여다보면", C.TEAL);
  s.addText("앞 슬라이드의 'Block → SM' 를 확대한 그림입니다. 블록은 이 SM 안에서 워프 단위로 스케줄되어 실행됩니다.", {
    x: M, y: 1.45, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13.5, color: C.MUTED, margin: 0 });

  // SM 외곽 박스
  const bx = M, by = 1.9, bw = 8.5, bh = 4.75;
  card(s, bx, by, bw, bh, C.CARD, C.AMBER);
  s.addText("SM (Streaming Multiprocessor)", { x: bx+0.2, y: by+0.08, w: bw-0.4, h: 0.3, fontFace: KFONT, fontSize: 12.5, bold: true, color: C.AMBER, margin: 0 });

  const ix = bx+0.2, iw = bw-0.4;   // 내부 영역 x0, 폭
  const box = function(x,y,w,h,label,color,fill,fs) {
    s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.04, fill: { color: fill||C.CODEBG }, line: { color: color||C.LINE, width: 1 } });
    s.addText(label, { x: x+0.06, y, w: w-0.12, h, align: "center", valign: "middle", fontFace: KFONT, fontSize: fs||10.5, bold: true, color: color||C.TEXT, margin: 0 });
  };

  // ① 명령어 캐시
  box(ix, by+0.44, iw, 0.36, "명령어 캐시 (Instruction Cache)", C.AMBER, "241A16", 11);
  // ② 워프 스케줄러 ×2
  const halfW = (iw-0.15)/2;
  box(ix,           by+0.9, halfW, 0.42, "워프 스케줄러", C.AMBER, "241A16", 11);
  box(ix+halfW+0.15,by+0.9, halfW, 0.42, "워프 스케줄러", C.AMBER, "241A16", 11);
  // ③ 디스패치 유닛 ×2
  box(ix,           by+1.38, halfW, 0.36, "디스패치 유닛 (Dispatch)", C.AMBER, "241A16", 10);
  box(ix+halfW+0.15,by+1.38, halfW, 0.36, "디스패치 유닛 (Dispatch)", C.AMBER, "241A16", 10);
  // ④ 레지스터 파일
  box(ix, by+1.82, iw, 0.36, "레지스터 파일 (Register File · 32,768 × 32-bit)", C.TEAL, "12212A", 11);

  // ⑤ 코어 배열 + LD/ST
  const coreY = by+2.3, coreH = 1.45;
  const coresW = iw*0.66;
  s.addText("CUDA 코어 × 32", { x: ix, y: coreY-0.02, w: coresW, h: 0.24, fontFace: KFONT, fontSize: 10, bold: true, color: C.TEXT, margin: 0 });
  const cols = 8, rows = 4;
  const cw = (coresW - (cols-1)*0.06)/cols, ch = (coreH-0.26 - (rows-1)*0.06)/rows;
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const x = ix + c*(cw+0.06), y = coreY+0.24 + r*(ch+0.06);
    s.addShape(p.ShapeType.roundRect, { x, y, w: cw, h: ch, rectRadius: 0.03, fill: { color: C.CODEBG }, line: { color: C.LINE, width: 0.75 } });
    s.addText("Core", { x, y, w: cw, h: ch, align: "center", valign: "middle", fontFace: "Courier New", fontSize: 7, color: C.MUTED, margin: 0 });
  }
  // LD/ST 열
  const lsx = ix+coresW+0.15, lsw = iw-coresW-0.15;
  box(lsx, coreY+0.24, lsw, coreH-0.26, "로드/스토어\n(LD/ST) × 16", C.AMBER2, "241A16", 11);

  // ⑥ 공유 메모리 / L1 캐시
  box(ix, by+bh-0.62, iw, 0.5, "공유 메모리 / L1 캐시 (64 KB · 구성 가능)", C.TEAL, "12212A", 11);

  // 오른쪽: MemtestG80 대응 패널
  const rx = bx+bw+0.35, rw = W-M-(bx+bw+0.35);
  card(s, rx, by, rw, bh, C.CARD, C.TEAL);
  s.addText("MemtestG80 대응", { x: rx+0.22, y: by+0.12, w: rw-0.44, h: 0.35, fontFace: KFONT, fontSize: 13, bold: true, color: C.TEAL, margin: 0 });
  const maps = [
    ["명령어 캐시", "커널 명령어 공급"],
    ["워프 스케줄러·디스패치", "워프(32스레드) 선택·발행 (SIMT)"],
    ["레지스터 파일", "커널 지역변수 (value, i, pattern)"],
    ["CUDA 코어", "스레드 연산 (a*value+c, __popc)"],
    ["LD/ST", "전역 메모리 접근 (coalescing)"],
    ["공유 메모리 / L1", "threadErrorCount[] · 트리 리덕션"],
  ];
  let my = by+0.6;
  maps.forEach((m) => {
    s.addText(m[0], { x: rx+0.22, y: my, w: rw-0.44, h: 0.26, fontFace: KFONT, fontSize: 11.5, bold: true, color: C.AMBER, margin: 0 });
    s.addText(m[1], { x: rx+0.22, y: my+0.26, w: rw-0.44, h: 0.42, fontFace: KFONT, fontSize: 10.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.02 });
    my += 0.72;
  });
  s.addNotes("Fermi 세대 SM 내부 구조: 명령어 캐시 → 워프 스케줄러·디스패치 → 레지스터 파일 → CUDA 코어/LD/ST → 공유 메모리·L1. 각 구성요소를 MemtestG80 커널 동작에 대응시켜 설명.");
})();

// 5 — 내장 변수
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "내장 변수 · 스레드의 신분증");
  s.addText("커널 안에서 자동으로 주어지는 값들. 이것으로 '내가 전체에서 몇 번째인지'를 계산합니다.", {
    x: M, y: 1.6, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 16, color: C.MUTED, margin: 0 });
  const rows = [
    ["blockIdx.x", "지금 이 블록의 번호 (0 ~ 1023)", C.AMBER, "스레드마다 다름"],
    ["threadIdx.x", "블록 안에서 이 스레드의 번호 (0 ~ 511)", C.TEAL, "스레드마다 다름"],
    ["blockDim.x", "블록당 스레드 수 (= 512)", C.TEAL, "모두 같음"],
    ["gridDim.x", "그리드의 블록 수 (= 1024)", C.AMBER, "모두 같음"],
  ];
  let y = 2.25;
  rows.forEach((r) => {
    card(s, M, y, W-2*M, 0.92);
    s.addText(r[0], { x: M+0.3, y: y+0.12, w: 3.2, h: 0.68, valign: "middle", fontFace: MONO, fontSize: 19, bold: true, color: r[2], margin: 0 });
    s.addText(r[1], { x: M+3.7, y: y+0.12, w: W-2*M-6.4, h: 0.68, valign: "middle", fontFace: KFONT, fontSize: 15.5, color: C.TEXT, margin: 0 });
    s.addText(r[3], { x: W-M-2.5, y: y+0.12, w: 2.3, h: 0.68, align: "right", valign: "middle", fontFace: KFONT, fontSize: 12.5, italic: true, color: C.MUTED, margin: 0 });
    y += 1.06;
  });
  s.addText("이 저장소는 .x 만 씁니다 (1차원). 메모리는 결국 1차원 주소 공간이기 때문입니다.", {
    x: M, y: 6.75, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("blockIdx/threadIdx는 스레드마다 다름, blockDim/gridDim은 모두 같음 — 이 대비가 주소 계산의 핵심입니다.");
})();

// 4b — 스레드 레이아웃 & 인덱싱 (block diagram)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "스레드 레이아웃 & 인덱싱 · 524,288개의 좌표계", C.TEAL);
  s.addText("그리드는 2단(블록→스레드) 구조. 앞의 내장 변수로 각 스레드는 전체에서 자기 번호(globalIdx)를 계산합니다.", {
    x: M, y: 1.42, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13.5, color: C.MUTED, margin: 0 });

  // --- 그리드 스트립 (1024 블록) ---
  const mx = M, mw = W-2*M, seg = mw/8;
  const gy = 2.15, gh = 0.72;
  s.addText("그리드 (gridDim.x = 1024 블록)", { x: mx, y: gy-0.32, w: mw, h: 0.3, fontFace: KFONT, fontSize: 12, bold: true, color: C.AMBER, margin: 0 });
  for (let i=0;i<8;i++) {
    const hot = (i===1);
    const label = i<7 ? ("블록 "+i) : "…  1023";
    s.addShape(p.ShapeType.roundRect, { x: mx+i*seg+0.03, y: gy, w: seg-0.06, h: gh, rectRadius: 0.04,
      fill: { color: hot ? "241A16" : C.CODEBG }, line: { color: hot ? C.AMBER2 : C.AMBER, width: hot ? 2 : 1 } });
    s.addText(label, { x: mx+i*seg, y: gy, w: seg, h: gh, align: "center", valign: "middle", fontFace: MONO, fontSize: 12, bold: hot, color: hot ? C.AMBER2 : C.TEXT, margin: 0 });
  }

  // --- 확대 연결 (블록 1 → 스레드 스트립) ---
  arrow(s, mx+1.5*seg, gy+gh, 0, 0.42, C.MUTED, { width: 2 });
  s.addText("블록 1개를 512 스레드로 확대", { x: mx+1.5*seg+0.2, y: gy+gh+0.02, w: 4.2, h: 0.35, valign: "middle", fontFace: KFONT, fontSize: 11.5, italic: true, color: C.MUTED, margin: 0 });

  // --- 스레드 스트립 (512 스레드) ---
  const ty = gy+gh+0.62, th = 0.72;
  s.addText("한 블록 (blockDim.x = 512 스레드)", { x: mx, y: ty-0.32, w: mw, h: 0.3, fontFace: KFONT, fontSize: 12, bold: true, color: C.TEAL, margin: 0 });
  for (let i=0;i<8;i++) {
    const label = i<7 ? ("T"+i) : "…  511";
    s.addShape(p.ShapeType.roundRect, { x: mx+i*seg+0.03, y: ty, w: seg-0.06, h: th, rectRadius: 0.04,
      fill: { color: C.CODEBG }, line: { color: C.TEAL, width: 1 } });
    s.addText(label, { x: mx+i*seg, y: ty, w: seg, h: th, align: "center", valign: "middle", fontFace: MONO, fontSize: 13, bold: true, color: C.TEXT, margin: 0 });
  }

  // --- globalIdx 공식 패널 ---
  const fy = ty+th+0.35;
  codePanel(s, M, fy, W-2*M, 0.92, [
    ln("globalIdx = blockIdx.x * blockDim.x + threadIdx.x", C.AMBER2, { breakLine: true }),
    ln("예) 블록 1, 스레드 2  →  1 * 512 + 2 = 514      (전체 524,288개 중 514번째 스레드)", C.TEAL, { breakLine: true }),
  ], { fontSize: 13.5, lineSpacing: 1.15 });

  // --- 두 카드: 인덱싱 규칙 / 메모리 분할 ---
  const cy = fy+1.1, ch = 1.45, cw = (W-2*M-0.4)/2;
  card(s, M, cy, cw, ch, C.CARD, C.TEAL);
  s.addText("인덱싱 규칙", { x: M+0.2, y: cy+0.1, w: cw-0.4, h: 0.32, fontFace: KFONT, fontSize: 13, bold: true, color: C.TEAL, margin: 0 });
  s.addText([
    ln("blockIdx.x", C.AMBER, { breakLine: false }), ln(" 내 블록(0~1023) · ", C.TEXT, { breakLine: false }),
    ln("threadIdx.x", C.AMBER, { breakLine: false }), ln(" 블록 내(0~511)\n", C.TEXT, { breakLine: true }),
    ln("1024 블록 × 512 스레드 = ", C.TEXT, { breakLine: false }), ln("524,288 스레드", C.AMBER2, { bold: true, breakLine: true }),
  ], { x: M+0.2, y: cy+0.48, w: cw-0.4, h: 0.9, fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });

  card(s, M+cw+0.4, cy, cw, ch, C.CARD, C.AMBER);
  s.addText("메모리 분할 (다음 슬라이드로 연결)", { x: M+cw+0.6, y: cy+0.1, w: cw-0.4, h: 0.32, fontFace: KFONT, fontSize: 13, bold: true, color: C.AMBER, margin: 0 });
  s.addText([
    ln("블록 b 는 ", C.TEXT, { breakLine: false }), ln("N·512 word", C.AMBER2, { breakLine: false }), ln(" 구역을 담당\n", C.TEXT, { breakLine: true }),
    ln("그 안에서 반복 ", C.TEXT, { breakLine: false }), ln("i·512 + threadIdx.x", C.TEAL, { breakLine: false }), ln(" 로 인터리빙\n", C.TEXT, { breakLine: true }),
    ln("→ 이 좌표 계산이 곧 ", C.TEXT, { breakLine: false }), ln("THREAD_ADDRESS", C.AMBER, { bold: true, breakLine: false }), ln(" 매크로", C.TEXT, { breakLine: true }),
  ], { x: M+cw+0.6, y: cy+0.48, w: cw-0.4, h: 0.9, fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.12 });

  s.addNotes("2단 레이아웃(그리드→블록→스레드)과 globalIdx 계산을 한 장에 시각화. 다음 슬라이드 THREAD_ADDRESS의 전제입니다.");
})();

// 6 — THREAD_ADDRESS 해부
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "★ THREAD_ADDRESS · 모든 테스트의 심장");
  codePanel(s, M, 1.6, W-2*M, 1.5, [
    ln("#define THREAD_ADDRESS(base, N, i)   \\", C.AMBER2),
    ln("   ( base", C.TEXT, { breakLine: false }),
    ln(" + blockIdx.x * N * blockDim.x", C.AMBER, { breakLine: false }),
    ln(" + i * blockDim.x", C.TEAL, { breakLine: false }),
    ln(" + threadIdx.x )", C.AMBER2, { breakLine: true }),
    ln("// core.cu:26 — 스레드 t가 i번째 반복에 건드릴 word 주소", C.FAINT, { breakLine: true }),
  ], { fontSize: 14 });
  const items = [
    ["base", C.TEXT, "테스트 영역의 시작 주소"],
    ["blockIdx.x * N * blockDim.x", C.AMBER, "이 블록이 담당하는 큰 구역의 시작 (블록마다 N·512 word씩 떨어짐)"],
    ["i * blockDim.x", C.TEAL, "블록 안에서 i번째 반복의 오프셋 (한 스레드가 N개 word 담당)"],
    ["threadIdx.x", C.AMBER2, "그 안에서 내 스레드의 위치 (0~511)"],
  ];
  let y = 3.4;
  items.forEach((it) => {
    s.addText(it[0], { x: M, y, w: 4.6, h: 0.7, valign: "top", fontFace: MONO, fontSize: 14, bold: true, color: it[1], margin: 0 });
    s.addText(it[2], { x: M+4.8, y, w: W-2*M-4.8, h: 0.7, valign: "top", fontFace: KFONT, fontSize: 15, color: C.TEXT, margin: 0, lineSpacingMultiple: 1.05 });
    y += 0.78;
  });
  s.addNotes("이 한 줄이 모든 write/verify 커널에 등장합니다. 각 항의 역할을 손가락으로 짚어가며 읽으세요.");
})();

// 7 — 인터리빙 & coalescing
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "왜 이렇게 매핑하나 · 메모리 병합(coalescing)");
  s.addText("같은 반복 i에서 이웃 스레드(threadIdx.x)가 이웃한 주소를 맡습니다. 이 '인터리빙'이 성능의 열쇠입니다.", {
    x: M, y: 1.55, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 15.5, color: C.MUTED, margin: 0 });
  // memory strip: consecutive addresses -> T0 T1 T2 ...
  const mx=M, my=2.35, mw=W-2*M, seg=mw/8, mh=0.95;
  for (let i=0;i<8;i++) {
    const label = i<7 ? "T"+i : "…";
    s.addShape(p.ShapeType.roundRect, { x: mx+i*seg+0.03, y: my, w: seg-0.06, h: mh, rectRadius: 0.04, fill: { color: C.CODEBG }, line: { color: i%2?C.TEAL:C.AMBER, width: 1 } });
    s.addText(label, { x: mx+i*seg, y: my+0.14, w: seg, h: 0.4, align: "center", fontFace: MONO, fontSize: 16, bold: true, color: C.TEXT, margin: 0 });
    s.addText(i<7?("+"+(i*4)+"B"):"", { x: mx+i*seg, y: my+0.55, w: seg, h: 0.3, align: "center", fontFace: MONO, fontSize: 10.5, color: C.MUTED, margin: 0 });
  }
  s.addText("연속된 메모리 주소 →", { x: mx, y: my+mh+0.1, w: mw, h: 0.3, align: "center", fontFace: KFONT, fontSize: 12, italic: true, color: C.MUTED, margin: 0 });
  card(s, M, 4.15, W-2*M, 2.1, C.CARD, C.TEAL);
  bullets(s, M+0.35, 4.4, W-2*M-0.7, 1.7, [
    ["워프(warp, 32스레드)의 접근이 하나의 메모리 트랜잭션으로 묶인다 → 대역폭 최대 활용", C.TEXT],
    ["만약 스레드가 큰 간격으로 흩어지면 트랜잭션이 쪼개져 느려진다 (uncoalesced)", C.TEXT],
    ["블록은 N·blockDim.x word씩 널찍이 떨어진 구역을 담당해 전체 영역을 빈틈없이 덮는다", C.TEXT],
  ], { fontSize: 15, gap: 9 });
  s.addNotes("coalescing은 세션 3(성능)의 복선. 여기서는 '이웃 스레드=이웃 주소'라는 직관만 각인시키면 됩니다.");
})();

// 8 — 첫 커널 완독
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "첫 커널 완독 · deviceWriteConstant");
  codePanel(s, M, 1.65, W-2*M, 2.9, [
    ln("__global__ void", C.AMBER, { breakLine: true }),
    ln("deviceWriteConstant(uint* base, uint N, const uint constant) {", C.TEXT, { breakLine: true }),
    ln("    for (uint i = 0; i < N; i++) {", C.TEXT, { breakLine: true }),
    ln("        *(THREAD_ADDRESS(base, N, i)) = constant;   // 각 스레드가 자기 word들을 채움", C.AMBER2, { breakLine: true }),
    ln("    }", C.TEXT, { breakLine: true }),
    ln("}", C.TEXT, { breakLine: true }),
  ], { fontSize: 14 });
  card(s, M, 4.75, W-2*M, 1.5, C.CARD, C.AMBER);
  s.addText([
    ln("놀랍도록 단순합니다. ", C.TEXT, { breakLine: false }),
    ln("경계 검사가 없는 이유", C.AMBER, { bold: true, breakLine: false }),
    ln(": 테스트 영역은 항상 2·N MiB의 배수로 할당되어 그리드에 딱 맞으므로, 범위를 벗어나는 스레드가 없습니다. 복잡함은 THREAD_ADDRESS 매크로가 모두 흡수했습니다.", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: 4.9, w: W-2*M-0.6, h: 1.2, fontFace: KFONT, fontSize: 15.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  s.addText("core.cu:189 — N개 반복으로 스레드 하나가 여러 word를 담당합니다.", {
    x: M, y: 6.4, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("THREAD_ADDRESS 덕에 커널 본문이 3줄. 인덱싱 복잡도를 매크로로 캡슐화하는 설계를 칭찬하세요.");
})();

// 9 — 호스트가 커널 부르기
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "8", "호스트가 커널을 부르는 법");
  codePanel(s, M, 1.7, W-2*M, 1.35, [
    ln("// core.cu:185 — gpuWriteConstant (호스트 함수)", C.FAINT),
    ln("deviceWriteConstant", C.AMBER, { breakLine: false }),
    ln("<<<nBlocks, nThreads>>>", C.TEAL, { bold: true, breakLine: false }),
    ln("(base, N, constant);", C.TEXT, { breakLine: true }),
    ln("//         ▲ 1024      ▲ 512", C.FAINT, { breakLine: true }),
  ], { fontSize: 13.5 });
  s.addText([
    ln("<<<nBlocks, nThreads>>>", C.TEAL, { bold: true, breakLine: false }),
    ln(" 삼중 꺾쇠가 실행 구성입니다. CPU 코드 한 줄이지만, 이 호출로 GPU에서 52만 개 스레드가 깨어납니다.", C.TEXT, { breakLine: true }),
  ], { x: M, y: 3.3, w: W-2*M, h: 0.9, fontFace: KFONT, fontSize: 17, color: C.TEXT, margin: 0, valign: "top" });
  card(s, M, 4.35, W-2*M, 1.9, C.CARD, C.AMBER);
  s.addText("nBlocks·nThreads는 어디서 오나?", { x: M+0.3, y: 4.55, w: W-2*M-0.6, h: 0.4, fontFace: KFONT, fontSize: 16, bold: true, color: C.AMBER, margin: 0 });
  codePanel(s, M+0.3, 5.0, W-2*M-0.6, 1.1, [
    ln("// core.h:78 — memtestState 클래스의 상수 멤버", C.FAINT),
    ln("memtestState() : nBlocks(1024), nThreads(512), ... {};", C.TEXT),
  ], { fontSize: 12.5 });
  s.addNotes("커널 launch는 비동기입니다(호스트는 곧바로 리턴). 이 성질은 세션 3·4에서 타이밍·오류와 함께 다룹니다.");
})();

// 8b — 커널 launch 흐름 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "8", "커널 launch 흐름 · 호출에서 완료까지", C.TEAL);
  s.addText("<<<>>> 한 줄을 실행하면, 요청이 GPU로 넘어가 블록이 SM에 분배되고 워프 단위로 실행됩니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });
  const fw = 7.7, fx = M;
  const steps = [
    ["① 호스트(CPU) — 커널 실행 요청", "deviceWriteConstant<<<1024, 512>>>(...)", C.TEAL, true],
    ["② GPU 스케줄러 — 블록을 SM에 분배", "블록 1024개 → 여러 SM에 나눠 배정", C.AMBER, false],
    ["③ 각 SM — 워프(32 스레드) 단위로 실행", "블록 안 512 스레드가 실제 연산 수행", C.AMBER, false],
    ["④ 커널 완료 — 결과는 전역 메모리에", "호스트는 SOFTWAIT로 완료를 기다림", C.AMBER, false],
  ];
  let y = 2.05; const bh = 0.92, step = 1.12;
  steps.forEach((st, i) => {
    card(s, fx, y, fw, bh, st[3] ? "16242C" : "241A16", st[2]);
    s.addText(st[0], { x: fx+0.28, y: y+0.12, w: fw-0.5, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: st[2], margin: 0, valign: "middle" });
    s.addText(st[1], { x: fx+0.28, y: y+0.5, w: fw-0.5, h: 0.32, fontFace: MONO, fontSize: 11, color: C.MUTED, margin: 0, valign: "middle" });
    if (i < steps.length-1) arrow(s, fx+fw/2, y+bh+0.02, 0, step-bh-0.04, C.FAINT);
    y += step;
  });
  s.addText("호스트", { x: fx+fw+0.15, y: 2.25, w: 1.5, h: 0.4, fontFace: KFONT, fontSize: 12, bold: true, color: C.TEAL, margin: 0 });
  s.addText("디바이스(GPU)", { x: fx+fw+0.15, y: 3.4, w: 1.9, h: 0.4, fontFace: KFONT, fontSize: 12, bold: true, color: C.AMBER, margin: 0 });
  const nx = 10.6, ny = 2.05, nw = W-M-10.6, nh = 4.35;
  card(s, nx, ny, nw, nh, C.CARD, C.RED);
  s.addText("비동기(async)", { x: nx+0.25, y: ny+0.2, w: nw-0.5, h: 0.45, fontFace: KFONT, fontSize: 16, bold: true, color: C.RED, margin: 0 });
  s.addText([
    ln("호스트는 ① 요청 후 곧바로 다음 코드로 갑니다.", C.TEXT, { breakLine: true, paraSpaceAfter: 10 }),
    ln("결과가 필요하면 SOFTWAIT로 GPU 완료를 기다립니다.", C.TEXT, { breakLine: true, paraSpaceAfter: 10 }),
    ln("→ 이 비동기 특성은 세션 2(검증)·세션 4(타이밍)에서 자세히.", C.MUTED, { breakLine: true, italic: true }),
  ], { x: nx+0.25, y: ny+0.8, w: nw-0.5, h: nh-1.0, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  s.addNotes("launch = CPU 한 줄 → GPU가 블록을 SM에 분배 → 워프 실행 → 완료. 호스트는 비동기로 리턴한다는 점이 다음 세션들의 복선.");
})();

// 10 — 정리/함정
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "9", "핵심 정리 & 자주 하는 실수");
  const colW = (W - 2*M - 0.4) / 2;
  card(s, M, 1.75, colW, 4.5);
  s.addText("기억할 것", { x: M+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 20, bold: true, color: C.AMBER, margin: 0 });
  bullets(s, M+0.3, 2.65, colW-0.6, 3.4, [
    "커널 = __global__, 반환형 void",
    "<<<1024, 512>>> = 블록수, 블록당 스레드수",
    "THREAD_ADDRESS로 겹치지 않는 자기 word 계산",
    "이웃 스레드 = 이웃 주소 → coalescing",
  ], { fontSize: 16, code: "2713", gap: 12 });
  const x2 = M+colW+0.4;
  card(s, x2, 1.75, colW, 4.5);
  s.addText("입문자 함정", { x: x2+0.3, y: 2.0, w: colW-0.6, h: 0.5, fontFace: KFONT, fontSize: 20, bold: true, color: C.RED, margin: 0 });
  bullets(s, x2+0.3, 2.65, colW-0.6, 3.4, [
    "커널을 일반 함수처럼 () 로 호출 → <<<>>> 필수",
    "커널에서 값을 return 하려 함 → void, 결과는 메모리로",
    "호스트 포인터를 커널에 그대로 전달 → 디바이스 포인터여야",
    "blockDim을 스레드마다 다르다고 착각 → 모두 같은 값",
  ], { fontSize: 15.5, code: "2717", gap: 12 });
  s.addNotes("네 가지 목표(슬라이드 2)로 돌아가 자가 점검을 유도하세요.");
})();

// 11 — 예고
outroSlide(
  "다음 세션 예고",
  "세션 2 · 메모리 모델과 쓰기·검증 패턴",
  [ ln("오늘 값을 쓴 커널이, 다음엔 그 값을 ", C.TEXT, { breakLine: false }),
    ln("되읽어 검증", C.TEAL, { bold: true, breakLine: false }),
    ln("합니다. 이것이 모든 메모리 테스트의 뼈대입니다.", C.TEXT, { breakLine: true }) ],
  [ ln("gpuWriteConstant  →  패턴을 쓴다", C.AMBER2),
    ln("gpuVerifyConstant →  되읽어 기대값과 비교한다", C.TEAL) ],
  "실습 랩 1(주소 매핑 실험)을 먼저 완료하고 오세요."
);

p.writeFile({ fileName: "세션1_스레드모델과_주소매핑.pptx" }).then((f) => console.log("wrote", f));
