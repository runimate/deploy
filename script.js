/* =========================================================
  RUNIMATE v2.0 — script.js (ID sync with current index.html)
  - index.html의 실제 id 기준으로 전면 정리
  - ocr.js 는 export async function extractAll(...) 유지
========================================================= */

const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

// -------------------------
// ELEMENTS (index.html id와 1:1 매칭)
// -------------------------
const els = {
  // record type
  btnDaily: byId('btnDaily'),
  btnMonthly: byId('btnMonthly'),

  // data tabs
  tabGarmin: byId('tabGarmin'),
  tabNrc: byId('tabNrc'),
  tabManual: byId('tabManual'),

  // data contents
  dataEmpty: byId('dataEmpty'),
  contentGarmin: byId('contentGarmin'),
  contentNrc: byId('contentNrc'),
  contentManual: byId('contentManual'),

  // NRC upload
  btnUploadNrc: byId('btnUploadNrc'),
  fileNrc: byId('fileNrc'),
  ocrStatus: byId('ocrStatus'),

  // manual chips + display
  chipDistance: byId('chipDistance'),
  chipPace: byId('chipPace'),
  manualKm: byId('manualKm'),
  manualPace: byId('manualPace'),
  manualTime: byId('manualTime'),

  // monthly month block + btn
  monthBlock: byId('monthBlock'),
  btnMonth: byId('btnMonth'),

  // font buttons
  fontAnton: byId('fontAnton'),
  fontDots: byId('fontDots'),
  fontLcd: byId('fontLcd'),
  fontGothic: byId('fontGothic'),
  fontSpeed: byId('fontSpeed'),

  // layout/bg buttons
  btnType1: byId('btnType1'),
  btnType2: byId('btnType2'),
  btnBgWhite: byId('btnBgWhite'),
  btnBgBlack: byId('btnBgBlack'),

  // preview wrappers
  previewDailyWrap: byId('previewDaily'),
  previewMonthlyWrap: byId('previewMonthly'),

  // daily preview values (type1/type2)
  pvDailyDistance: byId('pvDailyDistance'),
  pvDailyPace: byId('pvDailyPace'),
  pvDailyTime: byId('pvDailyTime'),
  pvDailyDistance2: byId('pvDailyDistance2'),
  pvDailyPace2: byId('pvDailyPace2'),
  pvDailyTime2: byId('pvDailyTime2'),

  // monthly preview values (type1/type2)
  pvMonthTitle: byId('pvMonthTitle'), // DECEMBER<br/>2025
  pvMonthlyDistance: byId('pvMonthlyDistance'),
  pvMonthlyRuns: byId('pvMonthlyRuns'),
  pvMonthlyPace: byId('pvMonthlyPace'),
  pvMonthlyTime: byId('pvMonthlyTime'),

  pvMonthLine: byId('pvMonthLine'), // DECEMBER 2025
  pvMonthlyDistance2: byId('pvMonthlyDistance2'),
  pvMonthlyRuns2: byId('pvMonthlyRuns2'),
  pvMonthlyPace2: byId('pvMonthlyPace2'),
  pvMonthlyTime2: byId('pvMonthlyTime2'),

  // RUN
  btnRun: byId('btnRun'),

  // overlays
  screenGarminLogin: byId('screenGarminLogin'),
  closeGarminLogin: byId('closeGarminLogin'),
  gcEmail: byId('gcEmail'),
  gcPw: byId('gcPw'),
  btnGarminSignIn: byId('btnGarminSignIn'),

  screenSelectWorkout: byId('screenSelectWorkout'),
  closeSelectWorkout: byId('closeSelectWorkout'),
  workoutList: byId('workoutList'),

  screenMonthPicker: byId('screenMonthPicker'),
  closeMonthPicker: byId('closeMonthPicker'),
  mpYear: byId('mpYear'),
  mpMonth: byId('mpMonth'),
  btnMonthApply: byId('btnMonthApply'),

  screenResult: byId('screenResult'),
  closeResult: byId('closeResult'),

  // garmin selected card on main
  garminCard: byId('garminCard'),
  garminDate: byId('garminDate'),
  garminKm: byId('garminKm'),
  garminPace: byId('garminPace'),
  garminTime: byId('garminTime'),
  btnGarminList: byId('btnGarminList'),

  // RESULT fields (daily type1/type2)
  rDailyDistance: byId('rDailyDistance'),
  rDailyPace: byId('rDailyPace'),
  rDailyTime: byId('rDailyTime'),
  rDailyDistance2: byId('rDailyDistance2'),
  rDailyPace2: byId('rDailyPace2'),
  rDailyTime2: byId('rDailyTime2'),

  // RESULT fields (monthly type1/type2)
  rMonthTitle: byId('rMonthTitle'),     // DECEMBER<br/>2025
  rMonthlyDistance: byId('rMonthlyDistance'),
  rMonthlyRuns: byId('rMonthlyRuns'),
  rMonthlyPace: byId('rMonthlyPace'),
  rMonthlyTime: byId('rMonthlyTime'),

  rMonthLine: byId('rMonthLine'),       // DECEMBER 2025
  rMonthlyDistance2: byId('rMonthlyDistance2'),
  rMonthlyRuns2: byId('rMonthlyRuns2'),
  rMonthlyPace2: byId('rMonthlyPace2'),
  rMonthlyTime2: byId('rMonthlyTime2'),
};

