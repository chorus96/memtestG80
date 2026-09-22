// build_appendix2.js — 부록 2: driver_api_study (CUDA Driver API 최소 예제 만들기)
// 문서판: docs/seminar/부록2_DriverAPI_최소예제_단일파일.md
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, arrow, nodeBox, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

// 작은 라운드 라벨 박스 (내부 다이어그램용)
function box(s, x, y, w, h, label, color, fill, fs) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: fill || C.CODEBG }, line: { color: color || C.LINE, width: 1.25 } });
  s.addText(label, { x: x+0.06, y, w: w-0.12, h, align: "center", valign: "middle", fontFace: KFONT, fontSize: fs || 12, bold: true, color: color || C.TEXT, margin: 0 });
}

// ============================================================ 1 — Title
titleSlide(
  "CUDA 세미나 · 부록 2",
  "Driver API 최소 예제\n만들기",
  "driver_api_study — 덜어내며 배우는 커널 로딩·실행의 뼈대",
  [ ln("driver_api/  (1,049줄 + ezOptionParser ~2,100줄)", C.FAINT),
    ln("   →  driver_api_study/  (293줄 · 단일 호스트 파일)", C.TEAL) ]
);

// ============================================================ 2 — 왜 이 부록인가
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "왜 이 부록인가 · 덜어내며 배운다", C.TEAL);
  s.addText("부록 1은 개념(포팅), 부록 2는 그것을 교육용으로 최소화한 과정을 다룹니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });

  const cw = (W-2*M-0.5)/2;
  card(s, M, 2.1, cw, 2.5, C.CARD, C.AMBER);
  s.addText("부록 1 — driver_api/", { x: M+0.25, y: 2.28, w: cw-0.5, h: 0.4, fontFace: KFONT, fontSize: 16, bold: true, color: C.AMBER, margin: 0 });
  s.addText([
    ln("런타임 API → 드라이버 API 포팅\n", C.TEXT, { breakLine: true }),
    ln("빌드·커널 로딩 원리를 드러냄\n", C.TEXT, { breakLine: true }),
    ln("여전히 실제 도구 (13종 테스트 등)", C.MUTED, { breakLine: true }),
  ], { x: M+0.25, y: 2.8, w: cw-0.5, h: 1.6, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.2 });

  card(s, M+cw+0.5, 2.1, cw, 2.5, C.CARD, C.TEAL);
  s.addText("부록 2 — driver_api_study/", { x: M+cw+0.75, y: 2.28, w: cw-0.5, h: 0.4, fontFace: KFONT, fontSize: 16, bold: true, color: C.TEAL, margin: 0 });
  s.addText([
    ln("CUDA와 무관한 코드를 걷어냄\n", C.TEXT, { breakLine: true }),
    ln("커널 2개 + 호스트 1파일만 남김\n", C.TEXT, { breakLine: true }),
    ln("남은 것 = 커널 로딩·실행 최소 집합", C.TEAL, { bold: true, breakLine: true }),
  ], { x: M+cw+0.75, y: 2.8, w: cw-0.5, h: 1.6, fontFace: KFONT, fontSize: 13.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.2 });

  card(s, M, 4.85, W-2*M, 1.5, "12212A", C.TEAL);
  s.addText([
    ln("핵심 질문 ", C.TEAL, { bold: true, breakLine: false }),
    ln("— \"무엇을 덜어내면 CUDA Driver API로 커널을 로드·실행하는 최소 골격이 드러나는가?\"", C.TEXT, { breakLine: true }),
    ln("덜어내면서 무엇이 필수였는지 배운다. 남은 코드가 곧 GPU 커널 하나를 돌리는 데 필요한 최소 집합.", C.MUTED, { breakLine: true }),
  ], { x: M+0.3, y: 5.05, w: W-2*M-0.6, h: 1.1, fontFace: KFONT, fontSize: 14, color: C.TEXT, margin: 0, valign: "middle", lineSpacingMultiple: 1.25 });
  s.addNotes("부록 1과의 관계를 먼저 짚고, 이 부록은 '축소 과정' 자체가 학습 대상임을 강조.");
})();

