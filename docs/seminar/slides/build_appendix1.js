// build_appendix1.js — 부록 1: CUDA Driver API 빌드 & 커널 로딩 (driver_api/ 분석)
// 문서판: docs/seminar/부록1_DriverAPI_빌드와_커널로딩.md
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, arrow, nodeBox, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

// 작은 라운드 라벨 박스 (내부 다이어그램용 · nodeBox보다 조밀)
function box(s, x, y, w, h, label, color, fill, fs) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: fill || C.CODEBG }, line: { color: color || C.LINE, width: 1.25 } });
  s.addText(label, { x: x+0.06, y, w: w-0.12, h, align: "center", valign: "middle", fontFace: KFONT, fontSize: fs || 12, bold: true, color: color || C.TEXT, margin: 0 });
}

// ============================================================ 1 — Title
titleSlide(
  "CUDA 세미나 · 부록 1",
  "Driver API 로 보는\n빌드 & 커널 로딩",
  "런타임 API가 숨겨 주던 것을 driver_api/ 에서 직접 본다",
  [ ln("nvcc -cubin  →  memtestG80.cubin      (빌드)", C.AMBER2),
    ln("cuModuleLoad → cuModuleGetFunction → cuLaunchKernel  (로딩)", C.TEAL) ]
);

// ============================================================ 2 — 왜 드라이버 API인가
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "왜 이 부록인가 · 런타임 API가 숨기던 것");
  s.addText("런타임 API(cudaMalloc, 커널<<<>>>)는 편하지만, GPU 프로그램이 어떻게 빌드·로드되는지 nvcc가 대신 처리해 감춰 줍니다. 드라이버 API는 그 단계를 직접 씁니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.6, fontFace: KFONT, fontSize: 15, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });

  const rows = [
    ["컨텍스트 생성", "(자동)", "cuInit → cuCtxCreate"],
    ["커널 배포", "실행 파일에 내장 (fatbin)", "별도 .cubin → cuModuleLoad"],
    ["커널 이름→핸들", "(자동)", "cuModuleGetFunction(\"이름\")"],
    ["인자 마샬링", "<<<>>> 가 자동 처리", "void* args[] 를 직접 구성"],
  ];
  const x0 = M, y0 = 2.35, wl = 3.1, wm = 4.6, wr = W-2*M-wl-wm, rh = 0.86;
  // 헤더
  s.addText("작업",            { x: x0,       y: y0, w: wl, h: 0.4, fontFace: KFONT, fontSize: 13, bold: true, color: C.FAINT, margin: 0.05 });
  s.addText("런타임 API (자동)", { x: x0+wl,    y: y0, w: wm, h: 0.4, fontFace: KFONT, fontSize: 13, bold: true, color: C.MUTED, margin: 0.05 });
  s.addText("드라이버 API (직접)",{ x: x0+wl+wm, y: y0, w: wr, h: 0.4, fontFace: KFONT, fontSize: 13, bold: true, color: C.AMBER, margin: 0.05 });
  let y = y0 + 0.5;
  rows.forEach((r, i) => {
    card(s, x0, y, wl+wm+wr, rh, i%2 ? C.CARD : C.CARD2);
    s.addText(r[0], { x: x0+0.15,     y, w: wl-0.2, h: rh, valign: "middle", fontFace: KFONT, fontSize: 13.5, bold: true, color: C.TEXT, margin: 0 });
    s.addText(r[1], { x: x0+wl+0.1,   y, w: wm-0.2, h: rh, valign: "middle", fontFace: KFONT, fontSize: 12.5, color: C.MUTED, margin: 0 });
    s.addText(r[2], { x: x0+wl+wm+0.1,y, w: wr-0.2, h: rh, valign: "middle", fontFace: MONO,  fontSize: 11.5, color: C.TEAL, margin: 0 });
    y += rh + 0.14;
  });
  s.addNotes("이 부록은 그중 빌드 과정(Part A)과 커널 로딩 과정(Part B)에 집중합니다.");
})();

