// build_talk.js — LACSS 2010 발표 "소프트 오류에 관한 실측 데이터" 한국어 번역 PPTX
// 원본: gpuser_lacss_oct_2010.pdf (Imran Haque, Stanford) 21슬라이드
// 차트 6종은 원 PDF에서 추출해 images/ 에 두고 삽입.
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5

// ---- 밝은 학술 테마 (임베드 차트가 흰 배경이라 흰 슬라이드가 자연스럽다) ----
const BG    = "FFFFFF";
const INK   = "10243E"; // 제목 네이비
const TEXT  = "1A1A1A";
const MUTED = "44515E";
const RULE  = "B9C4D4";
const AMBER = "B4690E"; // 강조 (경고/수치)
const TEAL  = "1F7A8C"; // 보조 강조
const RED   = "B23A3A";
const CARD  = "F4F6F9";
const KFONT = "Malgun Gothic";
const MONO  = "Courier New";
const W = 13.3, H = 7.5, M = 0.7;

function bg(s){ s.background={color:BG}; }
function header(s, title){
  s.addText(title, { x:M, y:0.42, w:W-2*M, h:0.9, fontFace:KFONT, fontSize:30, bold:true, color:INK, margin:0, valign:"middle" });
  s.addShape(p.ShapeType.line, { x:M, y:1.34, w:W-2*M, h:0, line:{color:RULE, width:2} });
}
function ln(text, color, opts){ return { text, options:Object.assign({color:color||TEXT, breakLine:true}, opts||{}) }; }

// 불릿 슬라이드: items = [ [text, level] ... ] level 0/1
function bulletsSlide(title, items, opts){
  opts=opts||{};
  const s=p.addSlide(); bg(s); header(s,title);
  const runs=items.map(it=>{
    const t=Array.isArray(it)?it[0]:it;
    const lvl=Array.isArray(it)?(it[1]||0):0;
    return ln(t, lvl?MUTED:TEXT, { bullet:{code:lvl?"2013":"2022", indent: lvl?14:14}, indentLevel:lvl, paraSpaceAfter: lvl?6:12, fontSize: lvl?18:21 });
  });
  s.addText(runs, { x:M, y:1.7, w:W-2*M, h:5.2, fontFace:KFONT, color:TEXT, valign:"top", margin:0, lineSpacingMultiple:1.12 });
  return s;
}

// 불릿(왼쪽) + 이미지(오른쪽) 슬라이드
function bulletsImageSlide(title, items, img, opts){
  opts=opts||{};
  const s=p.addSlide(); bg(s); header(s,title);
  const colW = opts.textW || 5.4;
  const runs=items.map(it=>{
    const t=Array.isArray(it)?it[0]:it; const lvl=Array.isArray(it)?(it[1]||0):0;
    return ln(t, lvl?MUTED:TEXT, { bullet:{code:lvl?"2013":"2022"}, indentLevel:lvl, paraSpaceAfter:lvl?6:12, fontSize:lvl?16:19 });
  });
  s.addText(runs, { x:M, y:1.7, w:colW, h:5.2, fontFace:KFONT, color:TEXT, valign:"top", margin:0, lineSpacingMultiple:1.12 });
  s.addImage({ path:`images/${img}`, x:opts.ix!=null?opts.ix:(M+colW+0.3), y:opts.iy!=null?opts.iy:1.7,
               w:opts.iw||6.4, h:opts.ih||4.9, sizing:{type:"contain", w:opts.iw||6.4, h:opts.ih||4.9} });
  return s;
}

// 이미지 중심 슬라이드 (제목 + 큰 차트 + 하단 캡션)
function figureSlide(title, img, caption, opts){
  opts=opts||{};
  const s=p.addSlide(); bg(s); header(s,title);
  const iw=opts.iw||8.6, ih=opts.ih||4.5;
  s.addImage({ path:`images/${img}`, x:(W-iw)/2, y:1.55, w:iw, h:ih, sizing:{type:"contain", w:iw, h:ih} });
  if(caption) s.addText(caption, { x:M, y:6.2, w:W-2*M, h:0.9, align:"center", fontFace:KFONT, fontSize:18, bold:true, color:INK, margin:0, valign:"top", lineSpacingMultiple:1.1 });
  return s;
}