// ============================================================ 3 — 간결화 6단계
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "간결화 6단계 · driver_api → driver_api_study", C.AMBER);
  const rows = [
    ["1", "ezOptionParser.hpp 제거", "서드파티 인자 파서 → 표준 C++ 파싱"],
    ["2", "라이선스 출력 제거", "-l/--license · print_licensing"],
    ["3", "대역폭 측정 제거", "D2D 복사 + gpuMemoryBandwidth"],
    ["4", "13종 테스트 → 1종", "Moving Inversions (ones/zeros)"],
    ["5", "미사용 커널·함수 정리", "LCG·워킹·랜덤·모듈로 커널, PRNG 헬퍼"],
    ["6", "배너·경로 단순화 + core 병합", "core.{h,cpp} → cli.cpp (단일 파일)"],
  ];
  let y = 1.65; const rh = 0.78;
  rows.forEach((r, i) => {
    card(s, M, y, W-2*M, rh, i%2 ? C.CARD : C.CARD2);
    s.addText(r[0], { x: M+0.2, y: y+0.12, w: 0.55, h: rh-0.24, align: "center", valign: "middle", fontFace: MONO, fontSize: 18, bold: true, color: C.BG, fill: { color: i<3 ? C.AMBER : C.TEAL }, shape: p.ShapeType.roundRect, rectRadius: 0.28 });
    s.addText(r[1], { x: M+1.0, y, w: 5.4, h: rh, valign: "middle", fontFace: KFONT, fontSize: 14.5, bold: true, color: C.TEXT, margin: 0 });
    s.addText(r[2], { x: M+6.5, y, w: W-2*M-6.7, h: rh, valign: "middle", fontFace: KFONT, fontSize: 12.5, color: C.MUTED, margin: 0 });
    y += rh + 0.1;
  });
  s.addNotes("1~3은 부가 기능 제거, 4~6은 핵심만 남기는 구조 정리. 단계마다 g++ 문법 검증으로 안전하게 진행.");
})();

// ============================================================ 4 — 규모 before/after
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "결과 · 소스 규모", C.AMBER);

  const cw = (W-2*M-0.5)/2;
  // before
  card(s, M, 1.9, cw, 2.6, C.CARD, C.MUTED);
  s.addText("driver_api/", { x: M+0.25, y: 2.05, w: cw-0.5, h: 0.4, fontFace: MONO, fontSize: 15, bold: true, color: C.MUTED, margin: 0 });
  s.addText("1,049", { x: M, y: 2.5, w: cw, h: 1.0, align: "center", fontFace: MONO, fontSize: 54, bold: true, color: C.MUTED, margin: 0 });
  s.addText("호스트+커널 코드 줄\n+ ezOptionParser.hpp ~2,100줄", { x: M+0.25, y: 3.6, w: cw-0.5, h: 0.8, align: "center", fontFace: KFONT, fontSize: 12.5, color: C.FAINT, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });

  // arrow
  s.addText("→", { x: M+cw, y: 2.9, w: 0.5, h: 0.6, align: "center", valign: "middle", fontFace: KFONT, fontSize: 30, bold: true, color: C.TEAL, margin: 0 });

  // after
  card(s, M+cw+0.5, 1.9, cw, 2.6, C.CARD, C.TEAL);
  s.addText("driver_api_study/", { x: M+cw+0.75, y: 2.05, w: cw-0.5, h: 0.4, fontFace: MONO, fontSize: 15, bold: true, color: C.TEAL, margin: 0 });
  s.addText("293", { x: M+cw+0.5, y: 2.5, w: cw, h: 1.0, align: "center", fontFace: MONO, fontSize: 54, bold: true, color: C.TEAL, margin: 0 });
  s.addText("커널 59줄 + 호스트 234줄 (단일 파일)\n서드파티 0줄", { x: M+cw+0.75, y: 3.6, w: cw-0.5, h: 0.8, align: "center", fontFace: KFONT, fontSize: 12.5, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });

  card(s, M, 4.75, W-2*M, 1.55, C.CARD);
  const cols = [
    ["커널 *.cu", "295", "59"],
    ["호스트 *.h+*.cpp", "754", "234"],
    ["서드파티", "~2,100", "0"],
  ];
  const x0 = M+0.3, wl=4.6, wc=(W-2*M-0.6-4.6)/2;
  s.addText("항목", { x: x0, y: 4.9, w: wl, h: 0.3, fontFace: KFONT, fontSize: 12, bold: true, color: C.FAINT, margin: 0 });
  s.addText("driver_api", { x: x0+wl, y: 4.9, w: wc, h: 0.3, align:"center", fontFace: KFONT, fontSize: 12, bold: true, color: C.MUTED, margin: 0 });
  s.addText("study", { x: x0+wl+wc, y: 4.9, w: wc, h: 0.3, align:"center", fontFace: KFONT, fontSize: 12, bold: true, color: C.TEAL, margin: 0 });
  let yy = 5.25;
  cols.forEach((c) => {
    s.addText(c[0], { x: x0, y: yy, w: wl, h: 0.32, fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0 });
    s.addText(c[1], { x: x0+wl, y: yy, w: wc, h: 0.32, align:"center", fontFace: MONO, fontSize: 12.5, color: C.MUTED, margin: 0 });
    s.addText(c[2], { x: x0+wl+wc, y: yy, w: wc, h: 0.32, align:"center", fontFace: MONO, fontSize: 12.5, color: C.TEAL, margin: 0 });
    yy += 0.34;
  });
  s.addNotes("규모가 준 것 자체보다, 남은 293줄이 '필수 골격'이라는 점을 강조.");
})();