// ============================================================ 3 — 전체 그림 (소스→빌드→산출물)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "전체 그림 · 소스에서 실행까지");
  s.addText("커널(.cu)과 호스트(.cpp)가 완전히 분리 — 빌드 시엔 독립, 실행 시에만 만난다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0 });

  // 디바이스 경로 (위, 앰버)
  nodeBox(s, M, 2.25, 3.5, 1.0, "memtestG80_kernels.cu", "__global__ / __device__", C.AMBER, "241A16");
  arrow(s, M+3.6, 2.75, 2.0, 0, C.AMBER, { width: 2.5 });
  s.addText("nvcc -cubin", { x: M+3.6, y: 2.42, w: 2.0, h: 0.3, align: "center", fontFace: MONO, fontSize: 10.5, color: C.AMBER, margin: 0 });
  nodeBox(s, M+5.7, 2.25, 3.4, 1.0, "memtestG80.cubin", "GPU 바이너리 (SASS)", C.AMBER, "241A16");

  // 호스트 경로 (아래, 틸)
  nodeBox(s, M, 4.0, 3.5, 1.0, "*.cpp (core / cli)", "호스트 코드 (cu* 호출)", C.TEAL, "12212A");
  arrow(s, M+3.6, 4.5, 2.0, 0, C.TEAL, { width: 2.5 });
  s.addText("g++  (-lcuda)", { x: M+3.6, y: 4.17, w: 2.0, h: 0.3, align: "center", fontFace: MONO, fontSize: 10.5, color: C.TEAL, margin: 0 });
  nodeBox(s, M+5.7, 4.0, 3.4, 1.0, "memtestG80", "호스트 실행 파일", C.TEAL, "12212A");

  // 런타임 연결 (실행 시 cuModuleLoad)
  arrow(s, M+7.4, 4.0, 0, -0.75, C.MUTED, { dashType: "dash", width: 2 });
  s.addText("실행 시 cuModuleLoad", { x: M+7.7, y: 3.35, w: 3.2, h: 0.35, align: "left", fontFace: KFONT, fontSize: 11.5, italic: true, color: C.MUTED, margin: 0 });

  card(s, M, 5.35, W-2*M, 1.25, C.CARD);
  s.addText([
    ln("핵심 ", C.AMBER, { bold: true, breakLine: false }),
    ln("— 커널은 nvcc로 별도 cubin이 되어 남고, 호스트는 g++로 실행 파일이 되며, 실행 파일은 ", C.TEXT, { breakLine: false }),
    ln("실행 중에", C.TEAL, { bold: true, breakLine: false }),
    ln(" cubin을 읽어 커널을 불러온다. 두 경로는 빌드 시점엔 서로를 링크하지 않는다.", C.TEXT, { breakLine: true }),
  ], { x: M+0.25, y: 5.5, w: W-2*M-0.5, h: 0.95, fontFace: KFONT, fontSize: 14, color: C.TEXT, margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
  s.addNotes("이 host/device 분리가 빌드·로딩 전체를 이해하는 열쇠입니다.");
})();

// ============================================================ 4 — [PART A] 두 갈래 컴파일
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "A", "빌드 ① · 호스트/디바이스 두 갈래 컴파일", C.AMBER);

  // 디바이스 경로
  card(s, M, 1.6, 5.7, 2.15, C.CARD, C.AMBER);
  s.addText("① 디바이스 경로 (GPU)", { x: M+0.2, y: 1.72, w: 5.3, h: 0.35, fontFace: KFONT, fontSize: 14, bold: true, color: C.AMBER, margin: 0 });
  box(s, M+0.3, 2.2, 2.3, 0.7, "kernels.cu", C.AMBER, "241A16", 12);
  arrow(s, M+2.7, 2.55, 0.9, 0, C.AMBER, { width: 2 });
  box(s, M+3.7, 2.2, 1.7, 0.7, "cubin", C.AMBER, "241A16", 12);
  s.addText("nvcc -cubin -arch=SMARCH", { x: M+0.3, y: 3.05, w: 5.1, h: 0.5, align: "center", fontFace: MONO, fontSize: 11, color: C.MUTED, margin: 0 });

  // 호스트 경로
  card(s, M+6.1, 1.6, W-2*M-6.1, 2.15, C.CARD, C.TEAL);
  s.addText("② 호스트 경로 (CPU)", { x: M+6.3, y: 1.72, w: 5, h: 0.35, fontFace: KFONT, fontSize: 14, bold: true, color: C.TEAL, margin: 0 });
  box(s, M+6.3, 2.2, 1.9, 0.7, "*.cpp", C.TEAL, "12212A", 12);
  arrow(s, M+8.3, 2.55, 0.7, 0, C.TEAL, { width: 2 });
  box(s, M+9.1, 2.2, 1.3, 0.7, "*.o", C.TEAL, "12212A", 12);
  arrow(s, M+10.5, 2.55, 0.55, 0, C.TEAL, { width: 2 });
  box(s, M+11.15, 2.2, 0.0+ (W-M-(M+11.15)), 0.7, "exe", C.TEAL, "12212A", 12);
  s.addText("g++ -c   →   g++ 링크 (-lcuda)", { x: M+6.3, y: 3.05, w: W-2*M-6.3, h: 0.5, align: "center", fontFace: MONO, fontSize: 11, color: C.MUTED, margin: 0 });

  card(s, M, 4.05, W-2*M, 2.5, C.CARD);
  bullets(s, M+0.35, 4.3, W-2*M-0.7, 2.1, [
    ["원본(런타임 API): 커널+호스트가 한 .cu → nvcc가 fatbin으로 실행 파일에 내장(개발자는 못 봄)", C.TEXT],
    ["이 판: 두 경로가 빌드 시점엔 완전히 독립 — cubin과 실행 파일은 서로 링크하지 않는다", C.AMBER2, true],
    ["둘은 오직 실행 시(cuModuleLoad)에만 만난다 = '런타임 커널 로딩'의 본질", C.TEAL, true],
    ["결과: 호스트 코드는 nvcc 없이 g++로만 컴파일된다 (GPU 툴체인은 cubin 만들 때만 필요)", C.TEXT],
  ], { fontSize: 14.5, gap: 12 });
  s.addNotes("두 경로의 독립성을 강조. cubin은 별도 산출물로 남는다.");
})();