// =============== SLIDE 1 — Title ===============
(()=>{
  const s=p.addSlide(); bg(s);
  s.addShape(p.ShapeType.rect, { x:0, y:0, w:0.32, h:H, fill:{color:INK} });
  s.addText("Resilience Summit @ LACSS · 2010년 10월 13일", { x:M, y:1.5, w:11, h:0.5, fontFace:KFONT, fontSize:16, bold:true, color:TEAL, margin:0 });
  s.addText("소프트 오류에 관한 실측 데이터", { x:M, y:2.2, w:12, h:1.0, fontFace:KFONT, fontSize:44, bold:true, color:INK, margin:0 });
  s.addText("GPGPU 메모리 소프트 오류율에 대한 전 지구적 규모의 조사", { x:M, y:3.35, w:12, h:0.7, fontFace:KFONT, fontSize:22, color:MUTED, margin:0 });
  s.addShape(p.ShapeType.line, { x:M, y:4.5, w:6.5, h:0, line:{color:RULE, width:1.5} });
  s.addText([
    ln("Imran Haque", INK, {bold:true, breakLine:true, fontSize:18}),
    ln("스탠퍼드 대학교 컴퓨터과학과", MUTED, {breakLine:true, fontSize:15}),
    ln("ihaque@cs.stanford.edu · folding.stanford.edu", TEAL, {breakLine:true, fontSize:13, fontFace:MONO}),
  ], { x:M, y:4.75, w:11, h:1.5, fontFace:KFONT, margin:0, valign:"top", lineSpacingMultiple:1.15 });
  s.addText("한국어 번역판 · 원본: gpuser_lacss_oct_2010.pdf", { x:M, y:6.9, w:11, h:0.4, fontFace:KFONT, fontSize:12, italic:true, color:MUTED, margin:0 });
  s.addNotes("발표 도입. 소비자 GPU의 메모리 신뢰성을 전 지구적 규모로 실측한 연구임을 소개.");
})();

// =============== SLIDE 2 — Motivation ===============
bulletsSlide("동기 (Motivation)", [
  "GPU는 오류에 둔감한 소비자 그래픽에서 출발했다",
  "대부분의* 그래픽 메모리에는 ECC도 패리티도 없다",
  "설치된 소비자 GPU 기반은 — 그리고 소비자 GPU에서 파생된 프로 하드웨어까지! — 오류에 민감한 범용 연산에 얼마나 적합한가?",
  ["* 이 점(\"대부분의\")에 관해서는 뒤에서 더 다룬다", 1],
]);

// =============== SLIDE 3 — Motivation (our software) ===============
(()=>{
  const s=bulletsSlide("동기 — 우리가 만든 GPU 소프트웨어", [
    "우리는 많은 GPU 소프트웨어를 작성했고, 그것을 아주 많은 GPU에서 실행한다.",
  ]);
  const cards=[
    ["Folding@home","분자동역학 (molecular dynamics)"],
    ["OpenMM","분자동역학 라이브러리"],
    ["PAPER","3차원 화학 유사성"],
    ["SIML","1차원 화학 유사성"],
  ];
  const cw=(W-2*M-0.9)/4;
  cards.forEach((c,i)=>{
    const x=M+i*(cw+0.3), y=3.4;
    s.addShape(p.ShapeType.roundRect,{x,y,w:cw,h:2.0,rectRadius:0.06,fill:{color:CARD},line:{color:RULE,width:1}});
    s.addText(c[0],{x:x+0.15,y:y+0.25,w:cw-0.3,h:0.9,align:"center",fontFace:KFONT,fontSize:16,bold:true,color:INK,margin:0,valign:"middle"});
    s.addText(c[1],{x:x+0.15,y:y+1.05,w:cw-0.3,h:0.8,align:"center",fontFace:KFONT,fontSize:13,color:MUTED,margin:0,valign:"top",lineSpacingMultiple:1.1});
  });
  s.addText("CUDA 지원 패키지 — 실제로 오류에 민감한 과학 계산에 GPU를 쓰고 있다는 점이 이 연구의 출발점.",
    {x:M,y:5.7,w:W-2*M,h:0.5,fontFace:KFONT,fontSize:13,italic:true,color:MUTED,align:"center",margin:0});
})();

