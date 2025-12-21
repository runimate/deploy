/* =========================================================
  RUNIMATE v2.0 — script.js (현재 index.html 완전 호환)
  ✅ Preview 겹침 해결: pv-type1/pv-type2, mv-type1/mv-type2 JS로 강제 토글
  ✅ Garmin Select Workout 화면 깨짐 해결: .select-item 구조로 렌더
  ✅ body dataset(record/datatype/layout/bg/font) 항상 동기화
  ✅ Monthly 모드: NRC만 허용(garmin/manual 비활성)
  ✅ ocr.js: export async function extractAll(dataUrl, { recordType })
========================================================= */

const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

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

  // Garmin card (main)
  garminDate: byId('garminDate'),
  garminKm: byId('garminKm'),
  garminPace: byId('garminPace'),
  garminTime: byId('garminTime'),
  btnGarminList: byId('btnGarminList'),

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

  // month (monthly mode)
  monthBlock: byId('monthBlock'),
  btnMonth: byId('btnMonth'),

  // month picker overlay
  screenMonthPicker: byId('screenMonthPicker'),
  closeMonthPicker: byId('closeMonthPicker'),
  mpYear: byId('mpYear'),
  mpMonth: byId('mpMonth'),
  btnMonthApply: byId('btnMonthApply'),

  // font buttons
  fontAnton: byId('fontAnton'),
  fontDots: byId('fontDots'),
  fontLcd: byId('fontLcd'),
  fontGothic: byId('fontGothic'),
  fontSpeed: byId('fontSpeed'),

  // layout buttons
  btnType1: byId('btnType1'),
  btnType2: byId('btnType2'),

  // bg buttons
  btnBgWhite: byId('btnBgWhite'),
  btnBgBlack: byId('btnBgBlack'),

  // preview wrappers
  previewDailyWrap: byId('previewDaily'),
  previewMonthlyWrap: byId('previewMonthly'),

  // daily preview values
  pvDailyDistance: byId('pvDailyDistance'),
  pvDailyPace: byId('pvDailyPace'),
  pvDailyTime: byId('pvDailyTime'),
  pvDailyDistance2: byId('pvDailyDistance2'),
  pvDailyPace2: byId('pvDailyPace2'),
  pvDailyTime2: byId('pvDailyTime2'),

  // monthly preview values
  pvMonthTitle: byId('pvMonthTitle'),
  pvMonthLine: byId('pvMonthLine'),
  pvMonthlyDistance: byId('pvMonthlyDistance'),
  pvMonthlyRuns: byId('pvMonthlyRuns'),
  pvMonthlyPace: byId('pvMonthlyPace'),
  pvMonthlyTime: byId('pvMonthlyTime'),
  pvMonthlyDistance2: byId('pvMonthlyDistance2'),
  pvMonthlyRuns2: byId('pvMonthlyRuns2'),
  pvMonthlyPace2: byId('pvMonthlyPace2'),
  pvMonthlyTime2: byId('pvMonthlyTime2'),

  // RUN
  btnRun: byId('btnRun'),

  // overlays
  screenGarminLogin: byId('screenGarminLogin'),
  closeGarminLogin: byId('closeGarminLogin'),
  btnGarminSignIn: byId('btnGarminSignIn'),
  gcEmail: byId('gcEmail'),
  gcPw: byId('gcPw'),

  screenSelectWorkout: byId('screenSelectWorkout'),
  closeSelectWorkout: byId('closeSelectWorkout'),
  workoutList: byId('workoutList'),

  screenResult: byId('screenResult'),
  closeResult: byId('closeResult'),

  // result blocks
  resultDaily: byId('resultDaily'),
  resultMonthly: byId('resultMonthly'),

  // result fields
  rDailyDistance: byId('rDailyDistance'),
  rDailyPace: byId('rDailyPace'),
  rDailyTime: byId('rDailyTime'),
  rDailyDistance2: byId('rDailyDistance2'),
  rDailyPace2: byId('rDailyPace2'),
  rDailyTime2: byId('rDailyTime2'),

  rMonthTitle: byId('rMonthTitle'),
  rMonthLine: byId('rMonthLine'),
  rMonthlyDistance: byId('rMonthlyDistance'),
  rMonthlyRuns: byId('rMonthlyRuns'),
  rMonthlyPace: byId('rMonthlyPace'),
  rMonthlyTime: byId('rMonthlyTime'),
  rMonthlyDistance2: byId('rMonthlyDistance2'),
  rMonthlyRuns2: byId('rMonthlyRuns2'),
  rMonthlyPace2: byId('rMonthlyPace2'),
  rMonthlyTime2: byId('rMonthlyTime2'),
};