// ============================================================ 5 — nvcc -cubin 내부 + extern "C"
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "A", "빌드 ② · nvcc -cubin 뜯어보기", C.AMBER);

  // .cu → PTX → SASS → cubin 파이프라인
  const bw = 2.55, by = 1.75, bh = 0.95, gap = 0.55;
  const labels = [["kernels.cu", "CUDA C++"], ["PTX", "가상 ISA"], ["SASS", "sm_XX 기계어"], ["cubin", "ELF 컨테이너"]];
  labels.forEach((l, i) => {
    const x = M + i*(bw+gap);
    nodeBox(s, x, by, bw, bh, l[0], l[1], C.AMBER, "241A16");
    if (i < labels.length-1) arrow(s, x+bw+0.03, by+bh/2, gap-0.06, 0, C.AMBER, { width: 2 });
  });
  s.addText("프런트엔드 → ptxas -arch=sm_XX → ELF 로 패키징", { x: M, y: by+bh+0.12, w: W-2*M, h: 0.35, align: "center", fontFace: MONO, fontSize: 11, color: C.MUTED, margin: 0 });

  codePanel(s, M, 3.35, W-2*M, 0.95, [
    ln("$(NVCC) -cubin -arch=$(SMARCH) -Xptxas -v -o memtestG80.cubin memtestG80_kernels.cu", C.AMBER2),
    ln("//  -arch: 대상 GPU 세대(sm_52/75/86/89)   -Xptxas -v: 레지스터·공유메모리 사용량 출력", C.FAINT),
  ], { fontSize: 12 });

  // 두 카드: 아키텍처 전용 / extern "C"
  const cw = (W-2*M-0.4)/2;
  card(s, M, 4.55, cw, 2.0, C.CARD, C.RED);
  s.addText("⚠ cubin은 그 아키텍처 전용", { x: M+0.2, y: 4.68, w: cw-0.4, h: 0.4, fontFace: KFONT, fontSize: 14, bold: true, color: C.RED, margin: 0 });
  s.addText("cubin에는 특정 sm_XX의 SASS만 담긴다. GPU와 SMARCH가 안 맞으면 로드 단계에서 실패. (호환성이 필요하면 PTX)", {
    x: M+0.2, y: 5.15, w: cw-0.4, h: 1.25, fontFace: KFONT, fontSize: 13, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });

  card(s, M+cw+0.4, 4.55, cw, 2.0, C.CARD, C.TEAL);
  s.addText('extern "C" — 이름을 고정', { x: M+cw+0.6, y: 4.68, w: cw-0.4, h: 0.4, fontFace: KFONT, fontSize: 14, bold: true, color: C.TEAL, margin: 0 });
  s.addText([
    ln("C++ 맹글링: deviceWriteConstant → _Z19device...\n", C.MUTED, { breakLine: true }),
    ln('extern "C" 로 감싸면 cubin에 소스 이름 그대로 심볼이 남아 → cuModuleGetFunction(m,"deviceWriteConstant") 성립', C.TEXT, { breakLine: true }),
  ], { x: M+cw+0.6, y: 5.15, w: cw-0.4, h: 1.25, fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.12 });
  s.addNotes("SASS는 세대 전용이라 cubin 이식성이 없다. extern \"C\"는 Part B의 이름 조회 전제.");
})();

