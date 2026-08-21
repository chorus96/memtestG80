// build_session5.js — 세션 5: 객체지향 API·라이브러리 통합·캡스톤
const { newDeck } = require("./_deck.js");
const D = newDeck();
const { p, bg, header, codePanel, ln, card, arrow, nodeBox, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, M } = D;

titleSlide(
  "CUDA 세미나 · 세션 5",
  "객체지향 API·라이브러리\n·캡스톤",
  "3계층 설계를 이해하고, 라이브러리로 임베드하고, 나만의 테스트를 만든다",
  [ ln("memtestState tester;  tester.allocate(256);", C.AMBER2),
    ln("tester.gpuMovingInversionsOnesZeros(errorCount);", C.TEAL) ]
);

// 2 — 목표
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "1", "오늘의 목표");
  const items = [
    ["3계층 API 설계", "커널 / 호스트 함수 / 클래스의 역할 분담을 이해한다"],
    ["RAII 자원 관리", "allocate/deallocate가 GPU 메모리를 안전하게 다루는 법을 안다"],
    ["라이브러리로 임베드", "내 프로그램에서 memtestState로 GPU를 검증한다"],
    ["캡스톤", "배운 것을 종합해 나만의 테스트 커널을 만든다"],
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
  s.addNotes("본편(1~4)의 지식을 종합해 '남의 코드 읽기'에서 '내 코드 쓰기'로 넘어가는 회차입니다.");
})();

// 3 — 3계층
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "3계층 API 설계");
  const layers = [
    ["LAYER 3 · 사용자 권장", "memtestState 클래스", C.AMBER, "OO 인터페이스. allocate()가 자원을 잡고, 각 gpuXxx() 메서드가 성공/실패 bool 반환. CLI가 쓰는 층."],
    ["LAYER 2", "__host__ gpuXxx 함수", C.TEAL, "커널 실행 + SOFTWAIT 동기화 + 오류 리덕션을 묶은 저수준 C API. 헤더에 공개."],
    ["LAYER 1", "__global__ deviceXxx 커널", C.MUTED, "GPU에서 실제로 도는 테스트 본체. 내부 전용(파일 로컬)."],
  ];
  let y = 1.75;
  layers.forEach((L, i) => {
    card(s, M, y, W-2*M, 1.4, C.CARD, L[2]);
    s.addText(L[0], { x: M+0.3, y: y+0.15, w: 4.5, h: 0.35, fontFace: MONO, fontSize: 12, bold: true, color: L[2], margin: 0 });
    s.addText(L[1], { x: M+0.3, y: y+0.5, w: 5.5, h: 0.6, fontFace: KFONT, fontSize: 20, bold: true, color: C.TEXT, margin: 0, valign: "top" });
    s.addText(L[3], { x: M+6.2, y: y+0.2, w: W-2*M-6.5, h: 1.0, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
    if (i < 2) s.addText("▼", { x: M+2.5, y: y+1.38, w: 0.6, h: 0.2, align: "center", fontFace: KFONT, fontSize: 11, color: C.FAINT, margin: 0 });
    y += 1.6;
  });
  s.addText("네이밍 관례: gpuXxx/cpuXxx = 사용자 접근, deviceXxx = 내부 커널 (core.cu 상단 주석).", {
    x: M, y: 6.65, w: W-2*M, h: 0.35, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, align: "center", margin: 0 });
  s.addNotes("한 기능이 세 층으로 나뉘어 재사용·캡슐화됨. 세션 1~4에서 본 함수들을 각 층에 배치해 보이세요.");
})();