// ============================================================ 5 — 최종 구조
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "최종 구조 · 파일 3개", C.TEAL);
  nodeBox(s, M, 2.0, W-2*M, 1.15, "memtestG80_kernels.cu", "디바이스 커널 2개 → cubin  (deviceWriteConstant · deviceVerifyConstant)", C.AMBER, "241A16");
  nodeBox(s, M, 3.4, W-2*M, 1.15, "memtestG80_cli.cpp", "단일 호스트 파일 — 인자 파싱 · 컨텍스트 · cubin 로드 · 모듈 관리 · 대표 테스트 · 정리", C.TEAL, "12212A");
  nodeBox(s, M, 4.8, W-2*M, 0.95, "Makefile", "cubin(nvcc) + 호스트 단일 파일(g++ -lcuda)", C.MUTED, C.CARD);
  s.addText("호스트 코드가 파일 하나 → Driver API 흐름을 위에서 아래로 한 번에 읽을 수 있다.", {
    x: M, y: 5.95, w: W-2*M, h: 0.5, align: "center", fontFace: KFONT, fontSize: 14, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("driver_api/는 core+cli+ezOptionParser 다중 파일. 여기서는 호스트 컴파일 단위가 cli.cpp 하나.");
})();

// ============================================================ 6 — 빌드 파이프라인
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "빌드 파이프라인 · 커널/호스트는 빌드 시 독립", C.AMBER);
  s.addText("cubin 과 실행 파일은 서로 링크하지 않고, 실행 중 cuModuleLoad 로만 만난다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0 });

  // 디바이스 경로
  nodeBox(s, M, 2.3, 3.6, 1.0, "memtestG80_kernels.cu", "커널 2개 · extern \"C\"", C.AMBER, "241A16");
  arrow(s, M+3.7, 2.8, 2.0, 0, C.AMBER, { width: 2.5 });
  s.addText("nvcc -cubin -arch", { x: M+3.7, y: 2.47, w: 2.0, h: 0.3, align: "center", fontFace: MONO, fontSize: 10, color: C.AMBER, margin: 0 });
  nodeBox(s, M+5.8, 2.3, 3.4, 1.0, "memtestG80.cubin", "GPU 바이너리 (SASS)", C.AMBER, "241A16");

  // 호스트 경로
  nodeBox(s, M, 4.05, 3.6, 1.0, "memtestG80_cli.cpp", "단일 호스트 파일", C.TEAL, "12212A");
  arrow(s, M+3.7, 4.55, 2.0, 0, C.TEAL, { width: 2.5 });
  s.addText("g++  (-lcuda)", { x: M+3.7, y: 4.22, w: 2.0, h: 0.3, align: "center", fontFace: MONO, fontSize: 10, color: C.TEAL, margin: 0 });
  nodeBox(s, M+5.8, 4.05, 3.4, 1.0, "memtestG80", "실행 파일", C.TEAL, "12212A");

  // 런타임 연결
  arrow(s, M+7.5, 4.05, 0, -0.75, C.MUTED, { dashType: "dash", width: 2 });
  s.addText("실행 시 cuModuleLoad", { x: M+7.8, y: 3.4, w: 3.2, h: 0.35, valign: "middle", fontFace: KFONT, fontSize: 11.5, italic: true, color: C.MUTED, margin: 0 });

  card(s, M, 5.4, W-2*M, 0.95, C.CARD);
  s.addText([
    ln("디바이스: ", C.AMBER, { bold: true, breakLine: false }),
    ln("nvcc -cubin → cubin(세대 전용 SASS)     ", C.TEXT, { breakLine: false }),
    ln("호스트: ", C.TEAL, { bold: true, breakLine: false }),
    ln("g++ 단일 파일 + -lcuda (nvcc 불필요)", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: 5.6, w: W-2*M-0.6, h: 0.6, fontFace: KFONT, fontSize: 13, color: C.TEXT, margin: 0, valign: "middle" });
  s.addNotes("호스트 컴파일 단위가 하나로 줄어든 것이 driver_api/ 대비 가장 큰 구조 변화.");
})();