// ============================================================ 6 — 호스트 컴파일 & 링크 (-lcuda)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "A", "빌드 ③ · 호스트 컴파일 & 링크(-lcuda)", C.AMBER);
  s.addText("호스트 코드엔 디바이스 코드가 한 줄도 없다(<<<>>> 없음). 필요한 건 cuda.h 뿐 → g++로 컴파일.", {
    x: M, y: 1.5, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0 });

  codePanel(s, M, 2.15, W-2*M, 0.95, [
    ln("g++ -c -O2 -Wall -m64 -I$(CUDA_INC)  memtestG80_core.cpp   # 호스트 오브젝트", C.TEXT),
    ln("g++ -m64 -o memtestG80 *.o -L$(CUDA_LIB) -L$(CUDA_STUB) -lcuda   # 링크", C.AMBER2),
  ], { fontSize: 12 });

  // libcudart vs libcuda 비교표
  const x0 = M, y0 = 3.4, wl = 2.6, wc = (W-2*M-wl)/2, rh = 0.72;
  s.addText("",             { x: x0, y: y0, w: wl, h: 0.4 });
  s.addText("libcudart (런타임)", { x: x0+wl,    y: y0, w: wc, h: 0.4, fontFace: KFONT, fontSize: 13, bold: true, color: C.MUTED, margin: 0.05 });
  s.addText("libcuda (드라이버)", { x: x0+wl+wc, y: y0, w: wc, h: 0.4, fontFace: KFONT, fontSize: 13, bold: true, color: C.AMBER, margin: 0.05 });
  const rows = [
    ["제공 심볼", "cudaMalloc, cudaMemcpy …", "cuInit, cuMemAlloc, cuLaunchKernel …"],
    ["배포", "CUDA Toolkit과 함께", "드라이버 설치 시 시스템에"],
    ["이 판에서", "사용 안 함", "사용 (-lcuda)"],
  ];
  let y = y0 + 0.45;
  rows.forEach((r, i) => {
    card(s, x0, y, wl+2*wc, rh, i%2 ? C.CARD : C.CARD2);
    s.addText(r[0], { x: x0+0.15,    y, w: wl-0.2, h: rh, valign: "middle", fontFace: KFONT, fontSize: 12.5, bold: true, color: C.TEXT, margin: 0 });
    s.addText(r[1], { x: x0+wl+0.1,  y, w: wc-0.2, h: rh, valign: "middle", fontFace: MONO, fontSize: 11, color: C.MUTED, margin: 0 });
    s.addText(r[2], { x: x0+wl+wc+0.1,y, w: wc-0.2, h: rh, valign: "middle", fontFace: MONO, fontSize: 11, color: C.TEAL, margin: 0 });
    y += rh + 0.12;
  });
  s.addText("-L$(CUDA_STUB)(lib64/stubs): 빌드 머신에 드라이버가 없어도 링크되도록 libcuda.so 스텁을 제공 (실행 시엔 진짜 드라이버 로드)", {
    x: M, y: 6.35, w: W-2*M, h: 0.6, fontFace: KFONT, fontSize: 12.5, italic: true, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  s.addNotes("GPU 툴체인(nvcc)은 오직 cubin 만들 때만 필요. 호스트는 순수 g++.");
})();

// ============================================================ 7 — Makefile 의존성 그래프
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "A", "빌드 ④ · Makefile 의존성 그래프", C.AMBER);

  // all → cubin / target
  nodeBox(s, 6.0, 1.55, 1.3, 0.6, "all", null, C.TEXT, C.CARD2);
  // 디바이스 가지
  arrow(s, 6.2, 2.15, -2.5, 0.5, C.AMBER, { width: 2 });
  nodeBox(s, 2.4, 2.65, 2.9, 0.8, "memtestG80.cubin", null, C.AMBER, "241A16");
  arrow(s, 3.85, 3.45, 0, 0.55, C.AMBER, { width: 2 });
  nodeBox(s, 2.4, 4.0, 2.9, 0.8, "kernels.cu", "nvcc -cubin", C.AMBER, "241A16");

  // 호스트 가지
  arrow(s, 7.1, 2.15, 2.4, 0.5, C.TEAL, { width: 2 });
  nodeBox(s, 8.2, 2.65, 2.9, 0.8, "memtestG80 (exe)", "g++ 링크 -lcuda", C.TEAL, "12212A");
  arrow(s, 8.9, 3.45, -0.6, 0.55, C.TEAL, { width: 1.75 });
  arrow(s, 10.4, 3.45, 0.5, 0.55, C.TEAL, { width: 1.75 });
  nodeBox(s, 7.0, 4.0, 2.2, 0.8, "core.o", "g++ -c", C.TEAL, "12212A");
  nodeBox(s, 9.9, 4.0, 2.2, 0.8, "cli.o", "g++ -c", C.TEAL, "12212A");
  s.addText("← core.cpp / core.h", { x: 7.0, y: 4.85, w: 2.2, h: 0.3, align: "center", fontFace: MONO, fontSize: 9.5, color: C.FAINT, margin: 0 });
  s.addText("← cli.cpp / *.hpp", { x: 9.9, y: 4.85, w: 2.2, h: 0.3, align: "center", fontFace: MONO, fontSize: 9.5, color: C.FAINT, margin: 0 });

  // 변수 표
  card(s, M, 5.4, W-2*M, 1.2, C.CARD);
  s.addText([
    ln("make SMARCH=sm_75", C.AMBER2, { breakLine: false }),
    ln("  (T4=75, Ampere=86, Ada=89)     ", C.MUTED, { breakLine: false }),
    ln("CUDA_PATH", C.TEAL, { breakLine: false }),
    ln("=/usr/local/cuda   ", C.MUTED, { breakLine: false }),
    ln("NVCC / CXX", C.TEAL, { breakLine: false }),
    ln(" 덮어쓰기 가능", C.MUTED, { breakLine: true }),
    ln("make", C.AMBER2, { breakLine: false }),
    ln(" → ① cubin ② 호스트 .o ③ 링크    ", C.MUTED, { breakLine: false }),
    ln("make clean", C.AMBER2, { breakLine: false }),
    ln(" → *.o · 실행 파일 · cubin 삭제", C.MUTED, { breakLine: true }),
  ], { x: M+0.25, y: 5.55, w: W-2*M-0.5, h: 0.95, fontFace: MONO, fontSize: 12, color: C.TEXT, margin: 0, valign: "middle", lineSpacingMultiple: 1.25 });
  s.addNotes("make는 바뀐 부분만 다시 빌드. SMARCH는 자기 GPU에 맞게 반드시 조정.");
})();