// =============== SLIDE 4 — MemtestG80 + MemtestCL ===============
bulletsSlide("MemtestG80 + MemtestCL", [
  "x86 PC용 Memtest86에 기반한 맞춤 소프트웨어",
  "오픈소스(LGPL) — https://simtk.org/home/memtest 에서 제공",
  "다양한 테스트 패턴:",
  ["상수 (전부 1, 전부 0, 난수)", 1],
  ["워킹 1·0 (8비트, 32비트)", 1],
  ["무작위 워드 (GPU 상 병렬 의사난수생성기)", 1],
  ["모듈로-20 패턴 민감성", 1],
  ["새로운 반복 LCG 정수 로직 테스트", 1],
  ["비트 페이드 (bit fade)", 1],
]);

// =============== SLIDE 5 — Validation (negative) ===============
bulletsSlide("MemtestG80 — 검증: 음성 대조", [
  "음성 대조 — \"양호한(known-good)\" 상황에서 가짜 오류를 내지 않는지 확인",
  ["양호한 것으로 알려진 전원(PSU), 에어컨이 있는 통제 환경의 머신", 1],
  "GeForce 8800GTX에서 700 MiB에 대해 93,000회 이터레이션",
  "8대의 Tesla C870 각각에서 320 MiB에 대해 180,000회 이상",
  "오류가 단 한 번도 검출되지 않음",
]);

// =============== SLIDE 6 — Validation (positive) ===============
bulletsSlide("MemtestG80 — 검증: 양성 대조", [
  "양성 대조 — 오류를 유발하는 상황에서 실제로 오류를 내는지 확인",
  "오버클럭은 메모리 오류를 유발한다 (타이밍 제약 위반, 신호 무결성 손실)",
  "GeForce 9500GT(기본 메모리 클럭 400MHz)를 400·420·430·440·450·475·500·530 MHz에서 시험",
  ["각 주파수마다 20회 이터레이션 (530MHz는 불안정으로 10회만)", 1],
  ["시험 사이에 냉각하고 400MHz로 리셋", 1],
]);

// =============== SLIDE 7 — positive control chart ===============
figureSlide("MemtestG80 — 검증 (양성 대조)", "chart_pos.png",
  "양성 대조는 메모리 테스트의 패턴 민감성을 드러낸다", {iw:11.4, ih:4.4});

// =============== SLIDE 8 — Methodology FAH ===============
bulletsSlide("방법론 — Folding@home", [
  "낮은 오류율과 환경 민감성이 예상되므로, 다양한 환경의 많은 카드를 표본화해야 한다",
  "약 7개월간 Folding@home의 50,000대 이상 NVIDIA GPU에서 실행 (840 TB-시간 이상의 테스트)",
  "데이터의 97% 이상이 64 MiB RAM, k=512 로직 LCG로 시험됨",
]);

// =============== SLIDE 9 — Methodology chart + table ===============
(()=>{
  const s=p.addSlide(); bg(s); header(s,"방법론 — Folding@home");
  s.addText([
    ln("NVIDIA 소비자 제품군 전반과 일부 프로 카드까지 잘 표본화했다.", TEXT, {bullet:{code:"2022"}, paraSpaceAfter:10, fontSize:16}),
    ln("정격(stock)과 (셰이더) 오버클럭 보드를 비슷한 수로 표본화했다.", TEXT, {bullet:{code:"2022"}, fontSize:16}),
  ], { x:M, y:1.6, w:W-2*M, h:1.1, fontFace:KFONT, color:TEXT, valign:"top", margin:0, lineSpacingMultiple:1.12 });
  s.addImage({ path:"images/chart_cards.png", x:M, y:2.8, w:6.0, h:3.9, sizing:{type:"contain",w:6.0,h:3.9} });
  // table (translated headers, updated numbers from the talk)
  const rows=[
    ["카드 제품군","≥ 300,000회 카드 수", true],
    ["소비자 그래픽 카드","17,648 (합계)", false],
    ["GeForce GTX","5,520"],["GeForce 8800","5,478"],["GeForce 9800/GTS","4,923"],
    ["GeForce 9600","1,516"],["기타 데스크톱 GeForce","181"],["모바일 GeForce","30"],
    ["프로페셔널 그래픽 카드","89 (합계)"],["Quadro FX","83"],["Quadroplex 2200","6"],
    ["GPGPU 전용 카드","37 (합계)"],["Tesla T10","27"],["Tesla C1060","10"],
  ];
  const tx=7.3, tw=5.3, ty=1.75, rh=0.335;
  rows.forEach((r,i)=>{
    const head=r[2]===true; const grp=/합계/.test(r[1]);
    s.addShape(p.ShapeType.rect,{x:tx,y:ty+i*rh,w:tw,h:rh,fill:{color:head?INK:(grp?CARD:BG)},line:{color:RULE,width:0.75}});
    s.addText(r[0],{x:tx+0.1,y:ty+i*rh,w:tw*0.62,h:rh,valign:"middle",fontFace:KFONT,fontSize:11,bold:head||grp,italic:grp,color:head?"FFFFFF":INK,margin:0});
    s.addText(r[1],{x:tx+tw*0.62,y:ty+i*rh,w:tw*0.38-0.1,h:rh,align:"right",valign:"middle",fontFace:MONO,fontSize:11,bold:head,color:head?"FFFFFF":TEXT,margin:0});
  });
  s.addNotes("좌: 이터레이션 컷오프별 카드 수(로그). 우: 최소 30만 회 완료한 카드의 제품군별 분포.");
})();

