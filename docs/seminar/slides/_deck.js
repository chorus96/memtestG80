// _deck.js — MemtestG80 세미나 슬라이드 공통 헬퍼 (pptxgenjs)
// 각 build_sessionN.js가 require("./_deck.js")로 사용합니다.
// 팔레트/타이포는 docs/seminar/memtestG80-seminar.html(요약 덱)과 통일한 "하드웨어 진단 계측기" 테마.
const pptxgen = require("pptxgenjs");

// ---- 팔레트 (다크, 진단 계측기 테마) ----
const C = {
  BG:    "101722", // 페이지 배경 (딥 슬레이트)
  CARD:  "18212E", // 카드 표면
  CARD2: "1F2A3A", // 밝은 표면
  CODEBG:"0B1119", // 코드 패널
  TEXT:  "E7EDF5", // 본문
  MUTED: "9FB0C4", // 보조 텍스트
  FAINT: "6B7D94", // 흐린 텍스트
  AMBER: "E8A33D", // 주 강조 (결함 LED)
  AMBER2:"F2C079", // 밝은 앰버
  TEAL:  "3FB8C4", // 보조 강조 (데이터/통과)
  RED:   "E6604F", // 오류
  LINE:  "2C3A4E", // 헤어라인
};
const KFONT = "Malgun Gothic"; // 한글 지원 폰트
const MONO  = "Courier New";   // 코드용
const W = 13.3, H = 7.5, M = 0.6;

function newDeck() {
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5

  function bg(slide, color) { slide.background = { color: color || C.BG }; }

  // 섹션 번호 칩 + 제목 (반복 모티프)
  function header(slide, num, title, color) {
    slide.addText(String(num), {
      x: M, y: 0.45, w: 0.72, h: 0.72, align: "center", valign: "middle",
      fontFace: MONO, fontSize: 22, bold: true, color: C.BG,
      fill: { color: color || C.AMBER }, rectRadius: 0.1, shape: p.ShapeType.roundRect,
    });
    slide.addText(title, {
      x: 1.5, y: 0.42, w: W - 1.5 - M, h: 0.78, align: "left", valign: "middle",
      fontFace: KFONT, fontSize: 29, bold: true, color: C.TEXT, margin: 0,
    });
  }

  // 코드 패널 (모노 폰트, 다크 배경). lines = ln() 런 배열 또는 문자열
  function codePanel(slide, x, y, w, h, lines, opts) {
    opts = opts || {};
    slide.addShape(p.ShapeType.roundRect, {
      x, y, w, h, rectRadius: 0.05, fill: { color: C.CODEBG }, line: { color: C.LINE, width: 1 },
    });
    slide.addText(lines, {
      x: x + 0.24, y: y + 0.16, w: w - 0.48, h: h - 0.32, align: "left", valign: "top",
      fontFace: MONO, fontSize: opts.fontSize || 13, color: opts.color || C.TEXT, margin: 0,
      lineSpacingMultiple: opts.lineSpacing || 1.1,
    });
  }

  // 한 줄 리치 런 (간단한 하이라이팅)
  function ln(text, color, opts) {
    return { text, options: Object.assign({ color: color || C.TEXT, breakLine: true }, opts || {}) };
  }

  // 라운드 카드
  function card(slide, x, y, w, h, fill, lineColor) {
    slide.addShape(p.ShapeType.roundRect, {
      x, y, w, h, rectRadius: 0.08,
      fill: { color: fill || C.CARD },
      line: lineColor ? { color: lineColor, width: 1.5 } : { type: "none" },
    });
  }

  // 불릿 리스트 헬퍼
  function bullets(slide, x, y, w, h, items, opts) {
    opts = opts || {};
    const runs = items.map((it) => {
      const t = Array.isArray(it) ? it[0] : it;
      const col = Array.isArray(it) ? (it[1] || C.TEXT) : C.TEXT;
      return ln(t, col, { bullet: { code: opts.code || "2022" }, paraSpaceAfter: opts.gap == null ? 10 : opts.gap, bold: Array.isArray(it) && it[2] === true });
    });
    slide.addText(runs, {
      x, y, w, h, fontFace: KFONT, fontSize: opts.fontSize || 15.5, color: C.TEXT,
      valign: "top", margin: 0, lineSpacingMultiple: opts.lineSpacing || 1.05,
    });
  }

  // 제목(표지) 슬라이드
  function titleSlide(sessionLabel, title, subtitle, codeLines) {
    const s = p.addSlide(); bg(s);
    s.addText(sessionLabel, { x: M, y: 1.95, w: 10, h: 0.5, fontFace: KFONT, fontSize: 18, bold: true, color: C.AMBER, margin: 0 });
    s.addText(title, { x: M, y: 2.45, w: 11.8, h: 2.0, fontFace: KFONT, fontSize: 45, bold: true, color: C.TEXT, lineSpacingMultiple: 1.05, margin: 0 });
    s.addText(subtitle, { x: M, y: 4.65, w: 11.5, h: 0.5, fontFace: KFONT, fontSize: 19, color: C.MUTED, margin: 0 });
    if (codeLines) codePanel(s, M, 5.5, 8.0, 1.05, codeLines, { fontSize: 12.5 });
    s.addText("MemtestG80 실제 소스로 배우는 CUDA · 입문 과정", { x: 8.7, y: 6.0, w: 4.0, h: 0.4, align: "right", fontFace: KFONT, fontSize: 12.5, color: C.FAINT, margin: 0 });
    return s;
  }

  // 마무리(예고) 슬라이드
  function outroSlide(kicker, title, body, codeLines, footer) {
    const s = p.addSlide(); bg(s);
    s.addText(kicker, { x: M, y: 1.6, w: 11, h: 0.5, fontFace: KFONT, fontSize: 18, bold: true, color: C.AMBER, margin: 0 });
    s.addText(title, { x: M, y: 2.15, w: 12, h: 1.0, fontFace: KFONT, fontSize: 37, bold: true, color: C.TEXT, margin: 0 });
    if (body) s.addText(body, { x: M, y: 3.35, w: 12, h: 1.4, fontFace: KFONT, fontSize: 17, color: C.TEXT, margin: 0, valign: "top", lineSpacingMultiple: 1.2 });
    if (codeLines) codePanel(s, M, 5.4, 9.2, 1.1, codeLines, { fontSize: 12.5 });
    if (footer) s.addText(footer, { x: M, y: 6.7, w: 12, h: 0.4, fontFace: KFONT, fontSize: 13.5, italic: true, color: C.MUTED, margin: 0 });
    return s;
  }

  return { p, bg, header, codePanel, ln, card, bullets, titleSlide, outroSlide, C, KFONT, MONO, W, H, M };
}

module.exports = { newDeck, C, KFONT, MONO, W, H, M };