// ============================================================ 8 — cubin vs PTX vs fatbin
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "A", "빌드 ⑤ · cubin vs PTX vs fatbin", C.AMBER);
  const cards = [
    ["cubin", C.AMBER, "특정 sm_XX SASS", "❌ 그 세대 전용", "✅ 이 판의 선택\n(cubin 로딩 시연)"],
    ["PTX", C.TEAL, "가상 ISA", "✅ 드라이버가 실행 시 JIT", "대안 · 첫 실행 느림"],
    ["fatbin", C.MUTED, "여러 SASS + PTX", "✅ 넓음", "런타임 API 원본이\n내부적으로 사용"],
  ];
  const cw = (W-2*M-0.8)/3;
  cards.forEach((c, i) => {
    const x = M + i*(cw+0.4);
    card(s, x, 1.7, cw, 3.3, C.CARD, c[1]);
    s.addText(c[0], { x: x+0.2, y: 1.9, w: cw-0.4, h: 0.55, fontFace: MONO, fontSize: 20, bold: true, color: c[1], margin: 0 });
    s.addText([
      ln("담긴 것\n", C.FAINT, { breakLine: true }), ln(c[2]+"\n\n", C.TEXT, { breakLine: true }),
      ln("이식성\n", C.FAINT, { breakLine: true }), ln(c[3]+"\n\n", C.TEXT, { breakLine: true }),
      ln("메모\n", C.FAINT, { breakLine: true }), ln(c[4], C.TEXT, { breakLine: true }),
    ], { x: x+0.2, y: 2.55, w: cw-0.4, h: 2.35, fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  });
  card(s, M, 5.25, W-2*M, 1.3, C.CARD, C.TEAL);
  s.addText([
    ln("PTX로 바꾸려면 ", C.TEXT, { breakLine: false }),
    ln("Makefile의 -cubin → -ptx", C.AMBER2, { breakLine: false }),
    ln(", 산출물을 memtestG80.ptx 로만 바꾸면 된다. ", C.TEXT, { breakLine: false }),
    ln("로드 코드(Part B)는 그대로", C.TEAL, { bold: true, breakLine: false }),
    ln(" — cuModuleLoad는 cubin/PTX/fatbin을 모두 같은 방식으로 받는다(PTX면 로드 시 JIT).", C.TEXT, { breakLine: true }),
  ], { x: M+0.25, y: 5.42, w: W-2*M-0.5, h: 1.0, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
  s.addNotes("이식성↔전용성 트레이드오프. 본 예제는 요청대로 cubin 로딩 구조를 시연.");
})();

// ============================================================ 9 — [PART B] 런타임 수명주기
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "B", "로딩 ① · 실행 시 수명주기 전체", C.TEAL);
  const steps = [
    ["cuInit(0)", "드라이버 초기화", C.MUTED],
    ["cuDeviceGet · Attribute", "디바이스·compute capability", C.MUTED],
    ["cuCtxCreate", "컨텍스트 (이후 모든 cu* 대상)", C.MUTED],
    ["cuModuleLoad", "cubin 파일 → CUmodule", C.AMBER],
    ["cuModuleGetFunction", "이름 → CUfunction (K() 캐시)", C.AMBER],
    ["cuMemAlloc", "테스트 메모리 확보", C.MUTED],
    ["cuLaunchKernel + SOFTWAIT + cuMemcpyDtoH", "13종 테스트 반복", C.TEAL],
    ["cuMemFree · cuModuleUnload · cuCtxDestroy", "정리", C.MUTED],
  ];
  let y = 1.55; const rh = 0.62;
  steps.forEach((st, i) => {
    const hot = st[2] === C.AMBER;
    nodeBox(s, M, y, 5.6, rh, null, null, hot ? C.AMBER : C.LINE, hot ? "241A16" : C.CODEBG);
    s.addText(st[0], { x: M+0.15, y, w: 5.3, h: rh, valign: "middle", fontFace: MONO, fontSize: 11.5, bold: hot, color: st[2], margin: 0 });
    s.addText(st[1], { x: M+5.85, y, w: 4.0, h: rh, valign: "middle", fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0 });
    if (i < steps.length-1) arrow(s, M+2.8, y+rh, 0, 0.075, C.FAINT, { width: 1.5 });
    y += rh + 0.075;
  });
  // 강조 콜아웃
  card(s, 10.2, 3.0, W-M-10.2, 2.2, C.CARD, C.AMBER);
  s.addText("로딩 핵심 3단계", { x: 10.4, y: 3.15, w: 2.5, h: 0.4, fontFace: KFONT, fontSize: 13.5, bold: true, color: C.AMBER, margin: 0 });
  s.addText("③ cuModuleLoad\n④ cuModuleGetFunction\n⑥ cuLaunchKernel", { x: 10.4, y: 3.6, w: W-M-10.6, h: 1.5, fontFace: MONO, fontSize: 12, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.3 });
  s.addNotes("런타임 API가 자동으로 하던 순서를 직접 맞춘다. compute capability는 cubin SMARCH와 맞아야 한다.");
})();