// ---------------- STATE ----------------
const state = {
  record: 'daily',          // daily | monthly
  dataType: null,           // null | garmin | nrc | manual
  layout: 'type1',          // type1 | type2
  bg: 'white',              // white | black
  font: 'dots',             // anton | dots | lcd | gothic | speed

  daily: { km: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
  monthly: { ym: null, km: 0, runs: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
};

// ---------------- OCR ----------------
let extractAllFn = null;
async function ensureOCR(){
  if(extractAllFn) return extractAllFn;
  const mod = await import('./ocr.js');
  if(typeof mod.extractAll !== 'function') throw new Error('ocr.js must export extractAll');
  extractAllFn = mod.extractAll;
  return extractAllFn;
}

// ---------------- UTIL ----------------
const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
const zero2 = (n)=> String(n).padStart(2,'0');
const fmtKm2 = (km)=> Number(km||0).toFixed(2);

function secondsToHMS(total){
  total = Math.max(0, Math.round(total||0));
  const h = Math.floor(total/3600);
  const m = Math.floor((total%3600)/60);
  const s = total%60;
  return { h,m,s };
}
function calcTimeFromKmPace(km, paceMin, paceSec){
  const pace = Math.max(0, (paceMin||0)*60 + (paceSec||0));
  const dist = Math.max(0, Number(km||0));
  if(!pace || !dist) return { h:0,m:0,s:0 };
  return secondsToHMS(dist * pace);
}

function displayPace(min, sec){
  const m = clamp(parseInt(min||0,10), 0, 99);
  const s = clamp(parseInt(sec||0,10), 0, 59);
  return `${zero2(m)}'${zero2(s)}"`;
}
function displayTime(h,m,s){
  const hh = clamp(parseInt(h||0,10), 0, 99);
  const mm = clamp(parseInt(m||0,10), 0, 59);
  const ss = clamp(parseInt(s||0,10), 0, 59);
  return `${zero2(hh)}:${zero2(mm)}:${zero2(ss)}`;
}
function displayRuns(runs){
  const v = Math.max(0, Math.round(Number(runs||0)));
  return String(v).padStart(2,'0');
}

function parseYM(ym){
  if(!ym) return null;
  const [y,m] = String(ym).split('-').map(n=>parseInt(n,10));
  if(!y || !m) return null;
  return { y, m };
}
function toYM(y,m){ return `${y}-${String(m).padStart(2,'0')}`; }

function monthNameUpper(m){
  const n = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return n[(m||1)-1] || 'JANUARY';
}
function monthNameTitle(m){
  const n = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return n[(m||1)-1] || 'January';
}

// ---------------- DATASET SYNC ----------------
function syncBodyDataset(){
  document.body.dataset.record = state.record;
  document.body.dataset.datatype = state.dataType || 'none';
  document.body.dataset.layout = state.layout;
  document.body.dataset.bg = state.bg;
  document.body.dataset.font = state.font;
}

// ---------------- SCREEN OPEN/CLOSE ----------------
function openScreen(screenEl){
  if(!screenEl) return;
  document.body.classList.add('no-scroll');
  screenEl.classList.add('show');
  screenEl.setAttribute('aria-hidden','false');
}
function closeScreen(screenEl){
  if(!screenEl) return;
  screenEl.classList.remove('show');
  screenEl.setAttribute('aria-hidden','true');
  const anyOpen = document.querySelector('.screen-overlay.show');
  if(!anyOpen) document.body.classList.remove('no-scroll');
}

// ---------------- UI: Record/DataType ----------------
function setRecord(next){
  state.record = next;

  els.btnDaily?.classList.toggle('active', next === 'daily');
  els.btnMonthly?.classList.toggle('active', next === 'monthly');

  // Monthly: NRC only
  if(next === 'monthly'){
    state.dataType = 'nrc';
    els.tabGarmin && (els.tabGarmin.disabled = true);
    els.tabManual && (els.tabManual.disabled = true);
    els.tabNrc && (els.tabNrc.disabled = false);
    els.monthBlock && (els.monthBlock.style.display = 'block');
  } else {
    els.tabGarmin && (els.tabGarmin.disabled = false);
    els.tabManual && (els.tabManual.disabled = false);
    els.monthBlock && (els.monthBlock.style.display = 'none');
  }

  applyDataPanels();
  updatePreview();
  syncBodyDataset();
}

function setDataType(next){
  if(state.record === 'monthly' && next !== 'nrc') return;
  state.dataType = next;
  applyDataPanels();
  updatePreview();
  syncBodyDataset();

  if(next === 'garmin'){
    openScreen(els.screenGarminLogin);
  }
}

function applyDataPanels(){
  const t = state.dataType;

  els.tabGarmin?.classList.toggle('active', t === 'garmin');
  els.tabNrc?.classList.toggle('active', t === 'nrc');
  els.tabManual?.classList.toggle('active', t === 'manual');

  const has = !!t;
  els.dataEmpty && (els.dataEmpty.style.display = has ? 'none' : 'block');

  els.contentGarmin && (els.contentGarmin.style.display = (t === 'garmin') ? 'block' : 'none');
  els.contentNrc && (els.contentNrc.style.display = (t === 'nrc') ? 'block' : 'none');
  els.contentManual && (els.contentManual.style.display = (t === 'manual') ? 'block' : 'none');
}

// ---------------- UI: Font/Layout/BG ----------------
function setFont(next){
  state.font = next;
  els.fontAnton?.classList.toggle('active', next==='anton');
  els.fontDots?.classList.toggle('active', next==='dots');
  els.fontLcd?.classList.toggle('active', next==='lcd');
  els.fontGothic?.classList.toggle('active', next==='gothic');
  els.fontSpeed?.classList.toggle('active', next==='speed');
  syncBodyDataset();
}
function setLayout(next){
  state.layout = next;
  els.btnType1?.classList.toggle('active', next==='type1');
  els.btnType2?.classList.toggle('active', next==='type2');
  updatePreview();
  syncBodyDataset();
}
function setBg(next){
  state.bg = next;
  els.btnBgWhite?.classList.toggle('active', next==='white');
  els.btnBgBlack?.classList.toggle('active', next==='black');
  syncBodyDataset();
}

// ---------------- Month UI ----------------
function ensureMonthDefault(){
  if(state.monthly.ym) return;
  const d = new Date();
  state.monthly.ym = toYM(d.getFullYear(), d.getMonth()+1);
}
function syncMonthUI(){
  ensureMonthDefault();
  const p = parseYM(state.monthly.ym);
  if(!p) return;

  els.btnMonth && (els.btnMonth.textContent = `${monthNameTitle(p.m)}, ${p.y}`);
  els.mpYear && (els.mpYear.value = String(p.y));
  els.mpMonth && (els.mpMonth.value = String(p.m));

  els.pvMonthTitle && (els.pvMonthTitle.innerHTML = `${monthNameUpper(p.m)}<br/>${p.y}`);
  els.pvMonthLine && (els.pvMonthLine.textContent = `${monthNameUpper(p.m)} ${p.y}`);
}
// ---------------- PREVIEW (겹침 방지 토글 핵심) ----------------
function forcePreviewVariant(){
  const isType1 = (state.layout === 'type1');

  // Daily preview: pv-type1 / pv-type2
  const d1 = $('#dailyPreview .pv-type1');
  const d2 = $('#dailyPreview .pv-type2');
  if(d1) d1.style.display = isType1 ? 'flex' : 'none';
  if(d2) d2.style.display = isType1 ? 'none' : 'flex';

  // Monthly preview: mv-type1 / mv-type2
  const m1 = $('#monthlyPreview .mv-type1');
  const m2 = $('#monthlyPreview .mv-type2');
  if(m1) m1.style.display = isType1 ? 'block' : 'none';
  if(m2) m2.style.display = isType1 ? 'none' : 'block';
}

function updatePreview(){
  forcePreviewVariant();

  if(state.record === 'daily'){
    els.previewDailyWrap && (els.previewDailyWrap.style.display = 'block');
    els.previewMonthlyWrap && (els.previewMonthlyWrap.style.display = 'none');

    const d = state.daily;
    const dist = `${fmtKm2(d.km)}Km`;
    const pace = displayPace(d.paceMin, d.paceSec);
    const time = displayTime(d.h, d.m, d.s);

    els.pvDailyDistance && (els.pvDailyDistance.textContent = dist);
    els.pvDailyPace && (els.pvDailyPace.textContent = pace);
    els.pvDailyTime && (els.pvDailyTime.textContent = time);

    els.pvDailyDistance2 && (els.pvDailyDistance2.textContent = dist);
    els.pvDailyPace2 && (els.pvDailyPace2.textContent = pace);
    els.pvDailyTime2 && (els.pvDailyTime2.textContent = time);

    if(state.dataType === 'manual'){
      els.manualKm && (els.manualKm.textContent = fmtKm2(d.km));
      els.manualPace && (els.manualPace.textContent = pace);
      els.manualTime && (els.manualTime.textContent = time);
    }
  } else {
    els.previewDailyWrap && (els.previewDailyWrap.style.display = 'none');
    els.previewMonthlyWrap && (els.previewMonthlyWrap.style.display = 'block');

    syncMonthUI();

    const m = state.monthly;
    const dist = `${fmtKm2(m.km)}Km`;
    const runs = displayRuns(m.runs);
    const pace = displayPace(m.paceMin, m.paceSec);
    const time = displayTime(m.h, m.m, m.s);

    els.pvMonthlyDistance && (els.pvMonthlyDistance.textContent = dist);
    els.pvMonthlyRuns && (els.pvMonthlyRuns.textContent = runs);
    els.pvMonthlyPace && (els.pvMonthlyPace.textContent = pace);
    els.pvMonthlyTime && (els.pvMonthlyTime.textContent = time);

    els.pvMonthlyDistance2 && (els.pvMonthlyDistance2.textContent = dist);
    els.pvMonthlyRuns2 && (els.pvMonthlyRuns2.textContent = runs);
    els.pvMonthlyPace2 && (els.pvMonthlyPace2.textContent = pace);
    els.pvMonthlyTime2 && (els.pvMonthlyTime2.textContent = time);
  }
}

// ---------------- ROLLING DIGITS (RESULT) ----------------
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

const rollers = new Map();
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
  return { template, digitSlots };
}
function ensureRoller(el, template){
  if(!el) return null;
  const prev = rollers.get(el);
  if(prev && prev.template === template) return prev;
  const r = buildRoll(el, template);
  rollers.set(el, r);
  return r;
}
function setRollString(roller, str){
  if(!roller) return;
  const digits = (str.match(/\d/g) || []);
  for(let i=0;i<roller.digitSlots.length;i++){
    const d = digits[i] ? parseInt(digits[i],10) : 0;
    roller.digitSlots[i].stack.style.transform = `translateY(${-d}em)`;
  }
}

function distTemplateByValue(km){ return (Number(km||0) >= 100) ? '000.00Km' : '00.00Km'; }
function fmtDistanceFixed(km, template){
  const intDigits = template.startsWith('000') ? 3 : 2;
  const v = Math.max(0, Number(km||0));
  const fixed = v.toFixed(2);
  const [iPart, dPart] = fixed.split('.');
  return `${iPart.padStart(intDigits,'0')}.${dPart}Km`;
}
function fmtPaceFixed(min, sec){
  return `${zero2(min)}'${zero2(sec)}"`;
}
function fmtTimeFixed(h,m,s){
  return `${zero2(h)}:${zero2(m)}:${zero2(s)}`;
}
function fmtRunsFixed(r){
  const v = Math.max(0, Math.round(Number(r||0)));
  return String(v).padStart(2,'0');
}

function setRollingDistance(elList, km){
  const tpl = distTemplateByValue(km);
  const str = fmtDistanceFixed(km, tpl);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str);
  }
}
function setRollingPace(elList, min, sec){
  const tpl = `00'00"`;
  const str = fmtPaceFixed(min, sec);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str);
  }
}
function setRollingTime(elList, h,m,s){
  const tpl = `00:00:00`;
  const str = fmtTimeFixed(h,m,s);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str);
  }
}
function setRollingRuns(elList, runs){
  const tpl = `00`;
  const str = fmtRunsFixed(runs);
  for(const el of elList){
    const r = ensureRoller(el, tpl);
    setRollString(r, str);
  }
}