// 2b — 3계층 호출 흐름 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "2", "한 번의 호출이 3계층을 타고 내려간다", C.TEAL);
  s.addText("사용자가 메서드 하나를 부르면, 호출이 계층을 타고 GPU까지 내려갔다가 결과가 되돌아옵니다.", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });
  const layers = [
    ["LAYER 3", "tester.gpuMovingInversionsOnesZeros(e)", "memtestState 메서드", C.AMBER],
    ["LAYER 2", "gpuWriteConstant / gpuVerifyConstant", "__host__ 함수 — 커널 실행 + 리덕션", C.TEAL],
    ["LAYER 1", "deviceWriteConstant<<<1024,512>>>", "__global__ 커널 — GPU에서 실행", C.MUTED],
    ["GPU", "524,288 스레드가 전역 메모리를 검사", "하드웨어", C.AMBER],
  ];
  const bx = M+0.5, bw = 8.2, bh = 0.95, y0 = 2.1, gap = 0.42;
  let y = y0;
  layers.forEach((L, i) => {
    card(s, bx, y, bw, bh, i===3 ? "241A16" : C.CARD, L[3]);
    s.addText(L[0], { x: bx+0.22, y: y+0.1, w: 1.5, h: bh-0.2, valign: "middle", fontFace: "Courier New", fontSize: 12, bold: true, color: L[3], margin: 0 });
    s.addText(L[1], { x: bx+1.75, y: y+0.12, w: bw-1.95, h: 0.42, fontFace: "Courier New", fontSize: 12.5, color: C.TEXT, margin: 0, valign: "middle" });
    s.addText(L[2], { x: bx+1.75, y: y+0.52, w: bw-1.95, h: 0.36, fontFace: KFONT, fontSize: 12, color: C.MUTED, margin: 0, valign: "middle" });
    if (i < 3) arrow(s, bx+bw/2, y+bh+0.02, 0, gap-0.04, L[3]);
    y += bh+gap;
  });
  // return arrow up the right side (bottom → top)
  const rx = bx+bw+0.55;
  s.addShape(p.ShapeType.line, { x: rx, y: y0+0.1, w: 0, h: (y-gap) - (y0+0.1), line: { color: C.TEAL, width: 2, beginArrowType: "triangle" } });
  s.addText("오류 수\n(bool·uint)\n되돌아옴", { x: rx+0.12, y: (y0+y)/2-0.6, w: 1.7, h: 1.2, fontFace: KFONT, fontSize: 11.5, color: C.TEAL, margin: 0, valign: "middle" });
  s.addNotes("호출은 아래로(요청), 결과는 위로(반환). 각 계층은 자기 몫만 하고 아래에 위임한다는 캡슐화를 강조.");
})();

// 4 — RAII
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "3", "자원 관리 · allocate / deallocate (RAII)");
  codePanel(s, M, 1.65, W-2*M, 2.6, [
    ln("// core.h:78 — 생성자에서 상수·기본값 초기화", C.FAINT),
    ln("memtestState() : nBlocks(1024), nThreads(512), allocated(false),", C.TEXT),
    ln("                devTestMem(NULL), ..., lcgPeriod(1024) {};", C.TEXT),
    ln("~memtestState() { deallocate(); }        // 소멸자가 자동으로 해제", C.AMBER2),
    ln("", C.TEXT),
    ln("// core.cu:38 — deallocate: cudaFree + free, 포인터를 NULL로", C.FAINT),
    ln("uint allocate(uint mbToTest);            // 실패 시 0 반환, 부분 할당 정리", C.TEAL),
  ], { fontSize: 13 });
  bullets(s, M, 4.4, W-2*M, 1.8, [
    ["소멸자가 deallocate를 호출 → 객체가 스코프를 벗어나면 GPU 메모리가 자동 해제 (누수 방지)", C.TEXT],
    ["allocate는 세 번의 할당 중 하나라도 실패하면 이미 잡은 것을 되돌리고 0을 반환 (예외 안전)", C.TEXT],
    ["cudaGetLastError()로 CUDA 오류 플래그를 청소해 바깥 세계에 새지 않게 함", C.TEXT],
  ], { fontSize: 14, gap: 9 });
  s.addNotes("C++ RAII 패턴이 GPU 자원에도 그대로 적용됨. try/throw로 부분 할당을 정리하는 부분(core.cu:64)을 짚으세요.");
})();