// ============================================================ 10 — cuModuleLoad → GetFunction (+K 캐시)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "B", "로딩 ② · 모듈 로드 → 심볼 해석", C.TEAL);

  // 다이어그램: cubin → CUmodule → CUfunction
  nodeBox(s, M, 1.65, 3.0, 0.95, "memtestG80.cubin", "파일", C.AMBER, "241A16");
  arrow(s, M+3.1, 2.12, 1.1, 0, C.TEAL, { width: 2 });
  s.addText("cuModuleLoad", { x: M+3.0, y: 1.8, w: 1.3, h: 0.3, align: "center", fontFace: MONO, fontSize: 9.5, color: C.TEAL, margin: 0 });
  nodeBox(s, M+4.3, 1.65, 2.6, 0.95, "CUmodule", "g_module", C.TEAL, "12212A");
  arrow(s, M+7.0, 2.12, 1.2, 0, C.TEAL, { width: 2 });
  s.addText("GetFunction", { x: M+6.9, y: 1.8, w: 1.4, h: 0.3, align: "center", fontFace: MONO, fontSize: 9.5, color: C.TEAL, margin: 0 });
  nodeBox(s, M+8.3, 1.65, 3.0, 0.95, "CUfunction", '이름으로 조회', C.TEAL, "12212A");

  codePanel(s, M, 2.95, W-2*M, 2.15, [
    ln("static CUmodule g_module = 0;", C.MUTED),
    ln("static std::map<std::string, CUfunction> g_funcs;   // 이름→핸들 캐시", C.MUTED),
    ln("", C.TEXT),
    ln("bool memtestG80_initKernels(const char* path) {", C.TEXT),
    ln("    return cuModuleLoad(&g_module, path) == CUDA_SUCCESS;   // 파일 → 모듈", C.AMBER2),
    ln("}", C.TEXT),
    ln("static CUfunction K(const char* name) {                    // 조회 + 캐시", C.TEXT),
    ln("    if (g_funcs.count(name)) return g_funcs[name];", C.TEXT),
    ln("    CUfunction f = 0;  cuModuleGetFunction(&f, g_module, name);", C.TEAL),
    ln("    return g_funcs[name] = f;", C.TEXT),
    ln("}", C.TEXT),
  ], { fontSize: 11.5, lineSpacing: 1.02 });

  card(s, M, 5.35, W-2*M, 1.2, C.CARD);
  s.addText([
    ln("이름이 그대로 통하는 건 ", C.TEXT, { breakLine: false }),
    ln('extern "C"', C.AMBER, { bold: true, breakLine: false }),
    ln(" 덕분(Part A). ", C.TEXT, { breakLine: false }),
    ln("K()", C.TEAL, { bold: true, breakLine: false }),
    ln(" 는 조회 결과를 캐시해 13종 테스트를 수십 번 반복해도 심볼을 다시 찾지 않는다. cubin엔 12개 커널이 노출됨.", C.TEXT, { breakLine: true }),
  ], { x: M+0.25, y: 5.5, w: W-2*M-0.5, h: 0.95, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
  s.addNotes("deviceWriteConstant/Verify… 등 12개. 아키텍처 불일치면 cuModuleLoad에서 실패.");
})();

