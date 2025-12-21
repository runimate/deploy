/* =========================================================
  RUNIMATE v2.0 — script.js (Rolling digits + OCR 연결)
  - 이 파일은 type="module" 로 로드하는 것을 권장합니다.
  - ocr.js 는 export async function extractAll(...) 를 유지하세요.
========================================================= */

const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

const els = {
  // record type
  btnDaily: byId('btnDaily') || $('[data-action="record-daily"]'),
  btnMonthly: byId('btnMonthly') || $('[data-action="record-monthly"]'),

  // data type tabs
  tabGarmin: byId('tabGarmin') || $('[data-action="data-garmin"]'),
  tabNRC: byId('tabNRC') || $('[data-action="data-nrc"]'),
  tabManual: byId('tabManual') || $('[data-action="data-manual"]'),

  // data contents
  contentGarmin: byId('contentGarmin') || $('[data-panel="garmin"]'),
  contentNRC: byId('contentNRC') || $('[data-panel="nrc"]'),
  contentManual: byId('contentManual') || $('[data-panel="manual"]'),
  dataEmpty: byId('dataEmpty') || $('[data-panel="empty"]'),

  // NRC upload (daily/monthly 공용)
  nrcFile: byId('nrcFile') || $('[data-role="nrc-file"]'),
  btnNrcUpload: byId('btnNrcUpload') || $('[data-action="nrc-upload"]'),
  ocrStatus: byId('ocrStatus') || $('[data-role="ocr-status"]'),

  // manual chips + display
  chipDistance: byId('chipDistance') || $('[data-action="manual-distance"]'),
  chipPace: byId('chipPace') || $('[data-action="manual-pace"]'),
  manualDistanceText: byId('manualDistanceText') || $('[data-role="manual-distance-text"]'),
  manualPaceText: byId('manualPaceText') || $('[data-role="manual-pace-text"]'),
  manualTimeText: byId('manualTimeText') || $('[data-role="manual-time-text"]'),

  // manual modal
  modalOverlay: byId('modalOverlay') || $('[data-role="modal-overlay"]'),
  modalTitle: byId('modalTitle') || $('[data-role="modal-title"]'),
  modalClose: byId('modalClose') || $('[data-action="modal-close"]'),
  formDistance: byId('formDistance') || $('[data-form="distance"]'),
  formPace: byId('formPace') || $('[data-form="pace"]'),
  inputDistance: byId('inputDistance') || $('[data-input="distance"]'),
  inputPaceMin: byId('inputPaceMin') || $('[data-input="pace-min"]'),
  inputPaceSec: byId('inputPaceSec') || $('[data-input="pace-sec"]'),
  saveDistance: byId('saveDistance') || $('[data-action="save-distance"]'),
  savePace: byId('savePace') || $('[data-action="save-pace"]'),

  // month selector (monthly mode)
  monthBtn: byId('monthBtn') || $('[data-action="month-open"]'),
  monthInput: byId('monthInput') || $('[data-role="month-input"]'), // <input type="month">
  monthLabel: byId('monthLabel') || $('[data-role="month-label"]'),

  // font/layout/bg
  fontBtns: Array.from(document.querySelectorAll('[data-font]')),
  layoutBtns: Array.from(document.querySelectorAll('[data-layout]')),
  bgBtns: Array.from(document.querySelectorAll('[data-bg]')),

  // preview containers
  previewDailyWrap: byId('previewDaily') || $('[data-preview="daily"]'),
  previewMonthlyWrap: byId('previewMonthly') || $('[data-preview="monthly"]'),

  // daily preview values
  pDailyDistance: byId('pDailyDistance') || $('[data-role="p-daily-distance"]'),
  pDailyPace: byId('pDailyPace') || $('[data-role="p-daily-pace"]'),
  pDailyTime: byId('pDailyTime') || $('[data-role="p-daily-time"]'),

  // monthly preview values
  pMonthText: byId('pMonthText') || $('[data-role="p-month-text"]'),
  pMonthlyDistance: byId('pMonthlyDistance') || $('[data-role="p-monthly-distance"]'),
  pMonthlyRuns: byId('pMonthlyRuns') || $('[data-role="p-monthly-runs"]'),
  pMonthlyPace: byId('pMonthlyPace') || $('[data-role="p-monthly-pace"]'),
  pMonthlyTime: byId('pMonthlyTime') || $('[data-role="p-monthly-time"]'),

  // RUN
  btnRun: byId('btnRun') || $('[data-action="run"]'),

  // overlays
  ovResult: byId('ovResult') || $('[data-screen="result"]'),
  ovGarminLogin: byId('ovGarminLogin') || $('[data-screen="garmin-login"]'),
  ovGarminSelect: byId('ovGarminSelect') || $('[data-screen="garmin-select"]'),

  // close buttons (작고 동일하게)
  closeResult: byId('closeResult') || $('[data-action="close-result"]'),
  closeGarminLogin: byId('closeGarminLogin') || $('[data-action="close-garmin-login"]'),
  closeGarminSelect: byId('closeGarminSelect') || $('[data-action="close-garmin-select"]'),

  // garmin login inputs
  gcEmail: byId('gcEmail') || $('[data-input="gc-email"]'),
  gcPass: byId('gcPass') || $('[data-input="gc-pass"]'),
  gcSignIn: byId('gcSignIn') || $('[data-action="gc-signin"]'),

  // garmin selection list
  workoutList: byId('workoutList') || $('[data-role="workout-list"]'),

  // garmin selected card on main
  garminCard: byId('garminCard') || $('[data-role="garmin-card"]'),
  garminCardDate: byId('garminCardDate') || $('[data-role="garmin-card-date"]'),
  garminCardDist: byId('garminCardDist') || $('[data-role="garmin-card-dist"]'),
  garminCardPace: byId('garminCardPace') || $('[data-role="garmin-card-pace"]'),
  garminCardTime: byId('garminCardTime') || $('[data-role="garmin-card-time"]'),
  garminCardListBtn: byId('garminCardListBtn') || $('[data-action="garmin-reselect"]'),

  // RESULT fields (daily type1/type2, monthly type1/type2)
  rDailyDistance: byId('rDailyDistance') || $('[data-role="r-daily-distance"]'),
  rDailyPace: byId('rDailyPace') || $('[data-role="r-daily-pace"]'),
  rDailyTime: byId('rDailyTime') || $('[data-role="r-daily-time"]'),

  rDailyDistance2: byId('rDailyDistance2') || $('[data-role="r-daily-distance2"]'),
  rDailyPace2: byId('rDailyPace2') || $('[data-role="r-daily-pace2"]'),
  rDailyTime2: byId('rDailyTime2') || $('[data-role="r-daily-time2"]'),

  rMonthlyMonth: byId('rMonthlyMonth') || $('[data-role="r-monthly-month"]'),
  rMonthlyDistance: byId('rMonthlyDistance') || $('[data-role="r-monthly-distance"]'),
  rMonthlyRuns: byId('rMonthlyRuns') || $('[data-role="r-monthly-runs"]'),
  rMonthlyPace: byId('rMonthlyPace') || $('[data-role="r-monthly-pace"]'),
  rMonthlyTime: byId('rMonthlyTime') || $('[data-role="r-monthly-time"]'),

  rMonthlyMonth2: byId('rMonthlyMonth2') || $('[data-role="r-monthly-month2"]'),
  rMonthlyDistance2: byId('rMonthlyDistance2') || $('[data-role="r-monthly-distance2"]'),
  rMonthlyRuns2: byId('rMonthlyRuns2') || $('[data-role="r-monthly-runs2"]'),
  rMonthlyPace2: byId('rMonthlyPace2') || $('[data-role="r-monthly-pace2"]'),
  rMonthlyTime2: byId('rMonthlyTime2') || $('[data-role="r-monthly-time2"]'),
};