// 5 — 라이브러리로 임베드
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "내 프로그램에 임베드하기");
  s.addText("이것이 MemtestG80의 원래 목적 — 다른 소프트웨어가 실행 전 GPU 건전성을 검증하도록.", {
    x: M, y: 1.6, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 16, color: C.MUTED, margin: 0 });
  codePanel(s, M, 2.2, W-2*M, 3.4, [
    ln("#include \"memtestG80_core.h\"", C.TEAL),
    ln("", C.TEXT),
    ln("bool gpuIsHealthy(int mb) {", C.TEXT),
    ln("    memtestState tester;", C.AMBER2),
    ln("    if (!tester.allocate(mb)) return false;      // 메모리 확보 실패", C.TEXT),
    ln("", C.TEXT),
    ln("    uint errors = 0, e;", C.TEXT),
    ln("    tester.gpuMovingInversionsOnesZeros(e); errors += e;", C.TEAL),
    ln("    for (uint s = 0; s < 32; s++) {", C.TEXT),
    ln("        tester.gpuWalking32Bit(e, true, s); errors += e;", C.TEAL),
    ln("    }", C.TEXT),
    ln("    return errors == 0;                          // 소멸자가 자동 해제", C.AMBER2),
    ln("}", C.TEXT),
  ], { fontSize: 13 });
  s.addText("LGPL: 오픈소스는 정적 링크, 클로즈드 소스는 공유 라이브러리(.so/.dll)로 링크해야 합니다.", {
    x: M, y: 5.75, w: W-2*M, h: 0.5, fontFace: KFONT, fontSize: 13, italic: true, color: C.MUTED, margin: 0 });
  s.addNotes("cli.cu가 바로 이 패턴의 실제 예제(tester.allocate → 각 gpuXxx 호출). 반환 bool로 성공/실패를 판단.");
})();