// ============================================================ 11 — cuLaunchKernel 인자 마샬링
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "B", "로딩 ③ · cuLaunchKernel 인자 마샬링", C.TEAL);
  s.addText("가장 큰 차이는 인자 전달 — <<<>>>는 컴파일러가 자동 포장, 드라이버 API는 '각 인자의 주소' 배열을 직접 만든다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0 });

  const cw = (W-2*M-0.5)/2;
  // 런타임
  card(s, M, 2.15, cw, 1.75, C.CARD, C.MUTED);
  s.addText("런타임 API", { x: M+0.2, y: 2.25, w: cw-0.4, h: 0.35, fontFace: KFONT, fontSize: 13, bold: true, color: C.MUTED, margin: 0 });
  codePanel(s, M+0.2, 2.65, cw-0.4, 1.1, [
    ln("deviceVerifyConstant", C.AMBER2),
    ln("  <<<nBlocks,nThreads,shmem>>>", C.TEXT),
    ln("  (base, N, constant, errCnt);", C.TEXT),
  ], { fontSize: 11 });
  // 드라이버
  card(s, M+cw+0.5, 2.15, cw, 1.75, C.CARD, C.TEAL);
  s.addText("드라이버 API", { x: M+cw+0.7, y: 2.25, w: cw-0.4, h: 0.35, fontFace: KFONT, fontSize: 13, bold: true, color: C.TEAL, margin: 0 });
  codePanel(s, M+cw+0.7, 2.65, cw-0.4, 1.1, [
    ln("void* args[] =", C.TEAL),
    ln("  { &base, &N, &constant, &errCnt };", C.TEXT),
    ln("cuLaunchKernel(K(\"...\"), ...args...);", C.AMBER2),
  ], { fontSize: 11 });

  codePanel(s, M, 4.1, W-2*M, 1.35, [
    ln("cuLaunchKernel(f,", C.TEXT),
    ln("    grid,1,1,   block,1,1,   // gridDim / blockDim (1D)", C.TEAL),
    ln("    shmem,      // 동적 공유 메모리 바이트 (검증 커널의 threadErrorCount[] 리덕션 버퍼)", C.AMBER2),
    ln("    0,          args,        0);  // 스트림(기본) · 인자 포인터 배열 · extra", C.TEXT),
  ], { fontSize: 12 });

  card(s, M, 5.6, W-2*M, 0.95, C.CARD, C.RED);
  s.addText([
    ln("주의 ", C.RED, { bold: true, breakLine: false }),
    ln("— args[]에는 값이 아니라 ", C.TEXT, { breakLine: false }),
    ln("주소", C.AMBER, { bold: true, breakLine: false }),
    ln("가 들어간다. 임시값도 lvalue여야 함 (gpuModuloX가 pattern2를 지역변수로 두는 이유).", C.TEXT, { breakLine: true }),
  ], { x: M+0.25, y: 5.72, w: W-2*M-0.5, h: 0.7, fontFace: KFONT, fontSize: 13, color: C.TEXT, margin: 0, valign: "middle" });
  s.addNotes("shmem 인자 = sizeof(uint)*nThreads. <<<>>> 한 줄이 이만큼 풀린다.");
})();

// ============================================================ 12 — 한 번의 테스트 호출 시퀀스
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "B", "로딩 ④ · 한 번의 테스트 호출 (host↔driver↔GPU)", C.TEAL);

  // 3 레인
  const lanes = [["호스트 (core.cpp)", C.TEAL, M], ["CUDA 드라이버", C.AMBER, M+4.4], ["GPU", C.RED, M+8.8]];
  const laneW = 3.9;
  lanes.forEach((l) => {
    s.addText(l[0], { x: l[2], y: 1.5, w: laneW, h: 0.4, align: "center", fontFace: KFONT, fontSize: 13, bold: true, color: l[1], margin: 0 });
    s.addShape(p.ShapeType.line, { x: l[2]+laneW/2, y: 1.95, w: 0, h: 4.5, line: { color: C.LINE, width: 1.5, dashType: "dash" } });
  });

  const steps = [
    ["K(\"deviceVerify…\") → CUfunction", 0, 1, C.TEAL],
    ["cuLaunchKernel (비동기)", 0, 2, C.AMBER],
    ["커널 디스패치", 1, 2, C.AMBER],
    ["SOFTWAIT: cuStreamQuery(0) 폴링(1ms)", 0, 1, C.MUTED],
    ["커널 완료 (블록별 오류 기록)", 2, 1, C.RED],
    ["cuMemcpyDtoH (블록별 오류 배열)", 0, 1, C.TEAL],
    ["CPU에서 nBlocks개 합산 → 총 오류", 0, 0, C.TEXT],
  ];
  let y = 2.15; const step = 0.62;
  const cx = [M+laneW/2, M+4.4+laneW/2, M+8.8+laneW/2];
  steps.forEach((st) => {
    const a = cx[st[1]], b = cx[st[2]];
    if (st[1] === st[2]) {
      s.addText(st[0], { x: a-1.9, y, w: 3.8, h: 0.4, align: "center", valign: "middle", fontFace: KFONT, fontSize: 10.5, color: st[3], margin: 0, fill: { color: C.CARD } });
    } else {
      arrow(s, Math.min(a,b), y+0.2, Math.abs(b-a), 0, st[3], { width: 2 });
      s.addText(st[0], { x: Math.min(a,b), y: y-0.12, w: Math.abs(b-a), h: 0.32, align: "center", fontFace: KFONT, fontSize: 10, color: st[3], margin: 0 });
    }
    y += step;
  });
  s.addText("↑ 이 시퀀스가 13종 테스트마다 반복되고, 그 전체가 maxIters 번 반복된다.", {
    x: M, y: 6.6, w: W-2*M, h: 0.4, align: "center", fontFace: KFONT, fontSize: 12.5, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("gpuVerifyConstant 한 번의 실제 경로. SOFTWAIT는 15초 초과 시 타임아웃 센티넬 반환.");
})();