// ============================================================ 7 — 실행 흐름 (main 수명주기)
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "실행 흐름 · main() Driver API 수명주기", C.TEAL);
  const steps = [
    ["인자 파싱", "-g / [MB] [iters]", C.MUTED],
    ["cuInit(0)", "드라이버 초기화", C.MUTED],
    ["cuDeviceGet · Attribute", "디바이스·compute capability", C.MUTED],
    ["cuCtxCreate", "컨텍스트 생성", C.MUTED],
    ["cuModuleLoad(cubin)", "cubin → g_module", C.AMBER],
    ["cuMemAlloc", "devTestMem / devTempMem", C.MUTED],
    ["반복: gpuMovingInversionsOnesZeros", "대표 테스트", C.TEAL],
    ["cuMemFree · cuModuleUnload · cuCtxDestroy", "정리", C.MUTED],
  ];
  let y = 1.55; const rh = 0.62;
  steps.forEach((st, i) => {
    const hot = st[2] === C.AMBER;
    nodeBox(s, M, y, 6.2, rh, null, null, hot ? C.AMBER : C.LINE, hot ? "241A16" : C.CODEBG);
    s.addText(st[0], { x: M+0.15, y, w: 5.9, h: rh, valign: "middle", fontFace: MONO, fontSize: 11.5, bold: hot, color: st[2], margin: 0 });
    s.addText(st[1], { x: M+6.45, y, w: 4.2, h: rh, valign: "middle", fontFace: KFONT, fontSize: 12.5, color: C.TEXT, margin: 0 });
    if (i < steps.length-1) arrow(s, M+3.1, y+rh, 0, 0.075, C.FAINT, { width: 1.5 });
    y += rh + 0.075;
  });
  s.addNotes("한 파일에서 위→아래로 읽히는 순서. cuModuleLoad 를 앰버로 강조.");
})();

// ============================================================ 8 — 대표 테스트 → 커널 실행 확대
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "대표 테스트 → 커널 실행 (확대)", C.TEAL);

  // 왼쪽: gpuMovingInversionsOnesZeros
  card(s, M, 1.7, 5.6, 4.5, C.CARD, C.AMBER);
  s.addText("gpuMovingInversionsOnesZeros", { x: M+0.2, y: 1.82, w: 5.2, h: 0.35, fontFace: MONO, fontSize: 12.5, bold: true, color: C.AMBER, margin: 0 });
  const steps = [
    ["gpuWriteConstant(0xFFFFFFFF)", C.AMBER],
    ["SOFTWAIT", C.MUTED],
    ["gpuVerifyConstant(0xFFFFFFFF)", C.TEAL],
    ["gpuWriteConstant(0x0)", C.AMBER],
    ["SOFTWAIT", C.MUTED],
    ["gpuVerifyConstant(0x0)", C.TEAL],
  ];
  let y = 2.3;
  steps.forEach((st, i) => {
    box(s, M+0.25, y, 5.1, 0.5, st[0], st[1], st[1]===C.AMBER?"241A16":(st[1]===C.TEAL?"12212A":C.CODEBG), 11.5);
    if (i < steps.length-1) arrow(s, M+2.8, y+0.5, 0, 0.1, C.FAINT, { width: 1.4 });
    y += 0.62;
  });

  // 오른쪽: write/verify 내부
  card(s, M+5.9, 1.7, W-M-(M+5.9), 4.5, C.CARD, C.TEAL);
  s.addText("gpuWriteConstant / gpuVerifyConstant 내부", { x: M+6.1, y: 1.82, w: W-2*M-6.1, h: 0.35, fontFace: KFONT, fontSize: 12.5, bold: true, color: C.TEAL, margin: 0 });
  const rx = M+6.1, rw = W-M-(M+5.9)-0.4;
  box(s, rx, 2.35, rw, 0.72, "K(\"device…\") = cuModuleGetFunction\n(이름→CUfunction · 캐시)", C.TEAL, "12212A", 11);
  arrow(s, rx+rw/2, 3.07, 0, 0.15, C.FAINT, { width: 1.5 });
  box(s, rx, 3.25, rw, 0.72, "launch() = cuLaunchKernel\n(f, 1024,1,1, 512,1,1, shmem, 0, args, 0)", C.AMBER, "241A16", 10.5);
  arrow(s, rx+rw/2, 3.97, 0, 0.15, C.FAINT, { width: 1.5 });
  box(s, rx, 4.15, rw, 0.62, "(verify) SOFTWAIT · cuStreamQuery 폴링", C.MUTED, C.CODEBG, 11);
  arrow(s, rx+rw/2, 4.77, 0, 0.15, C.FAINT, { width: 1.5 });
  box(s, rx, 4.95, rw, 0.62, "cuMemcpyDtoH → 블록별 오류 합산", C.TEAL, "12212A", 11);
  s.addText("cuModuleLoad → cuModuleGetFunction → cuLaunchKernel = 로딩·실행 3핵심", {
    x: M+6.1, y: 5.7, w: rw, h: 0.45, fontFace: KFONT, fontSize: 11.5, italic: true, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  s.addNotes("왼쪽 두 verify 스텝이 오른쪽 write/verify 내부를 호출. 3핵심은 아무리 덜어내도 남는다.");
})();