// ---------------- RESULT OVERLAY (레이아웃/레코드 토글) ----------------
function forceResultVariant(){
  const isMonthly = (state.record === 'monthly');
  const isType1 = (state.layout === 'type1');

  els.resultDaily && (els.resultDaily.style.display = isMonthly ? 'none' : 'block');
  els.resultMonthly && (els.resultMonthly.style.display = isMonthly ? 'block' : 'none');

  const d1 = $('#resultDaily .r-type1');
  const d2 = $('#resultDaily .r-type2');
  if(d1) d1.style.display = isType1 ? 'grid' : 'none';
  if(d2) d2.style.display = isType1 ? 'none' : 'grid';

  const m1 = $('#resultMonthly .r-mtype1');
  const m2 = $('#resultMonthly .r-mtype2');
  if(m1) m1.style.display = isType1 ? 'block' : 'none';
  if(m2) m2.style.display = isType1 ? 'none' : 'block';
}

async function runResultAnimation(){
  if(!els.screenResult) return;

  forceResultVariant();
  openScreen(els.screenResult);

  await new Promise(r=>setTimeout(r, 500));

  if(state.record === 'daily'){
    const d = state.daily;
    const targetKm = Number(d.km||0);
    const targetPaceSec = Math.max(0, d.paceMin*60 + d.paceSec);
    const targetTimeSec = Math.max(0, d.h*3600 + d.m*60 + d.s);

    // init 0
    setRollingDistance([els.rDailyDistance, els.rDailyDistance2], 0);
    setRollingPace([els.rDailyPace, els.rDailyPace2], 0, 0);
    setRollingTime([els.rDailyTime, els.rDailyTime2], 0, 0, 0);

    await Promise.all([
      animateNumber({ from:0, to:targetKm, duration:900, onUpdate:(v)=> setRollingDistance([els.rDailyDistance, els.rDailyDistance2], v) }),
      animateNumber({ from:0, to:targetPaceSec, duration:900, onUpdate:(v)=>{
        const vv = Math.max(0, Math.floor(v));
        setRollingPace([els.rDailyPace, els.rDailyPace2], Math.floor(vv/60), vv%60);
      }}),
      animateNumber({ from:0, to:targetTimeSec, duration:900, onUpdate:(v)=>{
        const vv = Math.max(0, Math.floor(v));
        const h = Math.floor(vv/3600);
        const m = Math.floor((vv%3600)/60);
        const s = vv%60;
        setRollingTime([els.rDailyTime, els.rDailyTime2], h,m,s);
      }}),
    ]);
  } else {
    syncMonthUI();
    const p = parseYM(state.monthly.ym);
    if(p){
      els.rMonthTitle && (els.rMonthTitle.innerHTML = `${monthNameUpper(p.m)}<br/>${p.y}`);
      els.rMonthLine && (els.rMonthLine.textContent = `${monthNameUpper(p.m)} ${p.y}`);
    }

    const m = state.monthly;
    const targetKm = Number(m.km||0);
    const targetRuns = Number(m.runs||0);
    const targetPaceSec = Math.max(0, m.paceMin*60 + m.paceSec);
    const targetTimeSec = Math.max(0, m.h*3600 + m.m*60 + m.s);

    // init 0
    setRollingDistance([els.rMonthlyDistance, els.rMonthlyDistance2], 0);
    setRollingRuns([els.rMonthlyRuns, els.rMonthlyRuns2], 0);
    setRollingPace([els.rMonthlyPace, els.rMonthlyPace2], 0, 0);
    setRollingTime([els.rMonthlyTime, els.rMonthlyTime2], 0, 0, 0);

    await Promise.all([
      animateNumber({ from:0, to:targetKm, duration:900, onUpdate:(v)=> setRollingDistance([els.rMonthlyDistance, els.rMonthlyDistance2], v) }),
      animateNumber({ from:0, to:targetRuns, duration:900, onUpdate:(v)=> setRollingRuns([els.rMonthlyRuns, els.rMonthlyRuns2], v) }),
      animateNumber({ from:0, to:targetPaceSec, duration:900, onUpdate:(v)=>{
        const vv = Math.max(0, Math.floor(v));
        setRollingPace([els.rMonthlyPace, els.rMonthlyPace2], Math.floor(vv/60), vv%60);
      }}),
      animateNumber({ from:0, to:targetTimeSec, duration:900, onUpdate:(v)=>{
        const vv = Math.max(0, Math.floor(v));
        const h = Math.floor(vv/3600);
        const mm = Math.floor((vv%3600)/60);
        const s = vv%60;
        setRollingTime([els.rMonthlyTime, els.rMonthlyTime2], h,mm,s);
      }}),
    ]);
  }
}