// ============================================================ 13 — 런타임 ↔ 드라이버 대응표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "C", "런타임 API ↔ 드라이버 API 대응표", C.AMBER);
  const rows = [
    ["초기화", "(자동)", "cuInit · cuCtxCreate"],
    ["디바이스 열거", "cudaGetDeviceProperties", "cuDeviceGet · cuDeviceGetAttribute"],
    ["커널 로딩", "(실행 파일에 fatbin 내장)", "cuModuleLoad → cuModuleGetFunction", true],
    ["커널 실행", "kernel<<<g,b,s>>>(args)", "cuLaunchKernel(f, g,1,1, b,1,1, s,0,args,0)", true],
    ["메모리 할당", "cudaMalloc / cudaFree", "cuMemAlloc / cuMemFree"],
    ["메모리 복사", "cudaMemcpy(DtoH/DtoD)", "cuMemcpyDtoH / cuMemcpyDtoD"],
    ["완료 대기", "cudaStreamQuery(0)", "cuStreamQuery(0)"],
    ["디바이스 포인터", "uint*", "CUdeviceptr (바이트 주소)"],
    ["링크 라이브러리", "-lcudart", "-lcuda"],
  ];
  const x0 = M, y0 = 1.55, wl = 2.7, wm = 4.4, wr = W-2*M-wl-wm, rh = 0.5;
  s.addText("작업",        { x: x0,       y: y0, w: wl, h: 0.4, fontFace: KFONT, fontSize: 12.5, bold: true, color: C.FAINT, margin: 0.05 });
  s.addText("런타임 API",   { x: x0+wl,    y: y0, w: wm, h: 0.4, fontFace: KFONT, fontSize: 12.5, bold: true, color: C.MUTED, margin: 0.05 });
  s.addText("드라이버 API", { x: x0+wl+wm, y: y0, w: wr, h: 0.4, fontFace: KFONT, fontSize: 12.5, bold: true, color: C.AMBER, margin: 0.05 });
  let y = y0 + 0.45;
  rows.forEach((r, i) => {
    const hot = r[3] === true;
    card(s, x0, y, wl+wm+wr, rh, hot ? "241A16" : (i%2 ? C.CARD : C.CARD2), hot ? C.AMBER : null);
    s.addText(r[0], { x: x0+0.15,     y, w: wl-0.2, h: rh, valign: "middle", fontFace: KFONT, fontSize: 11.5, bold: true, color: hot ? C.AMBER : C.TEXT, margin: 0 });
    s.addText(r[1], { x: x0+wl+0.1,   y, w: wm-0.2, h: rh, valign: "middle", fontFace: MONO, fontSize: 10.5, color: C.MUTED, margin: 0 });
    s.addText(r[2], { x: x0+wl+wm+0.1,y, w: wr-0.2, h: rh, valign: "middle", fontFace: MONO, fontSize: 10.5, color: C.TEAL, margin: 0 });
    y += rh + 0.08;
  });
  s.addNotes("바뀐 것은 '호스트가 GPU를 부리는 방식'뿐 — 테스트 알고리즘·리덕션·PRNG는 원본과 동일.");
})();

// ============================================================ 14 — 정리 / 예고
outroSlide(
  "부록 1 정리",
  "빌드는 두 갈래, 로딩은 세 단계",
  [ ln("빌드: 커널 .cu → nvcc -cubin → 별도 cubin · 호스트 .cpp → g++ → 실행 파일(-lcuda). 둘은 빌드 시 독립.\n", C.TEXT, { breakLine: true }),
    ln("로딩: cuModuleLoad → cuModuleGetFunction → cuLaunchKernel. 런타임이 감추던 걸 직접 본다.", C.TEXT, { breakLine: true }) ],
  [ ln("직접 해보기: cuobjdump로 cubin 심볼 보기 · SMARCH 불일치 로드 실패 재현 · PTX로 전환", C.AMBER2),
    ln("문서판: docs/seminar/부록1_DriverAPI_빌드와_커널로딩.md (block diagram 8종 · 실습 5개)", C.TEAL) ],
  "원본 소스: driver_api/  ·  본편 세션 1(커널 실행)·세션 5(3계층 API)와 함께 보세요."
);

p.writeFile({ fileName: "부록1_DriverAPI_빌드와_커널로딩.pptx" }).then((f) => console.log("wrote", f));