// =============== SLIDE 10 — Results (setup) ===============
bulletsSlide("결과 (Results)", [
  "MemtestG80 이터레이션 중 어느 한 테스트라도 실패하면 \"실패\"로 간주한다 (정확한 워드 오류율은 무시)",
  "모델: 각 카드는 자기 고유의 오류(테스트 실패) 확률 Pf를 가진다. 카드들은 기저 분포 P(Pf)에서 독립·동일분포(iid)로 뽑힌다",
  "그렇다면 실패 확률의 분포는 어떤 모습인가?",
]);

// =============== SLIDE 11 — Results chart ===============
figureSlide("결과", "chart_results.png",
  "실패 카드 집단의 최빈값은 Pf ≈ 2×10⁻⁵ ≈ 주당 약 4회 실패", {iw:9.0, ih:4.6});

// =============== SLIDE 12 — by architecture ===============
figureSlide("분석 — 아키텍처별 분해", "chart_arch.png",
  "GT200의 전형적 Pf = 2.2×10⁻⁶ (G80의 1/10!) · 두 아키텍처 모두 무오류 집단이 단조 감소", {iw:8.8, ih:4.5});

// =============== SLIDE 13 — GeForce vs Tesla ===============
figureSlide("분석 — GeForce vs Tesla", "chart_tesla.png",
  "Tesla 곡선은 표본이 적어 거칠지만, GeForce와 같은 오류 분포를 나타내는 것으로 보인다", {iw:8.8, ih:4.5});

// =============== SLIDE 14 — Mutual information ===============
bulletsImageSlide("분석 — 테스트 간 상호정보량", [
  "테스트 간 상호정보량을 비선형 공분산 척도로 본다",
  "모듈로-20 테스트는 독자적이다",
  "무작위 블록 테스트는 좋은 로직 훈련이다",
  "로직 테스트는 메모리 테스트와 구별되는 고장 모드를 측정한다",
], "chart_mi.png", { textW:4.9, ix:6.0, iw:6.6, ih:5.0 });

// =============== SLIDE 15 — Fermi? ===============
bulletsSlide("Fermi는 어떤가?", [
  "NVIDIA의 신형 Fermi(GF100) 아키텍처는 SECDED ECC(소비자 GeForce 라인에서는 비활성), GDDR5 메모리 버스 ECC, L1/L2 캐시를 추가했다",
  "Fermi 재설계가 아키텍처적 취약성(오류율·오류 유형)에 영향을 주는가?",
  ["G80/GT200은 대개 모듈로-20 테스트에서 먼저 실패했다", 1],
  "FAH 테스트는 아직 Fermi에서 실행되지 않음 → 리포팅 기능이 있는 독립 MemtestG80 사용",
  ["사내: GeForce GTX 480 1대, Tesla C2050 1대", 1],
  ["공개: GeForce GTX 470 44대, GeForce GTX 480 43대", 1],
]);

// =============== SLIDE 16 — Results Fermi ===============
bulletsSlide("결과 — Fermi", [
  "Tesla: 앱 레벨 오류는 없었으나, ECC가 더블비트 오류를 최소 1건 보고",
  "GeForce: 대부분의 카드가 메모리 오류를 보임 — 사내 관측 Pf = 1.6×10⁻⁵",
  ["비오버클럭 카드는 8비트 워킹 제로에 취약", 1],
  ["RAM 오버클럭 카드는 8·32비트 워킹 제로에서 먼저 실패", 1],
  ["코어/셰이더 오버클럭 카드는 무작위 블록에서 실패", 1],
  "G80/GT200과는 매우 다른 취약성 — 그러나 문제는 여전히 존재한다!",
]);