// ---------------- NRC OCR ----------------
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

  els.ocrStatus && (els.ocrStatus.textContent = 'OCR reading...');
  els.ocrStatus && (els.ocrStatus.classList.add('show'));

  try{
    const url = await fileToDataURL(file);
    const extractAll = await ensureOCR();
    const out = await extractAll(url, { recordType: state.record });

    if(state.record === 'daily'){
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
    els.ocrStatus && (els.ocrStatus.textContent = 'OCR done ✓');
    setTimeout(()=> els.ocrStatus && els.ocrStatus.classList.remove('show'), 1200);
  } catch(err){
    console.error(err);
    els.ocrStatus && (els.ocrStatus.textContent = 'OCR failed');
    setTimeout(()=> els.ocrStatus && els.ocrStatus.classList.remove('show'), 1500);
  }
}

// ---------------- Garmin Select Workout (CSS 구조 맞춤) ----------------
function seedFakeWorkouts(){
  if(!els.workoutList) return;
  els.workoutList.innerHTML = '';

  // 데모 데이터
  const rows = Array.from({length: 12}).map((_,i)=>({
    date: '2025.12.12',
    km: 14.64,
    paceMin: 5, paceSec: 59,
    h: 1, m: 27, s: 32,
    active: i===0
  }));

  for(const r of rows){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'select-item' + (r.active ? ' active' : '');

    // 1) date line
    const date = document.createElement('div');
    date.className = 'select-date';
    date.textContent = r.date;

    // 2) metrics line
    const metrics = document.createElement('div');
    metrics.className = 'select-metrics';
    metrics.textContent = `${fmtKm2(r.km)}Km  ${displayPace(r.paceMin,r.paceSec)}  ${displayTime(r.h,r.m,r.s)}`;

    // 3) arrow line
    const arrow = document.createElement('div');
    arrow.className = 'select-arrow';
    arrow.textContent = '→';

    btn.appendChild(date);
    btn.appendChild(metrics);
    btn.appendChild(arrow);

    btn.addEventListener('click', ()=>{
      // apply to state
      state.dataType = 'garmin';
      state.daily.km = r.km;
      state.daily.paceMin = r.paceMin;
      state.daily.paceSec = r.paceSec;
      state.daily.h = r.h;
      state.daily.m = r.m;
      state.daily.s = r.s;

      // update Garmin card
      els.garminDate && (els.garminDate.textContent = r.date);
      els.garminKm && (els.garminKm.textContent = `${fmtKm2(r.km)}Km`);
      els.garminPace && (els.garminPace.textContent = `${r.paceMin}'${zero2(r.paceSec)}"`); // card는 원래 포맷
      els.garminTime && (els.garminTime.textContent = `${r.h}:${zero2(r.m)}:${zero2(r.s)}`);

      applyDataPanels();
      updatePreview();
      syncBodyDataset();
      closeScreen(els.screenSelectWorkout);
    });

    els.workoutList.appendChild(btn);
  }
}