// -------------------------
// STATE
// -------------------------
const state = {
  record: 'daily',            // 'daily' | 'monthly'
  dataType: null,             // null | 'garmin' | 'nrc' | 'manual'
  font: 'dots',               // anton | dots | lcd | gothic | speed
  layout: 'type1',            // type1 | type2
  bg: 'white',                // white | black

  daily: { km: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
  monthly: { ym: null, km: 0, runs: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
};

// -------------------------
// OCR (dynamic import)
// -------------------------
let extractAllFn = null;
async function ensureOCR(){
  if(extractAllFn) return extractAllFn;
  const mod = await import('./ocr.js');
  if(typeof mod.extractAll !== 'function') throw new Error('ocr.js must export extractAll');
  extractAllFn = mod.extractAll;
  return extractAllFn;
}

// -------------------------
// UTIL
// -------------------------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const zero2 = (n) => String(Math.max(0, n|0)).padStart(2,'0');
const fmtKm2 = (km) => Number(km||0).toFixed(2);

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
  return secondsToHMS(dist * pace);
}

// UI 표시용
function displayPaceFull(min, sec){
  const m = Math.max(0, parseInt(min||0,10));
  const s = Math.max(0, parseInt(sec||0,10));
  return `${zero2(m)}'${zero2(s)}"`;
}
function displayPaceCompact(min, sec){
  const m = Math.max(0, parseInt(min||0,10));
  const s = Math.max(0, parseInt(sec||0,10));
  if(m === 0 && s === 0) return `00'00"`;
  return `${m}'${zero2(s)}"`;
}
function displayTimeFull(h,m,s){
  return `${zero2(h)}:${zero2(m)}:${zero2(s)}`;
}
function displayTimeCompact(h,m,s){
  const hh = Math.max(0, parseInt(h||0,10));
  const mm = Math.max(0, parseInt(m||0,10));
  const ss = Math.max(0, parseInt(s||0,10));
  if(hh === 0 && mm === 0 && ss === 0) return `00:00:00`;
  if(hh > 0) return `${hh}:${zero2(mm)}:${zero2(ss)}`;
  return `${mm}:${zero2(ss)}`;
}
function displayRuns2(runs){
  const v = Math.max(0, Math.round(Number(runs||0)));
  return String(v).padStart(2,'0');
}

// month text helpers
const MONTHS_UPPER = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const MONTHS_TITLE = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function normalizeYM(ym){
  if(ym) return ym;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  return `${y}-${m}`;
}

function monthTexts(ym){
  ym = normalizeYM(ym);
  const [yy, mm] = ym.split('-').map(v => parseInt(v,10));
  const mIdx = clamp((mm||1)-1, 0, 11);
  const upper = MONTHS_UPPER[mIdx];
  const title = MONTHS_TITLE[mIdx];

  return {
    ym,
    upper, year: yy,
    previewBrHTML: `${upper}<br/>${yy}`,
    lineText: `${upper} ${yy}`,
    btnText: `${title}, ${yy}`,
  };
}

// -------------------------
// SCREEN OPEN/CLOSE (overlay)
// -------------------------
function openScreen(screenEl){
  if(!screenEl) return;
  document.body.classList.add('no-scroll');
  screenEl.classList.add('show');
  screenEl.setAttribute('aria-hidden', 'false');
}
function closeScreen(screenEl){
  if(!screenEl) return;
  screenEl.classList.remove('show');
  screenEl.setAttribute('aria-hidden', 'true');

  const anyOpen = Array.from(document.querySelectorAll('.screen-overlay.show')).length > 0;
  if(!anyOpen) document.body.classList.remove('no-scroll');
}

// -------------------------
// UI APPLY
// -------------------------
function setBodyData(){
  document.body.dataset.record = state.record;
  document.body.dataset.datatype = state.dataType || 'none';
  document.body.dataset.layout = state.layout;
  document.body.dataset.bg = state.bg;
  document.body.dataset.font = state.font;
}

function setRecord(record){
  state.record = record;

  if(record === 'monthly'){
    state.dataType = 'nrc'; // monthly는 NRC 강제
  }

  // toggle active
  els.btnDaily?.classList.toggle('active', record === 'daily');
  els.btnMonthly?.classList.toggle('active', record === 'monthly');

  // monthly면 Garmin/Manual 탭 비활성
  if(els.tabGarmin) els.tabGarmin.disabled = (record === 'monthly');
  if(els.tabManual) els.tabManual.disabled = (record === 'monthly');

  // month block 표시
  if(els.monthBlock) els.monthBlock.style.display = (record === 'monthly') ? 'block' : 'none';

  applyDataPanels();
  updatePreview();
  setActiveToggles();
  setBodyData();
}

function setDataType(type){
  if(state.record === 'monthly' && type !== 'nrc') return;
  state.dataType = type;

  applyDataPanels();
  updatePreview();
  setActiveToggles();
  setBodyData();

  if(type === 'garmin'){
    openScreen(els.screenGarminLogin);
  }
}

function applyDataPanels(){
  const t = state.dataType;

  // tabs active
  els.tabGarmin?.classList.toggle('active', t === 'garmin');
  els.tabNrc?.classList.toggle('active', t === 'nrc');
  els.tabManual?.classList.toggle('active', t === 'manual');

  const hasSelection = !!t;
  if(els.dataEmpty) els.dataEmpty.style.display = hasSelection ? 'none' : 'block';

  if(els.contentGarmin) els.contentGarmin.style.display = (t === 'garmin') ? 'block' : 'none';
  if(els.contentNrc) els.contentNrc.style.display = (t === 'nrc') ? 'block' : 'none';
  if(els.contentManual) els.contentManual.style.display = (t === 'manual') ? 'block' : 'none';
}

function setFont(font){
  state.font = font;
  setActiveToggles();
  setBodyData();
}

function setLayout(layout){
  state.layout = layout;
  setActiveToggles();
  setBodyData();
}

function setBg(bg){
  state.bg = bg;
  setActiveToggles();
  setBodyData();
}

function setActiveToggles(){
  // font
  els.fontAnton?.classList.toggle('active', state.font === 'anton');
  els.fontDots?.classList.toggle('active', state.font === 'dots');
  els.fontLcd?.classList.toggle('active', state.font === 'lcd');
  els.fontGothic?.classList.toggle('active', state.font === 'gothic');
  els.fontSpeed?.classList.toggle('active', state.font === 'speed');

  // layout
  els.btnType1?.classList.toggle('active', state.layout === 'type1');
  els.btnType2?.classList.toggle('active', state.layout === 'type2');

  // bg
  els.btnBgWhite?.classList.toggle('active', state.bg === 'white');
  els.btnBgBlack?.classList.toggle('active', state.bg === 'black');
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
  if(state.record === 'daily'){
    if(els.previewDailyWrap) els.previewDailyWrap.style.display = 'block';
    if(els.previewMonthlyWrap) els.previewMonthlyWrap.style.display = 'none';

    const d = state.daily;
    const dist = `${fmtKm2(d.km)}Km`;
    const pace = displayPaceFull(d.paceMin, d.paceSec);
    const time = displayTimeFull(d.h, d.m, d.s);

    if(els.pvDailyDistance) els.pvDailyDistance.textContent = dist;
    if(els.pvDailyPace) els.pvDailyPace.textContent = pace;
    if(els.pvDailyTime) els.pvDailyTime.textContent = time;

    if(els.pvDailyDistance2) els.pvDailyDistance2.textContent = dist;
    if(els.pvDailyPace2) els.pvDailyPace2.textContent = pace;
    if(els.pvDailyTime2) els.pvDailyTime2.textContent = time;

    // manual display도 동기화 (manual 모드에서 주로 의미)
    if(els.manualKm) els.manualKm.textContent = fmtKm2(d.km);
    if(els.manualPace) els.manualPace.textContent = displayPaceFull(d.paceMin, d.paceSec);
    if(els.manualTime) els.manualTime.textContent = displayTimeFull(d.h, d.m, d.s);

  } else {
    if(els.previewDailyWrap) els.previewDailyWrap.style.display = 'none';
    if(els.previewMonthlyWrap) els.previewMonthlyWrap.style.display = 'block';

    const mt = monthTexts(state.monthly.ym);
    state.monthly.ym = mt.ym;

    if(els.btnMonth) els.btnMonth.textContent = mt.btnText;
    if(els.pvMonthTitle) els.pvMonthTitle.innerHTML = mt.previewBrHTML;
    if(els.pvMonthLine) els.pvMonthLine.textContent = mt.lineText;

    const mo = state.monthly;
    const dist = `${fmtKm2(mo.km)}Km`;
    const runs = displayRuns2(mo.runs);
    const pace = displayPaceFull(mo.paceMin, mo.paceSec);
    const time = displayTimeFull(mo.h, mo.m, mo.s);

    if(els.pvMonthlyDistance) els.pvMonthlyDistance.textContent = dist;
    if(els.pvMonthlyRuns) els.pvMonthlyRuns.textContent = runs;
    if(els.pvMonthlyPace) els.pvMonthlyPace.textContent = pace;
    if(els.pvMonthlyTime) els.pvMonthlyTime.textContent = time;

    if(els.pvMonthlyDistance2) els.pvMonthlyDistance2.textContent = dist;
    if(els.pvMonthlyRuns2) els.pvMonthlyRuns2.textContent = runs;
    if(els.pvMonthlyPace2) els.pvMonthlyPace2.textContent = pace;
    if(els.pvMonthlyTime2) els.pvMonthlyTime2.textContent = time;
  }
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
  // 결과 화면은 hh:mm:ss 기준 (0이어도 유지)
  return '00:00:00';
}
function fmtTimeFixed(h,m,s){
  const hh = Math.max(0, parseInt(h||0,10));
  const mm = Math.max(0, parseInt(m||0,10));
  const ss = Math.max(0, parseInt(s||0,10));
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
function hideLeadingZerosForTime(str){
  const h = parseInt(str.slice(0,2),10) || 0;
  const hidden = new Set();
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
  const str = fmtTimeFixed(h,m,s);
  const hidden = hideLeadingZerosForTime(str);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
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
  if(!els.screenResult) return;

  openScreen(els.screenResult);

  if(!isMonthly){
    // start from 0
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

    const mt = monthTexts(state.monthly.ym);
    state.monthly.ym = mt.ym;
    if(els.rMonthTitle) els.rMonthTitle.innerHTML = mt.previewBrHTML;
    if(els.rMonthLine) els.rMonthLine.textContent = mt.lineText;

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
function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function handleNrcFile(file){
  if(!file) return;
  const url = await fileToDataURL(file);

  if(els.ocrStatus){
    els.ocrStatus.textContent = 'OCR reading...';
  }

  try{
    const extractAll = await ensureOCR();
    const recordType = state.record; // 'daily' | 'monthly'
    const out = await extractAll(url, { recordType });

    if(recordType === 'daily'){
      state.daily.km = Number(out.km||0);
      state.daily.paceMin = Number(out.paceMin||0);
      state.daily.paceSec = Number(out.paceSec||0);

      state.daily.h = Number(out.timeH||0);
      state.daily.m = Number(out.timeM||0);
      state.daily.s = Number(out.timeS||0);

      if((state.daily.h+state.daily.m+state.daily.s)===0){
        const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
        state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;
      }
    } else {
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
    if(els.ocrStatus) els.ocrStatus.textContent = 'OCR done ✓';
  }catch(err){
    console.error(err);
    if(els.ocrStatus) els.ocrStatus.textContent = 'OCR failed';
  }
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
          <span>${displayPaceCompact(r.pace.m,r.pace.s)}</span>
          <span>${displayTimeCompact(r.t.h,r.t.m,r.t.s)}</span>
        </div>
      </div>
      <div class="workout-arrow">→</div>
    `;

    item.addEventListener('click', ()=>{
      state.dataType = 'garmin';
      applyDataPanels();

      state.daily.km = r.km;
      state.daily.paceMin = r.pace.m;
      state.daily.paceSec = r.pace.s;
      state.daily.h = r.t.h;
      state.daily.m = r.t.m;
      state.daily.s = r.t.s;

      // main garmin card sync
      if(els.garminDate) els.garminDate.textContent = r.date;
      if(els.garminKm) els.garminKm.textContent = `${fmtKm2(r.km)}Km`;
      if(els.garminPace) els.garminPace.textContent = displayPaceCompact(r.pace.m,r.pace.s);
      if(els.garminTime) els.garminTime.textContent = displayTimeCompact(r.t.h,r.t.m,r.t.s);

      updatePreview();
      setActiveToggles();
      setBodyData();
      closeScreen(els.screenSelectWorkout);
    });

    els.workoutList.appendChild(item);
  }
}

// =========================================================
// MANUAL INPUT (현재 HTML에 모달이 없어서 prompt로 처리)
// =========================================================
function promptDistance(){
  const cur = fmtKm2(state.daily.km);
  const v = prompt('Distance (Km)', cur);
  if(v === null) return;

  const km = Number(String(v).trim().replace(',', '.'));
  state.daily.km = isFinite(km) ? km : 0;

  // pace가 있으면 time 계산
  const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
  state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;

  updatePreview();
}

function promptPace(){
  const cur = displayPaceFull(state.daily.paceMin, state.daily.paceSec);
  const v = prompt('Pace (mm:ss)', cur.replace(/['"]/g,'').replace(' ', '').replace(':', ':')); // just display
  if(v === null) return;

  const txt = String(v).trim().replace("'", ':').replace('"','');
  const parts = txt.split(':').map(x=>x.trim());
  let m = parseInt(parts[0] || '0', 10) || 0;
  let s = parseInt(parts[1] || '0', 10) || 0;
  m = clamp(m, 0, 99);
  s = clamp(s, 0, 59);

  state.daily.paceMin = m;
  state.daily.paceSec = s;

  const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
  state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;

  updatePreview();
}

// =========================================================
// MONTH PICKER
// =========================================================
function openMonthPicker(){
  // 현재 ym을 select에 반영
  const mt = monthTexts(state.monthly.ym);
  state.monthly.ym = mt.ym;

  const [yy, mm] = mt.ym.split('-');
  if(els.mpYear) els.mpYear.value = String(yy);
  if(els.mpMonth) els.mpMonth.value = String(parseInt(mm,10));

  openScreen(els.screenMonthPicker);
}

function applyMonthPicker(){
  const y = parseInt(els.mpYear?.value || '0', 10);
  const m = parseInt(els.mpMonth?.value || '1', 10);
  if(!y || !m) return;

  const ym = `${y}-${String(m).padStart(2,'0')}`;
  state.monthly.ym = ym;
  updatePreview();
  closeScreen(els.screenMonthPicker);
}

// =========================================================
// EVENT BINDING
// =========================================================
function bind(){
  // record type
  els.btnDaily?.addEventListener('click', ()=> setRecord('daily'));
  els.btnMonthly?.addEventListener('click', ()=> setRecord('monthly'));

  // data tabs
  els.tabGarmin?.addEventListener('click', ()=> setDataType('garmin'));
  els.tabNrc?.addEventListener('click', ()=> setDataType('nrc'));
  els.tabManual?.addEventListener('click', ()=> setDataType('manual'));

  // font
  els.fontAnton?.addEventListener('click', ()=> setFont('anton'));
  els.fontDots?.addEventListener('click', ()=> setFont('dots'));
  els.fontLcd?.addEventListener('click', ()=> setFont('lcd'));
  els.fontGothic?.addEventListener('click', ()=> setFont('gothic'));
  els.fontSpeed?.addEventListener('click', ()=> setFont('speed'));

  // layout/bg
  els.btnType1?.addEventListener('click', ()=> setLayout('type1'));
  els.btnType2?.addEventListener('click', ()=> setLayout('type2'));
  els.btnBgWhite?.addEventListener('click', ()=> setBg('white'));
  els.btnBgBlack?.addEventListener('click', ()=> setBg('black'));

  // NRC upload
  els.btnUploadNrc?.addEventListener('click', ()=> els.fileNrc?.click());
  els.fileNrc?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    if(f) handleNrcFile(f);
    e.target.value = '';
  });

  // manual chip (prompt)
  els.chipDistance?.addEventListener('click', ()=>{
    // daily에서만 의미
    if(state.record !== 'daily') return;
    setDataType('manual');
    promptDistance();
  });
  els.chipPace?.addEventListener('click', ()=>{
    if(state.record !== 'daily') return;
    setDataType('manual');
    promptPace();
  });

  // month button -> month picker overlay
  els.btnMonth?.addEventListener('click', openMonthPicker);
  els.btnMonthApply?.addEventListener('click', applyMonthPicker);

  // RUN
  els.btnRun?.addEventListener('click', ()=>{
    if(state.record === 'daily' && !state.dataType) return; // data type 선택 전이면 실행 X
    runResultAnimation();
  });

  // overlay closes
  els.closeResult?.addEventListener('click', ()=> closeScreen(els.screenResult));
  els.closeGarminLogin?.addEventListener('click', ()=> closeScreen(els.screenGarminLogin));
  els.closeSelectWorkout?.addEventListener('click', ()=> closeScreen(els.screenSelectWorkout));
  els.closeMonthPicker?.addEventListener('click', ()=> closeScreen(els.screenMonthPicker));

  // garmin sign-in (UI only)
  els.btnGarminSignIn?.addEventListener('click', ()=>{
    closeScreen(els.screenGarminLogin);
    seedFakeWorkouts();
    openScreen(els.screenSelectWorkout);
  });

  // garmin reselect (main card list button)
  els.btnGarminList?.addEventListener('click', ()=>{
    seedFakeWorkouts();
    openScreen(els.screenSelectWorkout);
  });
}

// =========================================================
// INIT
// =========================================================
function init(){
  resetDailyToZero();
  resetMonthlyToZero();

  // default month
  state.monthly.ym = normalizeYM(state.monthly.ym);

  // 기본 UI (첫 화면: daily + datatype none)
  setRecord('daily');
  state.dataType = null;
  applyDataPanels();

  setFont(state.font);
  setLayout(state.layout);
  setBg(state.bg);

  updatePreview();
  setActiveToggles();
  setBodyData();

  bind();
}

init();