// 4b — 라이브러리 임베드 생애주기 다이어그램
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "4", "임베드 생애주기 · 객체가 자원을 감싼다", C.TEAL);
  s.addText("memtestState 객체 하나가 GPU 자원의 전체 수명을 관리합니다. 스코프를 벗어나면 자동 정리됩니다(RAII).", {
    x: M, y: 1.5, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 14.5, color: C.MUTED, margin: 0 });
  const steps = [
    ["생성", "memtestState tester;", "생성자: 상수 초기화, 아직 할당 없음", C.MUTED],
    ["할당", "tester.allocate(mb)", "cudaMalloc으로 VRAM·임시버퍼 확보", C.TEAL],
    ["검사", "tester.gpuXxx(e) 반복", "각 테스트 실행, 오류 수 누적", C.AMBER],
    ["판정", "return errors == 0", "bool로 GPU 건전성 반환", C.TEAL],
    ["소멸", "} // 스코프 종료", "소멸자가 deallocate() 자동 호출", C.AMBER],
  ];
  const bw = 2.15, gap = 0.28, y0 = 2.35, bh = 1.7;
  const totalW = steps.length*bw + (steps.length-1)*gap;
  const x0 = (13.3 - totalW)/2;
  steps.forEach((st, i) => {
    const x = x0 + i*(bw+gap);
    card(s, x, y0, bw, bh, C.CARD, st[3]);
    s.addText(st[0], { x: x+0.12, y: y0+0.15, w: bw-0.24, h: 0.4, align: "center", fontFace: KFONT, fontSize: 16, bold: true, color: st[3], margin: 0 });
    s.addText(st[1], { x: x+0.1, y: y0+0.62, w: bw-0.2, h: 0.55, align: "center", valign: "top", fontFace: "Courier New", fontSize: 10, color: C.TEXT, margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(st[2], { x: x+0.12, y: y0+1.12, w: bw-0.24, h: 0.5, align: "center", fontFace: KFONT, fontSize: 11, color: C.MUTED, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
    if (i < steps.length-1) arrow(s, x+bw+0.02, y0+bh/2, gap-0.04, 0, st[3]);
  });
  // bracket showing 자동 해제 covers whole lifetime
  card(s, x0, 4.5, totalW, 1.0, "241A16", C.AMBER);
  s.addText([
    ln("핵심: ", C.AMBER, { bold: true, breakLine: false }),
    ln("cudaFree를 직접 부르지 않아도, 객체 소멸자가 모든 GPU 메모리를 해제합니다. 예외가 나도, 일찍 return해도 누수가 없습니다.", C.TEXT, { breakLine: true }),
  ], { x: x0+0.3, y: 4.68, w: totalW-0.6, h: 0.7, fontFace: KFONT, fontSize: 14, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  s.addNotes("생성→할당→검사→판정→소멸의 생애주기. 소멸자가 자동 해제한다는 RAII의 이점을 흐름으로 시각화.");
})();

// 6 — 오류 센티넬
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "5", "오류 관례 · 4억을 넘는 '오류'의 정체");
  const rows = [
    ["0xFFFFFFFF", "커널 launch 실패", "CHECK_LAUNCH_ERROR — cudaGetLastError 감지", C.RED],
    ["0xFFFFFFFE", "커널 타임아웃", "SOFTWAIT 15초 초과 (디스플레이 워치독)", C.AMBER],
    ["정상 오류 수", "실제 비트 오류", "__popc로 센 합계 — 보통 0, 결함 시 소수", C.TEAL],
  ];
  let y = 1.9;
  rows.forEach((r) => {
    card(s, M, y, W-2*M, 1.05);
    s.addText(r[0], { x: M+0.3, y: y+0.1, w: 3.2, h: 0.85, valign: "middle", fontFace: MONO, fontSize: 17, bold: true, color: r[3], margin: 0 });
    s.addText(r[1], { x: M+3.6, y: y+0.1, w: 3.2, h: 0.85, valign: "middle", fontFace: KFONT, fontSize: 16, bold: true, color: C.TEXT, margin: 0 });
    s.addText(r[2], { x: M+7.0, y: y+0.1, w: W-2*M-7.3, h: 0.85, valign: "middle", fontFace: KFONT, fontSize: 13.5, color: C.MUTED, margin: 0 });
    y += 1.2;
  });
  card(s, M, 5.6, W-2*M, 0.95, "241A16", C.AMBER);
  s.addText([
    ln("README의 경고: ", C.AMBER, { bold: true, breakLine: false }),
    ln("오류 수가 40억을 넘으면 진짜 결함이 아니라 타임아웃 센티넬입니다. 테스트 영역을 줄이면 사라집니다.", C.TEXT, { breakLine: true }),
  ], { x: M+0.3, y: 5.75, w: W-2*M-0.6, h: 0.7, fontFace: KFONT, fontSize: 14.5, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  s.addNotes("uint 반환값에 센티넬을 얹는 관례. 클래스의 gpuXxx 메서드는 이 센티넬을 걸러 bool로 변환(core.cu:102).");
})();

// 7 — 캡스톤
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "6", "캡스톤 · 나만의 테스트 만들기");
  s.addText("아래 중 하나를 골라 구현하고 5분 발표합니다.", {
    x: M, y: 1.6, w: W-2*M, h: 0.45, fontFace: KFONT, fontSize: 16, color: C.MUTED, margin: 0 });
  const opts = [
    ["A", "새 패턴 테스트", "체커보드(0xAAAAAAAA/0x55555555 교차) 패턴 커널을 write/verify 뼈대로 추가", C.AMBER],
    ["B", "오류 히스토그램", "오류가 난 word의 비트 위치 분포를 집계해 출력하는 기능 추가", C.TEAL],
    ["C", "선택적 테스트 실행", "CLI에 --only 플래그를 추가해 특정 테스트만 돌리도록 확장", C.AMBER],
  ];
  let y = 2.25;
  opts.forEach((o) => {
    card(s, M, y, W-2*M, 1.25, C.CARD, o[3]);
    s.addText(o[0], { x: M+0.3, y: y+0.32, w: 0.7, h: 0.6, align: "center", valign: "middle", fontFace: MONO, fontSize: 22, bold: true, color: C.BG, fill: { color: o[3] }, shape: p.ShapeType.roundRect, rectRadius: 0.1 });
    s.addText(o[1], { x: M+1.3, y: y+0.18, w: W-2*M-1.6, h: 0.5, fontFace: KFONT, fontSize: 18, bold: true, color: C.TEXT, margin: 0, valign: "top" });
    s.addText(o[2], { x: M+1.3, y: y+0.68, w: W-2*M-1.6, h: 0.5, fontFace: KFONT, fontSize: 14, color: C.MUTED, margin: 0, valign: "top" });
    y += 1.4;
  });
  s.addNotes("A는 세션 1~3 종합, B는 세션 3(리덕션) 응용, C는 세션 4·5 구조 이해. 참석자 수준에 맞게 안내하세요.");
})();