// ============================================================ 9 — 무엇을 남기고 덜어냈나
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "무엇을 남기고 · 무엇을 덜어냈나", C.AMBER);
  const cw = (W-2*M-0.5)/2;
  card(s, M, 1.65, cw, 4.6, C.CARD, C.TEAL);
  s.addText("남긴 것 (필수 골격)", { x: M+0.25, y: 1.8, w: cw-0.5, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: C.TEAL, margin: 0 });
  bullets(s, M+0.3, 2.35, cw-0.6, 3.7, [
    ["cuInit · cuDeviceGet* · cuCtxCreate", C.TEXT],
    ["cuModuleLoad · cuModuleGetFunction (K 캐시)", C.TEXT],
    ["cuLaunchKernel (launch 래퍼) · SOFTWAIT", C.TEXT],
    ["cuMemcpyDtoH + 블록별 합산", C.TEXT],
    ["커널 2개 (Write/Verify Constant)", C.TEXT],
    ["대표 테스트 1종 (Moving Inversions)", C.TEXT],
    ["표준 C++ 인자 파싱 · 단일 cli.cpp", C.TEXT],
  ], { fontSize: 13, gap: 9 });

  card(s, M+cw+0.5, 1.65, cw, 4.6, C.CARD, C.RED);
  s.addText("덜어낸 것 (부가·중복)", { x: M+cw+0.75, y: 1.8, w: cw-0.5, h: 0.4, fontFace: KFONT, fontSize: 15, bold: true, color: C.RED, margin: 0 });
  bullets(s, M+cw+0.8, 2.35, cw-0.6, 3.7, [
    ["ezOptionParser.hpp (서드파티 파서)", C.MUTED],
    ["라이선스 출력 · 대역폭 측정", C.MUTED],
    ["12종 테스트", C.MUTED],
    ["LCG·워킹·랜덤·모듈로 커널", C.MUTED],
    ["PRNG __device__ 헬퍼", C.MUTED],
    ["memtestState OO 래퍼 · core.{h,cpp}", C.MUTED],
    ["3단계 findCubin (fopen 탐침)", C.MUTED],
  ], { fontSize: 13, gap: 9 });
  s.addNotes("남긴 것 = '드라이버 API로 커널 하나를 돌리는 최소 집합'. 이 대비가 이 부록의 결론.");
})();

// ============================================================ 10 — outro
outroSlide(
  "부록 2 정리",
  "덜어내면 뼈대가 보인다",
  [ ln("driver_api/ (1,049줄+서드파티) → driver_api_study/ (293줄·단일 파일). 동작은 그대로.\n", C.TEXT, { breakLine: true }),
    ln("아무리 덜어내도 남는 것: cuModuleLoad → cuModuleGetFunction → cuLaunchKernel.", C.TEAL, { breakLine: true }) ],
  [ ln("직접 해보기: cd driver_api_study && make SMARCH=sm_75 && ./memtestG80 128 50", C.AMBER2),
    ln("문서판: docs/seminar/부록2_DriverAPI_최소예제_단일파일.md · 개념 심화: 부록 1", C.TEAL) ],
  "원본 소스: driver_api_study/  ·  대조군: driver_api/"
);

p.writeFile({ fileName: "부록2_DriverAPI_최소예제_단일파일.pptx" }).then((f) => console.log("wrote", f));