// ---------- STATE ----------
const state = {
  record: 'daily',            // 'daily' | 'monthly'
  dataType: null,             // null | 'garmin' | 'nrc' | 'manual'
  font: 'dots',               // anton | dots | lcd | gothic | speed
  layout: 'type1',            // type1 | type2
  bg: 'white',                // white | black

  daily: { km: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
  monthly: { ym: null, km: 0, runs: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
};

// ---------- OCR 연결 (동적 import) ----------
let extractAllFn = null;
async function ensureOCR(){
  if(extractAllFn) return extractAllFn;
  const mod = await import('./ocr.js');
  if(typeof mod.extractAll !== 'function') throw new Error('ocr.js must export extractAll');
  extractAllFn = mod.extractAll;
  return extractAllFn;
}

// ---------- UTIL ----------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function zero2(n){ return String(n).padStart(2,'0'); }
function fmtKm2(km){ return Number(km||0).toFixed(2); }

function secondsToHMS(total){
  total = Math.max(0, Math.round(total||0));
  const h = Math.floor(total/3600);
  const m = Math.floor((total%3600)/60);
  const s = total%60;
  return { h, m, s };
}

function calcTimeFromKmPace(km, paceMin, paceSec){
  const pace = Math.max(0, (paceMin||0)*60 + (paceSec||0));
  const dist = Math.max(0, Number(km||0));
  if(!pace || !dist) return { h:0, m:0, s:0 };
  const sec = dist * pace;
  return secondsToHMS(sec);
}

// “표시용(프리뷰 텍스트)” — 기본 0일 때는 00 유지, 값이 있으면 앞 0 제거
function displayPace(min, sec){
  const m = Math.max(0, parseInt(min||0,10));
  const s = Math.max(0, parseInt(sec||0,10));
  if(m===0 && s===0) return `00'00"`;
  return `${m}'${zero2(s)}"`;
}
function displayTime(h,m,s){
  const hh = Math.max(0, parseInt(h||0,10));
  const mm = Math.max(0, parseInt(m||0,10));
  const ss = Math.max(0, parseInt(s||0,10));
  if(hh===0 && mm===0 && ss===0) return `00:00:00`;
  if(hh>0) return `${hh}:${zero2(mm)}:${zero2(ss)}`; // 1:27:32
  return `${mm}:${zero2(ss)}`;                      // 27:32
}
function displayRuns(runs){
  const v = Math.max(0, Math.round(Number(runs||0)));
  if(v===0) return '00';
  if(v<10) return String(v);
  return String(v);
}
function displayMonth(ym){
  // ym: "2025-12"
  if(!ym){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    ym = `${y}-${m}`;
  }
  const [y, m] = ym.split('-').map(x=>parseInt(x,10));
  const names = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const title = `${names[(m||1)-1]} ${y}`;
  return title;
}

// ---------- PREVIEW AUTOFIT (숫자 커짐 방지 + 삐져나감 방지) ----------
function autoFitText(el, { max=34, min=18 } = {}){
  if(!el) return;
  el.style.fontSize = `${max}px`;
  // fit within parent width
  const parent = el.parentElement;
  if(!parent) return;
  let fs = max;
  while(fs > min && el.scrollWidth > parent.clientWidth){
    fs -= 1;
    el.style.fontSize = `${fs}px`;
  }
}
function refreshPreviewAutofit(){
  // type2에서 특히 중요
  if(state.record === 'daily'){
    autoFitText(els.pDailyDistance, { max: 34, min: 18 });
    autoFitText(els.pDailyPace, { max: 34, min: 18 });
    autoFitText(els.pDailyTime, { max: 34, min: 16 });
  }else{
    autoFitText(els.pMonthlyDistance, { max: 34, min: 16 });
    autoFitText(els.pMonthlyRuns, { max: 28, min: 16 });
    autoFitText(els.pMonthlyPace, { max: 28, min: 16 });
    autoFitText(els.pMonthlyTime, { max: 28, min: 16 });
  }
}

// ---------- UI APPLY ----------
function setBodyData(){
  document.body.dataset.record = state.record;
  document.body.dataset.font = state.font;
  document.body.dataset.layout = state.layout;
  document.body.dataset.bg = state.bg;

  // preview card class swap은 CSS가 처리하되, wrapper가 없으면 안전하게 여기서 보조
  if(els.previewDailyWrap){
    els.previewDailyWrap.classList.toggle('type1', state.layout==='type1');
    els.previewDailyWrap.classList.toggle('type2', state.layout==='type2');
    els.previewDailyWrap.classList.toggle('bg-white', state.bg==='white');
    els.previewDailyWrap.classList.toggle('bg-black', state.bg==='black');
    els.previewDailyWrap.classList.toggle('font-anton', state.font==='anton');
    els.previewDailyWrap.classList.toggle('font-dots', state.font==='dots');
    els.previewDailyWrap.classList.toggle('font-lcd', state.font==='lcd');
    els.previewDailyWrap.classList.toggle('font-gothic', state.font==='gothic');
    els.previewDailyWrap.classList.toggle('font-speed', state.font==='speed');
  }
  if(els.previewMonthlyWrap){
    els.previewMonthlyWrap.classList.toggle('type1', state.layout==='type1');
    els.previewMonthlyWrap.classList.toggle('type2', state.layout==='type2');
    els.previewMonthlyWrap.classList.toggle('bg-white', state.bg==='white');
    els.previewMonthlyWrap.classList.toggle('bg-black', state.bg==='black');
    els.previewMonthlyWrap.classList.toggle('font-anton', state.font==='anton');
    els.previewMonthlyWrap.classList.toggle('font-dots', state.font==='dots');
    els.previewMonthlyWrap.classList.toggle('font-lcd', state.font==='lcd');
    els.previewMonthlyWrap.classList.toggle('font-gothic', state.font==='gothic');
    els.previewMonthlyWrap.classList.toggle('font-speed', state.font==='speed');
  }

  // result overlay font/bg
  if(els.ovResult){
    els.ovResult.classList.toggle('bg-white', state.bg==='white');
    els.ovResult.classList.toggle('bg-black', state.bg==='black');
    els.ovResult.classList.toggle('font-anton', state.font==='anton');
    els.ovResult.classList.toggle('font-dots', state.font==='dots');
    els.ovResult.classList.toggle('font-lcd', state.font==='lcd');
    els.ovResult.classList.toggle('font-gothic', state.font==='gothic');
    els.ovResult.classList.toggle('font-speed', state.font==='speed');
    els.ovResult.classList.toggle('type1', state.layout==='type1');
    els.ovResult.classList.toggle('type2', state.layout==='type2');
  }

  refreshPreviewAutofit();
}

function setActiveBtn(btns, matchFn){
  btns.forEach(b => b.classList.toggle('active', matchFn(b)));
}

function setRecord(record){
  state.record = record;

  // monthly는 NRC만 허용
  if(record === 'monthly'){
    state.dataType = 'nrc';
  }else{
    // daily는 선택 전 상태 가능
    state.dataType = state.dataType; // 유지
  }

  // record toggle
  if(els.btnDaily) els.btnDaily.classList.toggle('active', record==='daily');
  if(els.btnMonthly) els.btnMonthly.classList.toggle('active', record==='monthly');

  // data tabs: monthly면 manual/garmin disable 느낌(실제 클릭 방지)
  if(els.tabGarmin) els.tabGarmin.disabled = (record==='monthly');
  if(els.tabManual) els.tabManual.disabled = (record==='monthly');

  applyDataPanels();
  updatePreview();
  setBodyData();
}

function setDataType(type){
  if(state.record==='monthly' && type!=='nrc') return;
  state.dataType = type;
  applyDataPanels();

  if(type === 'garmin'){
    // 선택 즉시 로그인 화면으로 이동 (요청 흐름)
    openScreen(els.ovGarminLogin);
  }

  updatePreview();
}

function applyDataPanels(){
  const t = state.dataType;

  // tabs active
  if(els.tabGarmin) els.tabGarmin.classList.toggle('active', t==='garmin');
  if(els.tabNRC) els.tabNRC.classList.toggle('active', t==='nrc');
  if(els.tabManual) els.tabManual.classList.toggle('active', t==='manual');

  // content visibility
  const hasSelection = !!t;
  if(els.dataEmpty) els.dataEmpty.style.display = hasSelection ? 'none' : 'block';

  if(els.contentGarmin) els.contentGarmin.style.display = (t==='garmin') ? 'block' : 'none';
  if(els.contentNRC) els.contentNRC.style.display = (t==='nrc') ? 'block' : 'none';
  if(els.contentManual) els.contentManual.style.display = (t==='manual') ? 'block' : 'none';
}

function setFont(font){
  state.font = font;
  // 버튼 active
  els.fontBtns.forEach(b => b.classList.toggle('active', b.dataset.font === font));
  setBodyData();
}

function setLayout(layout){
  state.layout = layout;
  els.layoutBtns.forEach(b => b.classList.toggle('active', b.dataset.layout === layout));
  setBodyData();
  updatePreview();
}

function setBg(bg){
  state.bg = bg;
  els.bgBtns.forEach(b => b.classList.toggle('active', b.dataset.bg === bg));
  setBodyData();
}

function resetDailyToZero(){
  state.daily = { km:0, paceMin:0, paceSec:0, h:0, m:0, s:0 };
}
function resetMonthlyToZero(){
  state.monthly.km = 0;
  state.monthly.runs = 0;
  state.monthly.paceMin = 0;
  state.monthly.paceSec = 0;
  state.monthly.h = 0;
  state.monthly.m = 0;
  state.monthly.s = 0;
}

function updatePreview(){
  // daily preview
  if(state.record === 'daily'){
    if(els.previewDailyWrap) els.previewDailyWrap.style.display = 'block';
    if(els.previewMonthlyWrap) els.previewMonthlyWrap.style.display = 'none';

    const d = state.daily;
    if(els.pDailyDistance) els.pDailyDistance.textContent = `${fmtKm2(d.km)}Km`;
    if(els.pDailyPace) els.pDailyPace.textContent = displayPace(d.paceMin, d.paceSec);
    if(els.pDailyTime) els.pDailyTime.textContent = displayTime(d.h, d.m, d.s);

  } else {
    if(els.previewDailyWrap) els.previewDailyWrap.style.display = 'none';
    if(els.previewMonthlyWrap) els.previewMonthlyWrap.style.display = 'block';

    // month label
    if(!state.monthly.ym){
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      state.monthly.ym = `${y}-${m}`;
    }
    const monthTitle = displayMonth(state.monthly.ym);
    if(els.monthLabel) els.monthLabel.textContent = monthTitle;
    if(els.pMonthText) els.pMonthText.textContent = monthTitle;

    const mo = state.monthly;
    if(els.pMonthlyDistance) els.pMonthlyDistance.textContent = `${fmtKm2(mo.km)}Km`;
    if(els.pMonthlyRuns) els.pMonthlyRuns.textContent = displayRuns(mo.runs);
    if(els.pMonthlyPace) els.pMonthlyPace.textContent = displayPace(mo.paceMin, mo.paceSec);
    if(els.pMonthlyTime) els.pMonthlyTime.textContent = displayTime(mo.h, mo.m, mo.s);
  }

  refreshPreviewAutofit();
}
// =========================================================
// SCREEN OPEN/CLOSE
// =========================================================
function openScreen(screenEl){
  if(!screenEl) return;
  document.body.classList.add('no-scroll');
  screenEl.classList.add('show');
}
function closeScreen(screenEl){
  if(!screenEl) return;
  screenEl.classList.remove('show');
  // 다른 오버레이가 없으면 스크롤 복구
  const anyOpen = Array.from(document.querySelectorAll('.screen-overlay.show,[data-screen].show')).length > 0;
  if(!anyOpen) document.body.classList.remove('no-scroll');
}

// =========================================================
// MANUAL MODAL
// =========================================================
function openModal(which){
  if(!els.modalOverlay) return;
  document.body.classList.add('no-scroll');
  els.modalOverlay.classList.add('show');

  if(els.formDistance) els.formDistance.style.display = (which==='distance') ? 'block' : 'none';
  if(els.formPace) els.formPace.style.display = (which==='pace') ? 'block' : 'none';

  if(els.modalTitle){
    els.modalTitle.textContent = (which==='distance') ? 'Distance (Km)' : 'Pace (mm:ss /Km)';
  }
}
function closeModal(){
  if(!els.modalOverlay) return;
  els.modalOverlay.classList.remove('show');

  const anyScreenOpen = Array.from(document.querySelectorAll('.screen-overlay.show,[data-screen].show')).length > 0;
  if(!anyScreenOpen) document.body.classList.remove('no-scroll');
}

// =========================================================
// ANIMATION CORE
// =========================================================
function easeOutCubic(t){ return 1 - Math.pow(1-t,3); }

function animateNumber({ from, to, duration=900, onUpdate }){
  return new Promise((resolve)=>{
    const start = performance.now();
    const tick = (now)=>{
      const t = clamp((now-start)/duration, 0, 1);
      const v = from + (to-from)*easeOutCubic(t);
      onUpdate?.(v);
      if(t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

// =========================================================
// ROLLING DIGITS ENGINE (Result)
//  - style.css에 roll 관련 CSS(APPEND)가 있어야 예쁨
// =========================================================
function buildRoll(el, template){
  el.innerHTML = '';
  el.classList.add('roll');

  const digitSlots = [];
  for(const ch of template){
    if(/[0-9]/.test(ch)){
      const wrap = document.createElement('span');
      wrap.className = 'roll-digit';

      const stack = document.createElement('span');
      stack.className = 'roll-stack';

      for(let i=0;i<=9;i++){
        const s = document.createElement('span');
        s.textContent = String(i);
        stack.appendChild(s);
      }
      wrap.appendChild(stack);
      el.appendChild(wrap);
      digitSlots.push({ wrap, stack });
    } else {
      const c = document.createElement('span');
      c.className = 'roll-char';
      c.textContent = ch;
      el.appendChild(c);
    }
  }
  return { el, template, digitSlots };
}

const rollers = new Map(); // el -> roller

function ensureRoller(el, template){
  if(!el) return null;
  const prev = rollers.get(el);
  if(prev && prev.template === template) return prev;
  const r = buildRoll(el, template);
  rollers.set(el, r);
  return r;
}

function setRollString(roller, str, hiddenDigitSlotIdxs = new Set()){
  if(!roller) return;
  const digits = (str.match(/\d/g) || []);
  for(let i=0;i<roller.digitSlots.length;i++){
    const d = digits[i] ? parseInt(digits[i],10) : 0;
    const { wrap, stack } = roller.digitSlots[i];
    stack.style.transform = `translateY(${-d}em)`;
    wrap.classList.toggle('is-hidden', hiddenDigitSlotIdxs.has(i));
  }
}

// templates
function distTemplateByValue(km){
  return (Number(km||0) >= 100) ? '000.00Km' : '00.00Km';
}
function fmtDistanceFixed(km, template){
  const intDigits = template.startsWith('000') ? 3 : 2;
  const v = Math.max(0, Number(km||0));
  const fixed = v.toFixed(2);
  const [iPart, dPart] = fixed.split('.');
  const i = iPart.padStart(intDigits, '0');
  return `${i}.${dPart}Km`;
}
function fmtPaceFixed(min, sec){
  const m = Math.max(0, parseInt(min||0,10));
  const s = Math.max(0, parseInt(sec||0,10));
  return `${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`;
}
function timeTemplate(h,m,s){
  if((h|0)>0) return '00:00:00';
  if((m|0)>0 || (s|0)>0) return '00:00';
  return '00:00:00';
}
function fmtTimeFixed(h,m,s, template){
  const hh = Math.max(0, parseInt(h||0,10));
  const mm = Math.max(0, parseInt(m||0,10));
  const ss = Math.max(0, parseInt(s||0,10));
  if(template === '00:00') return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// hide leading zeros while keeping slots
function hideLeadingZerosForDistance(str, template){
  const intSlots = template.startsWith('000') ? [0,1,2] : [0,1];
  const digits = (str.match(/\d/g) || []).map(n=>parseInt(n,10));
  const hidden = new Set();
  const valueInt = parseInt(str.split('.')[0], 10) || 0;
  if(valueInt === 0) return hidden;

  for(let i=0;i<intSlots.length-1;i++){
    const idx = intSlots[i];
    if(digits[idx] === 0) hidden.add(idx);
  }
  if(intSlots.length === 3){
    if(digits[0]===0 && digits[1]===0) hidden.add(1);
  }
  return hidden;
}
function hideLeadingZerosForPace(str){
  const m = parseInt(str.slice(0,2),10) || 0;
  const hidden = new Set();
  if(m > 0 && m < 10) hidden.add(0);
  return hidden;
}
function hideLeadingZerosForTime(str, template){
  const hidden = new Set();
  if(template === '00:00'){
    const m = parseInt(str.slice(0,2),10) || 0;
    if(m > 0 && m < 10) hidden.add(0);
    return hidden;
  }
  const h = parseInt(str.slice(0,2),10) || 0;
  if(h > 0 && h < 10) hidden.add(0);
  return hidden;
}
function hideLeadingZerosForRuns(str){
  const v = parseInt(str,10) || 0;
  const hidden = new Set();
  if(v > 0 && v < 10) hidden.add(0);
  return hidden;
}

function setRollingDistance(elList, km){
  const tpl = distTemplateByValue(km);
  const str = fmtDistanceFixed(km, tpl);
  const hidden = hideLeadingZerosForDistance(str, tpl);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str, hidden);
  }
}

function setRollingPace(elList, min, sec){
  const tpl = `00'00"`;
  const str = fmtPaceFixed(min, sec);
  const hidden = hideLeadingZerosForPace(str);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str, hidden);
  }
}

function setRollingTime(elList, h,m,s){
  const tpl = timeTemplate(h,m,s);
  const str = fmtTimeFixed(h,m,s, tpl);
  const hidden = hideLeadingZerosForTime(str, tpl);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    // TIME baseline fix class (CSS에서 올려줌)
    el.classList.add('is-time');
    setRollString(r, str, hidden);
  }
}

function setRollingRuns(elList, runs){
  const tpl = `00`;
  const v = Math.max(0, Math.round(Number(runs||0)));
  const str = String(v).padStart(2,'0');
  const hidden = hideLeadingZerosForRuns(str);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str, hidden);
  }
}

// =========================================================
// RUN RESULT (0.5s hold + distance/pace/time 동시에)
// =========================================================
async function runResultAnimation(){
  const isMonthly = (state.record === 'monthly');

  if(!els.ovResult) return;
  openScreen(els.ovResult);

  // 항상 0에서 시작(자리수 고정 롤링)
  if(!isMonthly){
    setRollingDistance([els.rDailyDistance, els.rDailyDistance2], 0);
    setRollingPace([els.rDailyPace, els.rDailyPace2], 0, 0);
    setRollingTime([els.rDailyTime, els.rDailyTime2], 0, 0, 0);

    await new Promise(r=>setTimeout(r, 500));

    const d = state.daily;
    const targetKm = Number(d.km||0);
    const targetPaceSec = Math.max(0, Number(d.paceMin||0)*60 + Number(d.paceSec||0));
    const targetTimeSec = Math.max(0, Number(d.h||0)*3600 + Number(d.m||0)*60 + Number(d.s||0));

    await Promise.all([
      animateNumber({
        from: 0, to: targetKm, duration: 900,
        onUpdate: (v)=> setRollingDistance([els.rDailyDistance, els.rDailyDistance2], v)
      }),
      animateNumber({
        from: 0, to: targetPaceSec, duration: 900,
        onUpdate: (v)=>{
          const vv = Math.max(0, Math.floor(v));
          setRollingPace([els.rDailyPace, els.rDailyPace2], Math.floor(vv/60), vv%60);
        }
      }),
      animateNumber({
        from: 0, to: targetTimeSec, duration: 900,
        onUpdate: (v)=>{
          const vv = Math.max(0, Math.floor(v));
          const h = Math.floor(vv/3600);
          const m = Math.floor((vv%3600)/60);
          const s = vv%60;
          setRollingTime([els.rDailyTime, els.rDailyTime2], h,m,s);
        }
      }),
    ]);

  } else {
    // monthly
    setRollingDistance([els.rMonthlyDistance, els.rMonthlyDistance2], 0);
    setRollingRuns([els.rMonthlyRuns, els.rMonthlyRuns2], 0);
    setRollingPace([els.rMonthlyPace, els.rMonthlyPace2], 0, 0);
    setRollingTime([els.rMonthlyTime, els.rMonthlyTime2], 0, 0, 0);

    // month text는 애니메이션 대상 아님
    const monthTitle = displayMonth(state.monthly.ym);
    if(els.rMonthlyMonth) els.rMonthlyMonth.textContent = monthTitle;
    if(els.rMonthlyMonth2) els.rMonthlyMonth2.textContent = monthTitle;

    await new Promise(r=>setTimeout(r, 500));

    const mo = state.monthly;
    const targetKm = Number(mo.km||0);
    const targetRuns = Number(mo.runs||0);
    const targetPaceSec = Math.max(0, Number(mo.paceMin||0)*60 + Number(mo.paceSec||0));
    const targetTimeSec = Math.max(0, Number(mo.h||0)*3600 + Number(mo.m||0)*60 + Number(mo.s||0));

    await Promise.all([
      animateNumber({
        from: 0, to: targetKm, duration: 900,
        onUpdate: (v)=> setRollingDistance([els.rMonthlyDistance, els.rMonthlyDistance2], v)
      }),
      animateNumber({
        from: 0, to: targetRuns, duration: 900,
        onUpdate: (v)=> setRollingRuns([els.rMonthlyRuns, els.rMonthlyRuns2], v)
      }),
      animateNumber({
        from: 0, to: targetPaceSec, duration: 900,
        onUpdate: (v)=>{
          const vv = Math.max(0, Math.floor(v));
          setRollingPace([els.rMonthlyPace, els.rMonthlyPace2], Math.floor(vv/60), vv%60);
        }
      }),
      animateNumber({
        from: 0, to: targetTimeSec, duration: 900,
        onUpdate: (v)=>{
          const vv = Math.max(0, Math.floor(v));
          const h = Math.floor(vv/3600);
          const m = Math.floor((vv%3600)/60);
          const s = vv%60;
          setRollingTime([els.rMonthlyTime, els.rMonthlyTime2], h,m,s);
        }
      }),
    ]);
  }
}

// =========================================================
// OCR HANDLERS
// =========================================================
async function handleNrcFile(file){
  if(!file) return;
  const url = await fileToDataURL(file);

  if(els.ocrStatus){
    els.ocrStatus.textContent = 'OCR reading...';
    els.ocrStatus.classList.add('show');
  }

  try{
    const extractAll = await ensureOCR();
    const recordType = state.record; // 'daily' | 'monthly'
    const out = await extractAll(url, { recordType });

    if(recordType === 'daily'){
      // daily: 거리/페이스/시간
      state.daily.km = Number(out.km||0);
      state.daily.paceMin = Number(out.paceMin||0);
      state.daily.paceSec = Number(out.paceSec||0);

      // timeRaw 파싱된 h/m/s 우선
      state.daily.h = Number(out.timeH||0);
      state.daily.m = Number(out.timeM||0);
      state.daily.s = Number(out.timeS||0);

      // time이 없고 pace+km 있으면 계산
      if((state.daily.h+state.daily.m+state.daily.s)===0){
        const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
        state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;
      }
    } else {
      // monthly: km / runs / pace / time
      state.monthly.km = Number(out.km||0);
      state.monthly.runs = Number(out.runs||0);
      state.monthly.paceMin = Number(out.paceMin||0);
      state.monthly.paceSec = Number(out.paceSec||0);
      state.monthly.h = Number(out.timeH||0);
      state.monthly.m = Number(out.timeM||0);
      state.monthly.s = Number(out.timeS||0);

      if((state.monthly.h+state.monthly.m+state.monthly.s)===0){
        const t = calcTimeFromKmPace(state.monthly.km, state.monthly.paceMin, state.monthly.paceSec);
        state.monthly.h=t.h; state.monthly.m=t.m; state.monthly.s=t.s;
      }
    }

    updatePreview();
    if(els.ocrStatus){
      els.ocrStatus.textContent = 'OCR done ✓';
      setTimeout(()=>els.ocrStatus.classList.remove('show'), 1200);
    }
  }catch(err){
    console.error(err);
    if(els.ocrStatus){
      els.ocrStatus.textContent = 'OCR failed';
      setTimeout(()=>els.ocrStatus.classList.remove('show'), 1500);
    }
  }
}

function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// =========================================================
// GARMIN FLOW (UI only / stub)
// =========================================================
function seedFakeWorkouts(){
  if(!els.workoutList) return;
  els.workoutList.innerHTML = '';
  const rows = Array.from({length: 12}).map((_,i)=>({
    date: '2025.12.12',
    km: 14.64,
    pace: {m:5,s:59},
    t: {h:1,m:27,s:32},
    active: i===1
  }));
  for(const r of rows){
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'workout-item' + (r.active ? ' active' : '');
    item.innerHTML = `
      <div class="workout-left">
        <div class="workout-date">${r.date}</div>
        <div class="workout-stats">
          <span>${fmtKm2(r.km)}Km</span>
          <span>${displayPace(r.pace.m,r.pace.s)}</span>
          <span>${displayTime(r.t.h,r.t.m,r.t.s)}</span>
        </div>
      </div>
      <div class="workout-arrow">→</div>
    `;
    item.addEventListener('click', ()=>{
      // 선택 적용 → 메인 카드 + daily 데이터 세팅
      state.dataType = 'garmin';
      applyDataPanels();

      state.daily.km = r.km;
      state.daily.paceMin = r.pace.m;
      state.daily.paceSec = r.pace.s;
      state.daily.h = r.t.h;
      state.daily.m = r.t.m;
      state.daily.s = r.t.s;

      // main garmin card
      if(els.garminCardDate) els.garminCardDate.textContent = r.date;
      if(els.garminCardDist) els.garminCardDist.textContent = `${fmtKm2(r.km)}Km`;
      if(els.garminCardPace) els.garminCardPace.textContent = displayPace(r.pace.m,r.pace.s);
      if(els.garminCardTime) els.garminCardTime.textContent = displayTime(r.t.h,r.t.m,r.t.s);

      updatePreview();
      closeScreen(els.ovGarminSelect);
    });
    els.workoutList.appendChild(item);
  }
}

// =========================================================
// EVENT BINDING
// =========================================================
function bind(){
  // record buttons
  els.btnDaily?.addEventListener('click', ()=> setRecord('daily'));
  els.btnMonthly?.addEventListener('click', ()=> setRecord('monthly'));

  // data tabs
  els.tabGarmin?.addEventListener('click', ()=> setDataType('garmin'));
  els.tabNRC?.addEventListener('click', ()=> setDataType('nrc'));
  els.tabManual?.addEventListener('click', ()=> setDataType('manual'));

  // font
  els.fontBtns.forEach(b => b.addEventListener('click', ()=> setFont(b.dataset.font)));

  // layout/bg
  els.layoutBtns.forEach(b => b.addEventListener('click', ()=> setLayout(b.dataset.layout)));
  els.bgBtns.forEach(b => b.addEventListener('click', ()=> setBg(b.dataset.bg)));

  // nrc upload
  els.btnNrcUpload?.addEventListener('click', ()=> els.nrcFile?.click());
  els.nrcFile?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    if(f) handleNrcFile(f);
    e.target.value = '';
  });

  // manual open
  els.chipDistance?.addEventListener('click', ()=> openModal('distance'));
  els.chipPace?.addEventListener('click', ()=> openModal('pace'));
  els.modalClose?.addEventListener('click', closeModal);
  els.modalOverlay?.addEventListener('click', (e)=>{
    if(e.target === els.modalOverlay) closeModal();
  });

  // manual save
  els.saveDistance?.addEventListener('click', ()=>{
    const km = Number(String(els.inputDistance?.value||'').replace(',','.'));
    state.daily.km = isFinite(km) ? km : 0;

    // time auto calc
    const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
    state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;

    closeModal();
    updatePreview();
  });
  els.savePace?.addEventListener('click', ()=>{
    const m = parseInt(els.inputPaceMin?.value||'0',10) || 0;
    const s = parseInt(els.inputPaceSec?.value||'0',10) || 0;
    state.daily.paceMin = clamp(m,0,99);
    state.daily.paceSec = clamp(s,0,59);

    const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
    state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;

    closeModal();
    updatePreview();
  });

  // month picker
  els.monthBtn?.addEventListener('click', ()=>{
    if(!els.monthInput) return;
    els.monthInput.click();
  });
  els.monthInput?.addEventListener('change', (e)=>{
    const v = e.target.value; // "2025-12"
    if(v) state.monthly.ym = v;
    updatePreview();
  });

  // run
  els.btnRun?.addEventListener('click', ()=>{
    // dataType 선택 전이면 무시(요청한 기본 상태)
    if(state.record==='daily' && !state.dataType) return;
    runResultAnimation();
  });

  // overlay closes
  els.closeResult?.addEventListener('click', ()=> closeScreen(els.ovResult));
  els.closeGarminLogin?.addEventListener('click', ()=> closeScreen(els.ovGarminLogin));
  els.closeGarminSelect?.addEventListener('click', ()=> closeScreen(els.ovGarminSelect));

  // garmin sign-in (UI only)
  els.gcSignIn?.addEventListener('click', ()=>{
    // 여기서 실제 Garmin 연동 붙일 예정 (지금은 활동목록 화면으로)
    closeScreen(els.ovGarminLogin);
    seedFakeWorkouts();
    openScreen(els.ovGarminSelect);
  });

  // garmin reselect (main card list btn)
  els.garminCardListBtn?.addEventListener('click', ()=>{
    seedFakeWorkouts();
    openScreen(els.ovGarminSelect);
  });

  // resize fit
  window.addEventListener('resize', ()=> refreshPreviewAutofit());
}

// =========================================================
// INIT (기본 화면: data type 미선택 + 숫자 0)
// =========================================================
function init(){
  // 기본값 세팅
  resetDailyToZero();
  resetMonthlyToZero();

  // 기본 month
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  state.monthly.ym = `${y}-${m}`;
  if(els.monthInput) els.monthInput.value = state.monthly.ym;

  // 기본 UI
  setRecord('daily');
  state.dataType = null; // ✅ 첫 화면 data type 선택 전 상태 유지
  applyDataPanels();

  setFont(state.font);
  setLayout(state.layout);
  setBg(state.bg);

  updatePreview();
  setBodyData();

  bind();
}

init();