// 8 — 시리즈 총정리
(() => {
  const s = p.addSlide(); bg(s);
  header(s, "7", "시리즈 총정리");
  const rows = [
    ["세션 1", "스레드 모델 · THREAD_ADDRESS · coalescing", C.TEAL],
    ["세션 2", "메모리 계층 · 쓰기→검증 · Moving Inversions", C.AMBER],
    ["세션 3", "공유 메모리 · __popc · 병렬 리덕션", C.TEAL],
    ["세션 4", "13종 테스트 카탈로그 · 패턴 생성 · 대역폭", C.AMBER],
    ["세션 5", "3계층 API · RAII · 라이브러리 임베드 · 캡스톤", C.TEAL],
  ];
  let y = 1.9;
  rows.forEach((r) => {
    card(s, M, y, W-2*M, 0.82);
    s.addText(r[0], { x: M+0.3, y: y+0.08, w: 1.6, h: 0.66, valign: "middle", fontFace: MONO, fontSize: 16, bold: true, color: r[2], margin: 0 });
    s.addText(r[1], { x: M+2.1, y: y+0.08, w: W-2*M-2.4, h: 0.66, valign: "middle", fontFace: KFONT, fontSize: 15.5, color: C.TEXT, margin: 0 });
    y += 0.95;
  });
  s.addText("500줄의 실제 코드로 CUDA의 핵심을 모두 만졌습니다.", {
    x: M, y: 6.55, w: W-2*M, h: 0.4, fontFace: KFONT, fontSize: 14, italic: true, color: C.MUTED, align: "center", margin: 0 });
  s.addNotes("각 세션의 핵심 한 줄로 여정을 되짚으세요. THREAD_ADDRESS와 리덕션이 전체를 관통했음을 강조.");
})();

// 9 — 마무리
outroSlide(
  "수고하셨습니다",
  "이제 당신은 GPU를 검증할 수 있습니다",
  [ ln("읽을 순서 제안: cli.cu 메인 루프 → core.cu의 THREAD_ADDRESS → deviceVerifyConstant 리덕션.", C.TEXT, { breakLine: true, paraSpaceAfter: 6 }),
    ln("이 세 곳이 MemtestG80 전체를 관통합니다.", C.MUTED, { breakLine: true }) ],
  [ ln("원본: github.com/ihaque/memtestG80   ·   라이선스: LGPL v3", C.AMBER2),
    ln("NVIDIA CUDA C++ Programming Guide — 다음 학습 자료", C.TEAL) ],
  "질문 환영합니다 · 캡스톤 발표를 기대합니다"
);

p.writeFile({ fileName: "세션5_객체지향API_라이브러리_캡스톤.pptx" }).then((f) => console.log("wrote", f));