// =============== SLIDE 17 — AMD and CPU? ===============
bulletsSlide("AMD는… 그리고 CPU는?", [
  "RV700과 Evergreen 모두 GDDR5(저가 모델은 GDDR3)와 L1/L2 계층을 가진다",
  "현재 FAH에 OpenCL 코어가 없음 → 독립 MemtestCL의 자원자 제출을 사용",
  ["사내: Radeon 4870(RV770), Radeon 5870(Cypress)", 1],
  ["공개 · RV700: RV710 2, RV730 15, RV770 88", 1],
  ["공개 · Evergreen: Cedar 1, Redwood 6, Juniper 50, Cypress 103", 1],
  ["CPU: Core i7 16, Core 2 11, Phenom/Athlon II 17", 1],
]);

// =============== SLIDE 18 — Results AMD+CPU ===============
bulletsSlide("결과 — AMD + CPU", [
  "CPU: 오류가 관측되지 않음",
  "RV770: 대개 무작위 블록/모듈로-20에서 실패 — Pf ≈ 7×10⁻⁴ 부근",
  "Cypress: 거의 모든 카드가 결국 무작위 블록에서 실패 — Pf ≈ 4×10⁻⁴ 부근",
  "단, 오류 패턴(이터레이션당 실패 비트 수)이 의심스러움 — 소프트웨어(MemtestCL 또는 CL 런타임) 문제인지 AMD와 협력해 확인 중",
]);

// =============== SLIDE 19 — Acknowledgments ===============
bulletsSlide("감사의 글", [
  "스탠퍼드 대학교 Pande 연구실",
  "Simbios (NIH Roadmap GM072970)",
  "NVIDIA",
  "AMD",
  "Folding@home 기증자 여러분",
]);

// =============== SLIDE 20 — Summary ===============
bulletsSlide("요약", [
  "GPU 메모리 오류를 시험하기 위해 MemtestG80을 작성했다",
  "음성·양성 대조 시험으로 MemtestG80의 올바른 동작을 검증했다",
  "50,000대 이상 GPU에서, 840 TB-시간 이상 MemtestG80을 실행했다",
  "시험한 GPU의 2/3가 패턴에 민감한 소프트 오류를 보였다",
  "아키텍처가 중요하다: GT200은 G80보다 훨씬 신뢰성이 높고, GF100은 새로운 취약성을 도입하며, AMD는 또 다른 이야기다",
  "FAH의 GT200 Tesla 카드는 GeForce와 유사했다 (단, GF100 ECC는 Tesla C20xx에서 차이를 만드는 듯하다)",
]);

// =============== SLIDE 21 — Conclusions ===============
(()=>{
  const s=p.addSlide(); bg(s); header(s,"결론 (Conclusions)");
  s.addText([
    ln("명시적 테스트가 정당화될 만큼 하드 오류율이 충분히 높다 (2%).", TEXT, {bullet:{code:"2022"}, paraSpaceAfter:16, fontSize:22}),
    ln("신뢰성 있는 GPGPU 연산에는 어떤 형태의 ECC가 결정적으로 보인다.", INK, {bullet:{code:"2022"}, bold:true, fontSize:22}),
  ], { x:M, y:1.9, w:W-2*M, h:2.6, fontFace:KFONT, color:TEXT, valign:"top", margin:0, lineSpacingMultiple:1.2 });
  s.addShape(p.ShapeType.line,{x:M,y:5.0,w:6.5,h:0,line:{color:RULE,width:1.5}});
  s.addText([
    ln("https://simtk.org/home/memtest", TEAL, {breakLine:true, fontFace:MONO, fontSize:16}),
    ln("ihaque@cs.stanford.edu", MUTED, {breakLine:true, fontFace:MONO, fontSize:14}),
  ], { x:M, y:5.3, w:11, h:1.2, fontFace:MONO, margin:0, valign:"top", lineSpacingMultiple:1.2 });
  s.addNotes("결론: 2% 하드 오류율은 명시적 테스트를 정당화하고, 신뢰성 있는 GPGPU에는 ECC가 필수적임.");
})();

p.writeFile({ fileName: "../소프트오류_실측데이터_LACSS2010_한국어.pptx" }).then(f=>console.log("wrote", f));