// ---------------- Manual 입력 (prompt) ----------------
function promptDistance(){
  const v = prompt('Distance (Km) — 예: 14.64', fmtKm2(state.daily.km));
  if(v === null) return;
  const km = Number(String(v).trim().replace(',','.'));
  state.daily.km = isFinite(km) ? km : 0;

  const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
  state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;

  updatePreview();
}
function promptPace(){
  const cur = `${state.daily.paceMin}:${zero2(state.daily.paceSec)}`;
  const v = prompt('Pace (mm:ss /Km) — 예: 5:59', cur);
  if(v === null) return;

  const m = String(v).trim().match(/^(\d{1,2})\s*[:' ]\s*(\d{1,2})/);
  const mm = m ? parseInt(m[1],10) : 0;
  const ss = m ? parseInt(m[2],10) : 0;

  state.daily.paceMin = clamp(mm,0,99);
  state.daily.paceSec = clamp(ss,0,59);

  const t = calcTimeFromKmPace(state.daily.km, state.daily.paceMin, state.daily.paceSec);
  state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;

  updatePreview();
}

// ---------------- EVENTS ----------------
function bind(){
  // record
  els.btnDaily?.addEventListener('click', ()=> setRecord('daily'));
  els.btnMonthly?.addEventListener('click', ()=> setRecord('monthly'));

  // datatype
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

  // nrc upload
  els.btnUploadNrc?.addEventListener('click', ()=> els.fileNrc?.click());
  els.fileNrc?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    if(f) handleNrcFile(f);
    e.target.value = '';
  });

  // manual
  els.chipDistance?.addEventListener('click', promptDistance);
  els.chipPace?.addEventListener('click', promptPace);

  // month picker
  els.btnMonth?.addEventListener('click', ()=>{
    syncMonthUI();
    openScreen(els.screenMonthPicker);
  });
  els.closeMonthPicker?.addEventListener('click', ()=> closeScreen(els.screenMonthPicker));
  els.btnMonthApply?.addEventListener('click', ()=>{
    const y = parseInt(els.mpYear?.value || '2025', 10) || 2025;
    const m = parseInt(els.mpMonth?.value || '12', 10) || 12;
    state.monthly.ym = toYM(y,m);
    closeScreen(els.screenMonthPicker);
    updatePreview();
  });

  // overlays close
  els.closeGarminLogin?.addEventListener('click', ()=> closeScreen(els.screenGarminLogin));
  els.closeSelectWorkout?.addEventListener('click', ()=> closeScreen(els.screenSelectWorkout));
  els.closeResult?.addEventListener('click', ()=> closeScreen(els.screenResult));

  // garmin sign in (demo)
  els.btnGarminSignIn?.addEventListener('click', ()=>{
    closeScreen(els.screenGarminLogin);
    seedFakeWorkouts();
    openScreen(els.screenSelectWorkout);
  });
  els.btnGarminList?.addEventListener('click', ()=>{
    seedFakeWorkouts();
    openScreen(els.screenSelectWorkout);
  });

  // RUN
  els.btnRun?.addEventListener('click', ()=>{
    if(state.record === 'daily' && !state.dataType) return;
    runResultAnimation();
  });
}

// ---------------- INIT ----------------
function init(){
  // body dataset 기준으로 state 초기화
  const ds = document.body.dataset;
  state.record = ds.record || 'daily';
  state.dataType = (ds.datatype && ds.datatype !== 'none') ? ds.datatype : null;
  state.layout = ds.layout || 'type1';
  state.bg = ds.bg || 'white';
  state.font = ds.font || 'dots';

  ensureMonthDefault();
  syncMonthUI();

  // UI active 반영
  setLayout(state.layout);
  setBg(state.bg);
  setFont(state.font);

  // record 적용 (monthly면 NRC 강제)
  setRecord(state.record);

  // datatype 적용
  if(state.dataType) setDataType(state.dataType);
  else applyDataPanels();

  updatePreview();
  syncBodyDataset();
  bind();
}

init();
