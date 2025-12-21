import { extractAll } from './js/ocr.js';

/***********************
 * STATE
 ***********************/
const state = {
  record: 'daily',         // daily | monthly
  datatype: 'none',        // none | garmin | nrc | manual
  layout: 'type1',         // type1 | type2
  bg: 'white',             // white | black
  font: 'dots',            // anton | dots | lcd | gothic | speed
  daily: { km: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
  monthly: { year: 2025, month: 12, km: 0, runs: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 }
};

/***********************
 * DOM
 ***********************/
const $ = (id)=>document.getElementById(id);

const els = {
  btnDaily: $('btnDaily'),
  btnMonthly: $('btnMonthly'),
  tabGarmin: $('tabGarmin'),
  tabNrc: $('tabNrc'),
  tabManual: $('tabManual'),

  btnType1: $('btnType1'),
  btnType2: $('btnType2'),
  btnBgWhite: $('btnBgWhite'),
  btnBgBlack: $('btnBgBlack'),

  fontAnton: $('fontAnton'),
  fontDots: $('fontDots'),
  fontLcd: $('fontLcd'),
  fontGothic: $('fontGothic'),
  fontSpeed: $('fontSpeed'),

  dataEmpty: $('dataEmpty'),
  contentGarmin: $('contentGarmin'),
  contentNrc: $('contentNrc'),
  contentManual: $('contentManual'),
  monthBlock: $('monthBlock'),

  btnMonth: $('btnMonth'),
  screenMonthPicker: $('screenMonthPicker'),
  closeMonthPicker: $('closeMonthPicker'),
  mpYear: $('mpYear'),
  mpMonth: $('mpMonth'),
  btnMonthApply: $('btnMonthApply'),

  btnUploadNrc: $('btnUploadNrc'),
  fileNrc: $('fileNrc'),
  ocrStatus: $('ocrStatus'),

  screenGarminLogin: $('screenGarminLogin'),
  closeGarminLogin: $('closeGarminLogin'),
  btnGarminSignIn: $('btnGarminSignIn'),

  screenSelectWorkout: $('screenSelectWorkout'),
  closeSelectWorkout: $('closeSelectWorkout'),
  btnGarminList: $('btnGarminList'),
  workoutList: $('workoutList'),

  btnRun: $('btnRun'),
  screenResult: $('screenResult'),
  closeResult: $('closeResult'),
  resultWrap: $('resultWrap'),

  // preview daily
  pvDailyDistance: $('pvDailyDistance'),
  pvDailyPace: $('pvDailyPace'),
  pvDailyTime: $('pvDailyTime'),
  pvDailyDistance2: $('pvDailyDistance2'),
  pvDailyPace2: $('pvDailyPace2'),
  pvDailyTime2: $('pvDailyTime2'),

  // preview monthly
  pvMonthTitle: $('pvMonthTitle'),
  pvMonthLine: $('pvMonthLine'),
  pvMonthlyDistance: $('pvMonthlyDistance'),
  pvMonthlyRuns: $('pvMonthlyRuns'),
  pvMonthlyPace: $('pvMonthlyPace'),
  pvMonthlyTime: $('pvMonthlyTime'),
  pvMonthlyDistance2: $('pvMonthlyDistance2'),
  pvMonthlyRuns2: $('pvMonthlyRuns2'),
  pvMonthlyPace2: $('pvMonthlyPace2'),
  pvMonthlyTime2: $('pvMonthlyTime2'),

  dailyPreview: $('dailyPreview'),
  monthlyPreview: $('monthlyPreview'),

  // result daily
  rDailyDistance: $('rDailyDistance'),
  rDailyPace: $('rDailyPace'),
  rDailyTime: $('rDailyTime'),
  rDailyDistance2: $('rDailyDistance2'),
  rDailyPace2: $('rDailyPace2'),
  rDailyTime2: $('rDailyTime2'),

  // result monthly
  rMonthTitle: $('rMonthTitle'),
  rMonthLine: $('rMonthLine'),
  rMonthlyDistance: $('rMonthlyDistance'),
  rMonthlyRuns: $('rMonthlyRuns'),
  rMonthlyPace: $('rMonthlyPace'),
  rMonthlyTime: $('rMonthlyTime'),
  rMonthlyDistance2: $('rMonthlyDistance2'),
  rMonthlyRuns2: $('rMonthlyRuns2'),
  rMonthlyPace2: $('rMonthlyPace2'),
  rMonthlyTime2: $('rMonthlyTime2'),
};

/***********************
 * HELPERS / FORMATTERS
 ***********************/
const pad2 = (n)=>String(n).padStart(2,'0');

function monthName(m){
  const names = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return names[(m-1)||0];
}

// ✅ "05'59\"" -> "5'59\"" (단, 0이면 "00")
function fmtPace(min, sec){
  const mm = (min === 0) ? '00' : String(min);
  return mm + "'" + pad2(sec) + '"';
}

// ✅ 기본 00:00:00 유지, 1시간 이상이면 1:27:32
function fmtTime(h,m,s){
  if (h===0 && m===0 && s===0) return '00:00:00';
  if (h>0) return String(h) + ':' + pad2(m) + ':' + pad2(s);
  return pad2(m) + ':' + pad2(s);
}

function fmtKm(km){
  return (Number(km || 0).toFixed(2)) + 'Km';
}

function setActive(el, on){ el.classList.toggle('active', !!on); }

function applyBody(){
  document.body.dataset.record = state.record;
  document.body.dataset.datatype = state.datatype;
  document.body.dataset.layout = state.layout;
  document.body.dataset.bg = state.bg;
  document.body.dataset.font = state.font;
}

function syncButtons(){
  setActive(els.btnDaily, state.record==='daily');
  setActive(els.btnMonthly, state.record==='monthly');

  setActive(els.tabGarmin, state.datatype==='garmin');
  setActive(els.tabNrc, state.datatype==='nrc');
  setActive(els.tabManual, state.datatype==='manual');

  setActive(els.btnType1, state.layout==='type1');
  setActive(els.btnType2, state.layout==='type2');
  setActive(els.btnBgWhite, state.bg==='white');
  setActive(els.btnBgBlack, state.bg==='black');

  setActive(els.fontAnton, state.font==='anton');
  setActive(els.fontDots, state.font==='dots');
  setActive(els.fontLcd, state.font==='lcd');
  setActive(els.fontGothic, state.font==='gothic');
  setActive(els.fontSpeed, state.font==='speed');
}

function syncDataPanel(){
  // monthly에서는 month 선택 버튼 보이기
  els.monthBlock.style.display = (state.record==='monthly') ? 'block' : 'none';

  // monthly는 NRC만 유효(미선택 none은 유지 가능)
  if(state.record==='monthly'){
    if(state.datatype!=='none') state.datatype = 'nrc';
  }

  const none = (state.datatype==='none');
  els.dataEmpty.style.display = none ? 'block' : 'none';
  els.contentGarmin.style.display = (!none && state.datatype==='garmin') ? 'block' : 'none';
  els.contentNrc.style.display = (!none && state.datatype==='nrc') ? 'block' : 'none';
  els.contentManual.style.display = (!none && state.datatype==='manual') ? 'block' : 'none';
}

function syncPreview(){
  // daily
  const d = state.daily;
  const dKm = fmtKm(d.km);
  const dPace = fmtPace(d.paceMin, d.paceSec);
  const dTime = fmtTime(d.h, d.m, d.s);

  els.pvDailyDistance.textContent = dKm;
  els.pvDailyPace.textContent = dPace;
  els.pvDailyTime.textContent = dTime;

  els.pvDailyDistance2.textContent = dKm;
  els.pvDailyPace2.textContent = dPace;
  els.pvDailyTime2.textContent = dTime;

  // monthly
  const mo = state.monthly;
  const mName = monthName(mo.month);

  els.pvMonthTitle.innerHTML = mName + '<br/>' + mo.year;
  els.pvMonthLine.textContent = mName + ' ' + mo.year;

  els.pvMonthlyDistance.textContent = fmtKm(mo.km);
  els.pvMonthlyRuns.textContent = String(mo.runs).padStart(2,'0');
  els.pvMonthlyPace.textContent = fmtPace(mo.paceMin, mo.paceSec);
  els.pvMonthlyTime.textContent = fmtTime(mo.h, mo.m, mo.s);

  els.pvMonthlyDistance2.textContent = fmtKm(mo.km);
  els.pvMonthlyRuns2.textContent = String(mo.runs).padStart(2,'0');
  els.pvMonthlyPace2.textContent = fmtPace(mo.paceMin, mo.paceSec);
  els.pvMonthlyTime2.textContent = fmtTime(mo.h, mo.m, mo.s);

  // month button label
  const cap = mName.charAt(0) + mName.slice(1).toLowerCase();
  els.btnMonth.textContent = cap + ', ' + mo.year;

  // preview class
  els.dailyPreview.className = `preview ${state.layout} bg-${state.bg} font-${state.font}`;
  els.monthlyPreview.className = `preview monthly ${state.layout} bg-${state.bg} font-${state.font}`;
}
function showOverlay(el){
  document.body.classList.add('no-scroll');
  el.classList.add('show');
  el.setAttribute('aria-hidden','false');
}
function hideOverlay(el){
  el.classList.remove('show');
  el.setAttribute('aria-hidden','true');
  document.body.classList.remove('no-scroll');
}

/***********************
 * RESULT TEXT APPLY
 ***********************/
function syncResultTexts(){
  // daily
  const d = state.daily;
  els.rDailyDistance.textContent = fmtKm(d.km);
  els.rDailyPace.textContent = fmtPace(d.paceMin, d.paceSec);
  els.rDailyTime.textContent = fmtTime(d.h, d.m, d.s);

  els.rDailyDistance2.textContent = fmtKm(d.km);
  els.rDailyPace2.textContent = fmtPace(d.paceMin, d.paceSec);
  els.rDailyTime2.textContent = fmtTime(d.h, d.m, d.s);

  // monthly
  const mo = state.monthly;
  const mName = monthName(mo.month);
  els.rMonthTitle.innerHTML = mName + '<br/>' + mo.year;
  els.rMonthLine.textContent = mName + ' ' + mo.year;

  els.rMonthlyDistance.textContent = fmtKm(mo.km);
  els.rMonthlyRuns.textContent = String(mo.runs).padStart(2,'0');
  els.rMonthlyPace.textContent = fmtPace(mo.paceMin, mo.paceSec);
  els.rMonthlyTime.textContent = fmtTime(mo.h, mo.m, mo.s);

  els.rMonthlyDistance2.textContent = fmtKm(mo.km);
  els.rMonthlyRuns2.textContent = String(mo.runs).padStart(2,'0');
  els.rMonthlyPace2.textContent = fmtPace(mo.paceMin, mo.paceSec);
  els.rMonthlyTime2.textContent = fmtTime(mo.h, mo.m, mo.s);

  // result overlay classes
  els.screenResult.className = `screen-overlay result-screen bg-${state.bg} font-${state.font}`;

  // wrapper classes
  els.resultWrap.className = `result-wrap ${state.layout} ${state.record}`;
}

/***********************
 * RUN ANIMATION
 * - 0.5초 대기
 * - distance/pace/time 동시 animate
 ***********************/
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

function toSecFromTime(h,m,s){ return (h*3600 + m*60 + s); }
function toSecFromPace(min,sec){ return (min*60 + sec); }

function secToPaceText(totalSec){
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return fmtPace(m, s);
}
function secToTimeText(totalSec){
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return fmtTime(h,m,s);
}

function animateNumber({ duration=900, onUpdate, from=0, to=1 }){
  return new Promise((resolve)=>{
    const start = performance.now();
    const tick = (now)=>{
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * easeOutCubic(t);
      onUpdate(v, t);
      if(t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

async function runResultAnimation(){
  // 현재 record/layout에 상관없이 "보이는 곳"만 0으로 초기화해도 되지만
  // 깔끔하게 1/2 모두 업데이트
  const isMonthly = (state.record === 'monthly');

  if(!isMonthly){
    const d = state.daily;
    const targetKm = d.km;
    const targetPaceSec = toSecFromPace(d.paceMin, d.paceSec);
    const targetTimeSec = toSecFromTime(d.h, d.m, d.s);

    // 초기값 0
    els.rDailyDistance.textContent = fmtKm(0);
    els.rDailyDistance2.textContent = fmtKm(0);
    els.rDailyPace.textContent = `00'00"`;
    els.rDailyPace2.textContent = `00'00"`;
    els.rDailyTime.textContent = `00:00:00`;
    els.rDailyTime2.textContent = `00:00:00`;

    // 0.5초 대기
    await new Promise(r=>setTimeout(r, 500));

    // 동시 애니메이션
    await Promise.all([
      animateNumber({
        from: 0, to: targetKm, duration: 900,
        onUpdate: (v)=>{
          const t = fmtKm(v);
          els.rDailyDistance.textContent = t;
          els.rDailyDistance2.textContent = t;
        }
      }),
      animateNumber({
        from: 0, to: targetPaceSec, duration: 900,
        onUpdate: (v)=>{
          const t = secToPaceText(v);
          els.rDailyPace.textContent = t;
          els.rDailyPace2.textContent = t;
        }
      }),
      animateNumber({
        from: 0, to: targetTimeSec, duration: 900,
        onUpdate: (v)=>{
          const t = secToTimeText(v);
          els.rDailyTime.textContent = t;
          els.rDailyTime2.textContent = t;
        }
      })
    ]);
  } else {
    const mo = state.monthly;
    const targetKm = mo.km;
    const targetRuns = mo.runs;
    const targetPaceSec = toSecFromPace(mo.paceMin, mo.paceSec);
    const targetTimeSec = toSecFromTime(mo.h, mo.m, mo.s);

    // 초기값 0
    els.rMonthlyDistance.textContent = fmtKm(0);
    els.rMonthlyDistance2.textContent = fmtKm(0);
    els.rMonthlyRuns.textContent = '00';
    els.rMonthlyRuns2.textContent = '00';
    els.rMonthlyPace.textContent = `00'00"`;
    els.rMonthlyPace2.textContent = `00'00"`;
    els.rMonthlyTime.textContent = `00:00:00`;
    els.rMonthlyTime2.textContent = `00:00:00`;

    await new Promise(r=>setTimeout(r, 500));

    await Promise.all([
      animateNumber({
        from: 0, to: targetKm, duration: 900,
        onUpdate: (v)=>{
          const t = fmtKm(v);
          els.rMonthlyDistance.textContent = t;
          els.rMonthlyDistance2.textContent = t;
        }
      }),
      animateNumber({
        from: 0, to: targetRuns, duration: 900,
        onUpdate: (v)=>{
          const t = String(Math.round(v)).padStart(2,'0');
          els.rMonthlyRuns.textContent = t;
          els.rMonthlyRuns2.textContent = t;
        }
      }),
      animateNumber({
        from: 0, to: targetPaceSec, duration: 900,
        onUpdate: (v)=>{
          const t = secToPaceText(v);
          els.rMonthlyPace.textContent = t;
          els.rMonthlyPace2.textContent = t;
        }
      }),
      animateNumber({
        from: 0, to: targetTimeSec, duration: 900,
        onUpdate: (v)=>{
          const t = secToTimeText(v);
          els.rMonthlyTime.textContent = t;
          els.rMonthlyTime2.textContent = t;
        }
      })
    ]);
  }
}

/***********************
 * OCR: NRC UPLOAD -> extractAll 연결
 * - daily: state.daily 채우기
 * - monthly: state.monthly 채우기(월/연도는 유지)
 ***********************/
function setOcrStatus(msg, isError=false){
  els.ocrStatus.classList.add('show');
  els.ocrStatus.textContent = msg;
  els.ocrStatus.style.color = isError ? '#b00020' : '#333';
}

async function handleNrcFile(file){
  if(!file) return;

  // datatype을 nrc로 맞춤
  state.datatype = 'nrc';
  applyBody(); syncButtons(); syncDataPanel();

  setOcrStatus('OCR: processing...', false);

  const dataURL = await fileToDataURL(file);

  try{
    const recordType = state.record; // daily | monthly
    const out = await extractAll(dataURL, { recordType });

    // out: { km, runs, paceMin, paceSec, timeH, timeM, timeS }
    if(recordType === 'daily'){
      state.daily.km = Number(out.km || 0);
      state.daily.paceMin = Number(out.paceMin || 0);
      state.daily.paceSec = Number(out.paceSec || 0);
      state.daily.h = Number(out.timeH || 0);
      state.daily.m = Number(out.timeM || 0);
      state.daily.s = Number(out.timeS || 0);

      syncPreview();
      setOcrStatus(`OCR: OK (Daily) — ${fmtKm(state.daily.km)} / ${fmtPace(state.daily.paceMin, state.daily.paceSec)} / ${fmtTime(state.daily.h, state.daily.m, state.daily.s)}`);
    } else {
      // monthly: year/month은 유지하고 값만 채움
      state.monthly.km = Number(out.km || 0);
      state.monthly.runs = Number(out.runs || 0);
      state.monthly.paceMin = Number(out.paceMin || 0);
      state.monthly.paceSec = Number(out.paceSec || 0);
      state.monthly.h = Number(out.timeH || 0);
      state.monthly.m = Number(out.timeM || 0);
      state.monthly.s = Number(out.timeS || 0);

      syncPreview();
      setOcrStatus(`OCR: OK (Monthly) — ${fmtKm(state.monthly.km)} / RUNS ${String(state.monthly.runs).padStart(2,'0')} / ${fmtPace(state.monthly.paceMin, state.monthly.paceSec)} / ${fmtTime(state.monthly.h, state.monthly.m, state.monthly.s)}`);
    }
  }catch(e){
    console.error(e);
    setOcrStatus('OCR: failed (try another image / brighter / less blur)', true);
  }
}

function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/***********************
 * DUMMY WORKOUT LIST
 ***********************/
function buildDummyWorkouts(){
  els.workoutList.innerHTML = '';
  const items = new Array(9).fill(0).map((_,i)=>({
    date:'2025.12.12',
    km:'14.64Km',
    pace:`5'59"`,
    time:`1:27:32`,
    active: i===1
  }));

  items.forEach((it)=>{
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'workout-card' + (it.active ? ' active' : '');
    card.innerHTML = `
      <div class="wk-left">
        <div class="wk-date">${it.date}</div>
        <div class="wk-stats">
          <div class="wk-stat">${it.km}</div>
          <div class="wk-stat">${it.pace}</div>
          <div class="wk-stat">${it.time}</div>
        </div>
      </div>
      <div class="wk-arrow">→</div>
    `;
    card.addEventListener('click', ()=>{
      state.datatype = 'garmin';
      state.daily.km = 14.64;
      state.daily.paceMin = 5;
      state.daily.paceSec = 59;
      state.daily.h = 1; state.daily.m = 27; state.daily.s = 32;

      applyBody(); syncButtons(); syncDataPanel(); syncPreview();
      hideOverlay(els.screenSelectWorkout);
    });
    els.workoutList.appendChild(card);
  });
}

/***********************
 * EVENTS
 ***********************/
els.btnDaily.addEventListener('click', ()=>{
  state.record = 'daily';
  applyBody(); syncButtons(); syncDataPanel(); syncPreview();
});

els.btnMonthly.addEventListener('click', ()=>{
  state.record = 'monthly';
  // monthly는 nrc 권장. 단, none이면 유지 가능.
  if(state.datatype !== 'none') state.datatype = 'nrc';
  applyBody(); syncButtons(); syncDataPanel(); syncPreview();
});

els.tabGarmin.addEventListener('click', ()=>{
  if(state.record==='monthly') return;
  state.datatype = 'garmin';
  applyBody(); syncButtons(); syncDataPanel(); syncPreview();
  showOverlay(els.screenGarminLogin);
});

els.tabNrc.addEventListener('click', ()=>{
  state.datatype = 'nrc';
  applyBody(); syncButtons(); syncDataPanel(); syncPreview();
});

els.tabManual.addEventListener('click', ()=>{
  if(state.record==='monthly') return;
  state.datatype = 'manual';
  applyBody(); syncButtons(); syncDataPanel(); syncPreview();
});

// layout/bg/font
els.btnType1.addEventListener('click', ()=>{ state.layout='type1'; applyBody(); syncButtons(); syncPreview(); });
els.btnType2.addEventListener('click', ()=>{ state.layout='type2'; applyBody(); syncButtons(); syncPreview(); });
els.btnBgWhite.addEventListener('click', ()=>{ state.bg='white'; applyBody(); syncButtons(); syncPreview(); });
els.btnBgBlack.addEventListener('click', ()=>{ state.bg='black'; applyBody(); syncButtons(); syncPreview(); });

els.fontAnton.addEventListener('click', ()=>{ state.font='anton'; applyBody(); syncButtons(); syncPreview(); });
els.fontDots.addEventListener('click',  ()=>{ state.font='dots';  applyBody(); syncButtons(); syncPreview(); });
els.fontLcd.addEventListener('click',   ()=>{ state.font='lcd';   applyBody(); syncButtons(); syncPreview(); });
els.fontGothic.addEventListener('click',()=>{ state.font='gothic';applyBody(); syncButtons(); syncPreview(); });
els.fontSpeed.addEventListener('click', ()=>{ state.font='speed'; applyBody(); syncButtons(); syncPreview(); });

// Garmin overlays
els.closeGarminLogin.addEventListener('click', ()=> hideOverlay(els.screenGarminLogin));
els.btnGarminSignIn.addEventListener('click', ()=>{
  hideOverlay(els.screenGarminLogin);
  buildDummyWorkouts();
  showOverlay(els.screenSelectWorkout);
});
els.closeSelectWorkout.addEventListener('click', ()=> hideOverlay(els.screenSelectWorkout));
els.btnGarminList.addEventListener('click', (e)=>{
  e.stopPropagation();
  buildDummyWorkouts();
  showOverlay(els.screenSelectWorkout);
});

// Month picker
els.btnMonth.addEventListener('click', ()=> showOverlay(els.screenMonthPicker));
els.closeMonthPicker.addEventListener('click', ()=> hideOverlay(els.screenMonthPicker));
els.btnMonthApply.addEventListener('click', ()=>{
  state.monthly.year = parseInt(els.mpYear.value,10);
  state.monthly.month = parseInt(els.mpMonth.value,10);
  hideOverlay(els.screenMonthPicker);
  syncPreview();
});

// NRC upload -> OCR
els.btnUploadNrc.addEventListener('click', ()=> els.fileNrc.click());
els.fileNrc.addEventListener('change', async ()=>{
  const f = els.fileNrc.files && els.fileNrc.files[0];
  await handleNrcFile(f);
  // 같은 파일 재선택 가능하게 reset
  els.fileNrc.value = '';
});

// RUN -> Result + animation
els.btnRun.addEventListener('click', async ()=>{
  syncResultTexts();
  showOverlay(els.screenResult);
  await runResultAnimation();
});
els.closeResult.addEventListener('click', ()=> hideOverlay(els.screenResult));

/***********************
 * INIT
 ***********************/
function init(){
  state.datatype = 'none';
  applyBody();
  syncButtons();
  syncDataPanel();
  syncPreview();

  // 초기 active 표시
  setActive(els.btnDaily, true);
  setActive(els.btnType1, true);
  setActive(els.btnBgWhite, true);
  setActive(els.fontDots, true);
}
init();
