/* =========================================================
  RUNIMATE v2.0 — script.js
  - HTML ID와 1:1 매칭으로 최적화됨
  - 커스텀 Month Picker 연결 완료
========================================================= */

// DOM Helper
const byId = (id) => document.getElementById(id);

// 1. 요소 선택 (HTML ID와 정확히 일치시킴)
const els = {
  // Record Type
  btnDaily: byId('btnDaily'),
  btnMonthly: byId('btnMonthly'), // HTML id="btnMonthly" 확인 필요 (현재 코드엔 없음, 아래 설명 참조)

  // Data Tabs
  tabGarmin: byId('tabGarmin'),
  tabNrc: byId('tabNrc'),
  tabManual: byId('tabManual'),

  // Panels
  dataPanel: byId('dataPanel'),
  dataEmpty: byId('dataEmpty'),
  contentGarmin: byId('contentGarmin'),
  contentNrc: byId('contentNrc'),
  contentManual: byId('contentManual'),
  monthBlock: byId('monthBlock'), // Monthly 모드일 때 표시될 영역

  // Garmin Card (Main)
  garminDate: byId('garminDate'),
  garminKm: byId('garminKm'),
  garminPace: byId('garminPace'),
  garminTime: byId('garminTime'),
  btnGarminList: byId('btnGarminList'), // 햄버거 버튼

  // NRC Upload
  btnUploadNrc: byId('btnUploadNrc'),
  fileNrc: byId('fileNrc'),     // HTML id 수정됨에 맞춤
  ocrStatus: byId('ocrStatus'),

  // Manual Inputs (Main view buttons)
  chipDistance: byId('chipDistance'),
  chipPace: byId('chipPace'),
  manualKm: byId('manualKm'),
  manualPace: byId('manualPace'),
  manualTime: byId('manualTime'),

  // Month Trigger
  btnMonth: byId('btnMonth'),

  // Font & Layout Buttons
  fontBtns: document.querySelectorAll('.font-btn'),
  layoutBtns: document.querySelectorAll('[id^="btnType"]'), // btnType1, btnType2
  bgBtns: document.querySelectorAll('[id^="btnBg"]'),     // btnBgWhite, btnBgBlack

  // Previews
  previewDailyWrap: byId('previewDaily'),
  previewMonthlyWrap: byId('previewMonthly'),
  
  // Daily Preview Elements
  pDailyDistance: byId('pvDailyDistance'),
  pDailyPace: byId('pvDailyPace'),
  pDailyTime: byId('pvDailyTime'),
  pDailyDistance2: byId('pvDailyDistance2'),
  pDailyPace2: byId('pvDailyPace2'),
  pDailyTime2: byId('pvDailyTime2'),

  // Monthly Preview Elements
  pMonthTitle: byId('pvMonthTitle'),
  pMonthlyDistance: byId('pvMonthlyDistance'),
  pMonthlyRuns: byId('pvMonthlyRuns'),
  pMonthlyPace: byId('pvMonthlyPace'),
  pMonthlyTime: byId('pvMonthlyTime'),
  
  pMonthLine: byId('pvMonthLine'),
  pMonthlyDistance2: byId('pvMonthlyDistance2'),
  pMonthlyRuns2: byId('pvMonthlyRuns2'),
  pMonthlyPace2: byId('pvMonthlyPace2'),
  pMonthlyTime2: byId('pvMonthlyTime2'),

  // Run Button
  btnRun: byId('btnRun'),

  // --- OVERLAYS ---
  
  // Result
  screenResult: byId('screenResult'),
  closeResult: byId('closeResult'),
  // Result Values (Daily)
  rDailyDistance: byId('rDailyDistance'),
  rDailyPace: byId('rDailyPace'),
  rDailyTime: byId('rDailyTime'),
  rDailyDistance2: byId('rDailyDistance2'),
  rDailyPace2: byId('rDailyPace2'),
  rDailyTime2: byId('rDailyTime2'),
  // Result Values (Monthly)
  rMonthTitle: byId('rMonthTitle'),
  rMonthlyDistance: byId('rMonthlyDistance'),
  rMonthlyRuns: byId('rMonthlyRuns'),
  rMonthlyPace: byId('rMonthlyPace'),
  rMonthlyTime: byId('rMonthlyTime'),
  rMonthLine: byId('rMonthLine'),
  rMonthlyDistance2: byId('rMonthlyDistance2'),
  rMonthlyRuns2: byId('rMonthlyRuns2'),
  rMonthlyPace2: byId('rMonthlyPace2'),
  rMonthlyTime2: byId('rMonthlyTime2'),

  // Garmin Login
  screenGarminLogin: byId('screenGarminLogin'),
  closeGarminLogin: byId('closeGarminLogin'),
  btnGarminSignIn: byId('btnGarminSignIn'),

  // Select Workout
  screenSelectWorkout: byId('screenSelectWorkout'),
  closeSelectWorkout: byId('closeSelectWorkout'),
  workoutList: byId('workoutList'),

  // Month Picker (Custom)
  screenMonthPicker: byId('screenMonthPicker'),
  closeMonthPicker: byId('closeMonthPicker'),
  btnMonthApply: byId('btnMonthApply'),
  mpYear: byId('mpYear'),
  mpMonth: byId('mpMonth'),
};

// 2. STATE
const state = {
  record: 'daily',
  dataType: null, // 'garmin' | 'nrc' | 'manual'
  font: 'dots',
  layout: 'type1',
  bg: 'white',
  
  daily: { km:0, paceMin:0, paceSec:0, h:0, m:0, s:0 },
  monthly: { y:2025, m:12, km:0, runs:0, paceMin:0, paceSec:0, h:0, m:0, s:0 }
};

// 3. OCR Dynamic Import
let extractAllFn = null;
async function ensureOCR(){
  if(extractAllFn) return extractAllFn;
  const mod = await import('./ocr.js');
  extractAllFn = mod.extractAll;
  return extractAllFn;
}

// 4. HELPERS
const zero2 = n => String(n).padStart(2,'0');
const fmtKm = n => Number(n||0).toFixed(2);
const fmtPace = (m,s) => `${m}'${zero2(s)}"`;
const fmtTime = (h,m,s) => {
  const hh=parseInt(h||0), mm=parseInt(m||0), ss=parseInt(s||0);
  if(hh===0 && mm===0 && ss===0) return '00:00:00';
  return hh>0 ? `${hh}:${zero2(mm)}:${zero2(ss)}` : `${mm}:${zero2(ss)}`;
};
const getMonthName = (m) => ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][m-1] || '';

function calcTime(km, pm, ps){
  const paceSec = pm*60 + ps;
  const totalSec = km * paceSec;
  return { h: Math.floor(totalSec/3600), m: Math.floor((totalSec%3600)/60), s: Math.floor(totalSec%60) };
}

// 5. UPDATE UI
function updateUI(){
  // Body Attributes
  document.body.dataset.record = state.record;
  document.body.dataset.font = state.font;
  document.body.dataset.layout = state.layout;
  document.body.dataset.bg = state.bg;

  // Buttons Active State
  if(els.btnDaily) els.btnDaily.classList.toggle('active', state.record==='daily');
  if(els.btnMonthly) els.btnMonthly.classList.toggle('active', state.record==='monthly');

  els.fontBtns.forEach(b => b.classList.toggle('active', b.id === `font${state.font.charAt(0).toUpperCase() + state.font.slice(1)}`));
  els.layoutBtns.forEach(b => b.classList.toggle('active', b.id === `btn${state.layout.charAt(0).toUpperCase() + state.layout.slice(1)}`));
  els.bgBtns.forEach(b => b.classList.toggle('active', b.id === `btnBg${state.bg.charAt(0).toUpperCase() + state.bg.slice(1)}`));

  // Tabs
  els.tabGarmin.classList.toggle('active', state.dataType==='garmin');
  els.tabNrc.classList.toggle('active', state.dataType==='nrc');
  els.tabManual.classList.toggle('active', state.dataType==='manual');
  
  // Panels Visibility
  els.monthBlock.style.display = (state.record === 'monthly') ? 'block' : 'none';
  
  // Data Content Logic
  // Daily: dataType에 따라 표시 / Monthly: 무조건 NRC 업로드만 표시(기획 의도 추정)
  const showEmpty = (state.record==='daily' && !state.dataType);
  els.dataEmpty.style.display = showEmpty ? 'block' : 'none';

  if(state.record === 'monthly') {
    els.contentGarmin.style.display = 'none';
    els.contentManual.style.display = 'none';
    els.contentNrc.style.display = 'block'; // Monthly는 NRC만 사용한다고 가정
    
    // 탭 비활성화 느낌 처리
    els.tabGarmin.style.opacity = '0.3'; 
    els.tabManual.style.opacity = '0.3';
    els.tabNrc.classList.add('active');
  } else {
    els.tabGarmin.style.opacity = '1';
    els.tabManual.style.opacity = '1';
    
    els.contentGarmin.style.display = (state.dataType==='garmin') ? 'block' : 'none';
    els.contentNrc.style.display = (state.dataType==='nrc') ? 'block' : 'none';
    els.contentManual.style.display = (state.dataType==='manual') ? 'block' : 'none';
  }

  renderPreview();
}

function renderPreview(){
  if(state.record === 'daily'){
    const d = state.daily;
    const txtKm = fmtKm(d.km) + 'Km';
    const txtPace = fmtPace(d.paceMin, d.paceSec);
    const txtTime = fmtTime(d.h, d.m, d.s);

    // Manual Input Button Text Update
    els.manualKm.textContent = fmtKm(d.km);
    els.manualPace.textContent = fmtPace(d.paceMin, d.paceSec);
    els.manualTime.textContent = txtTime;

    // Garmin Card Update
    els.garminKm.textContent = txtKm;
    els.garminPace.textContent = txtPace;
    els.garminTime.textContent = txtTime;

    // Preview
    [els.pDailyDistance, els.pDailyDistance2].forEach(e => e.textContent = txtKm);
    [els.pDailyPace, els.pDailyPace2].forEach(e => e.textContent = txtPace);
    [els.pDailyTime, els.pDailyTime2].forEach(e => e.textContent = txtTime);

  } else {
    const m = state.monthly;
    const mName = getMonthName(m.m);
    const mTitle = `${mName} ${m.y}`; // DECEMBER 2025
    
    // Month Button Text
    els.btnMonth.textContent = `${mName.charAt(0)+mName.slice(1).toLowerCase()}. ${m.y}`;

    // Preview
    els.pMonthTitle.innerHTML = `${mName}<br/>${m.y}`;
    els.pMonthLine.textContent = mTitle;

    const txtKm = fmtKm(m.km) + 'Km';
    const txtRuns = String(m.runs).padStart(2,'0');
    const txtPace = fmtPace(m.paceMin, m.paceSec);
    const txtTime = fmtTime(m.h, m.m, m.s);

    [els.pMonthlyDistance, els.pMonthlyDistance2].forEach(e => e.textContent = txtKm);
    [els.pMonthlyRuns, els.pMonthlyRuns2].forEach(e => e.textContent = txtRuns);
    [els.pMonthlyPace, els.pMonthlyPace2].forEach(e => e.textContent = txtPace);
    [els.pMonthlyTime, els.pMonthlyTime2].forEach(e => e.textContent = txtTime);
  }
}

// 6. EVENT LISTENERS
function bindEvents(){
  // Record Type
  els.btnDaily.onclick = () => { state.record = 'daily'; updateUI(); };
  els.btnMonthly.onclick = () => { state.record = 'monthly'; updateUI(); };

  // Data Tabs
  els.tabGarmin.onclick = () => { 
    if(state.record === 'monthly') return;
    state.dataType = 'garmin'; 
    updateUI(); 
    openOverlay(els.screenGarminLogin);
  };
  els.tabNrc.onclick = () => { 
    state.dataType = 'nrc'; 
    updateUI(); 
  };
  els.tabManual.onclick = () => { 
    if(state.record === 'monthly') return;
    state.dataType = 'manual'; 
    updateUI(); 
  };

  // Font / Layout / BG
  els.fontBtns.forEach(b => b.onclick = () => { 
    state.font = b.id.replace('font','').toLowerCase(); 
    updateUI(); 
  });
  els.layoutBtns.forEach(b => b.onclick = () => { 
    state.layout = b.id.replace('btn','').toLowerCase(); 
    updateUI(); 
  });
  els.bgBtns.forEach(b => b.onclick = () => { 
    state.bg = b.id.replace('btnBg','').toLowerCase(); 
    updateUI(); 
  });

  // NRC Upload (OCR)
  els.btnUploadNrc.onclick = () => els.fileNrc.click();
  els.fileNrc.onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    els.ocrStatus.textContent = 'Scanning...';
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const extract = await ensureOCR();
        const res = await extract(ev.target.result, { recordType: state.record });
        
        if(state.record === 'daily'){
          state.daily.km = res.km;
          state.daily.paceMin = res.paceMin;
          state.daily.paceSec = res.paceSec;
          state.daily.h = res.timeH; state.daily.m = res.timeM; state.daily.s = res.timeS;
          // 시간 누락시 계산
          if(!state.daily.h && !state.daily.m && !state.daily.s){
            const t = calcTime(res.km, res.paceMin, res.paceSec);
            state.daily = { ...state.daily, ...t };
          }
        } else {
          state.monthly.km = res.km;
          state.monthly.runs = res.runs || 0;
          state.monthly.paceMin = res.paceMin;
          state.monthly.paceSec = res.paceSec;
          state.monthly.h = res.timeH; state.monthly.m = res.timeM; state.monthly.s = res.timeS;
        }
        
        els.ocrStatus.textContent = 'Completed!';
        renderPreview();
        setTimeout(() => els.ocrStatus.textContent = '', 2000);
      };
      reader.readAsDataURL(file);
    } catch(err){
      console.error(err);
      els.ocrStatus.textContent = 'Error';
    }
    e.target.value = '';
  };

  // Manual Inputs (Simple Prompt for now)
  // 실제로는 모달을 띄우는 것이 좋지만, 기존 코드 흐름상 prompt로 대체하거나
  // 혹은 별도의 manual 모달이 있다면 연결해야 합니다. 
  // 여기서는 prompt로 간단히 구현합니다.
  els.chipDistance.onclick = () => {
    const v = prompt('Distance (Km)', state.daily.km);
    if(v) { 
      state.daily.km = parseFloat(v); 
      // 거리 변경시 시간 자동 재계산
      const t = calcTime(state.daily.km, state.daily.paceMin, state.daily.paceSec);
      state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;
      renderPreview(); 
    }
  };
  els.chipPace.onclick = () => {
    const v = prompt('Pace (MM:SS)', `${state.daily.paceMin}:${state.daily.paceSec}`);
    if(v) {
      const [m,s] = v.split(':').map(Number);
      state.daily.paceMin = m||0; state.daily.paceSec = s||0;
      const t = calcTime(state.daily.km, state.daily.paceMin, state.daily.paceSec);
      state.daily.h=t.h; state.daily.m=t.m; state.daily.s=t.s;
      renderPreview();
    }
  };

  // Month Picker
  els.btnMonth.onclick = () => openOverlay(els.screenMonthPicker);
  els.closeMonthPicker.onclick = () => closeOverlay(els.screenMonthPicker);
  els.btnMonthApply.onclick = () => {
    state.monthly.y = parseInt(els.mpYear.value);
    state.monthly.m = parseInt(els.mpMonth.value);
    renderPreview();
    closeOverlay(els.screenMonthPicker);
  };

  // Garmin Overlays
  els.closeGarminLogin.onclick = () => closeOverlay(els.screenGarminLogin);
  els.btnGarminSignIn.onclick = (e) => {
    e.preventDefault();
    closeOverlay(els.screenGarminLogin);
    // Mock List 생성
    els.workoutList.innerHTML = '';
    for(let i=0; i<5; i++){
      const btn = document.createElement('button');
      btn.className = 'workout-card';
      btn.innerHTML = `
        <div class="wk-left"><div class="wk-date">2025.12.1${i}</div><div class="wk-stats"><span class="wk-stat">10.0${i}Km</span></div></div>
        <div class="wk-arrow">→</div>`;
      btn.onclick = () => {
        state.daily.km = 10.00 + i/100;
        state.daily.paceMin = 5; state.daily.paceSec = 30;
        state.daily.h = 0; state.daily.m = 50 + i; state.daily.s = 0;
        renderPreview();
        closeOverlay(els.screenSelectWorkout);
      };
      els.workoutList.appendChild(btn);
    }
    openOverlay(els.screenSelectWorkout);
  };
  els.closeSelectWorkout.onclick = () => closeOverlay(els.screenSelectWorkout);
  els.btnGarminList.onclick = () => openOverlay(els.screenSelectWorkout);

  // Result & RUN
  els.btnRun.onclick = () => {
    openOverlay(els.screenResult);
    animateResult();
  };
  els.closeResult.onclick = () => closeOverlay(els.screenResult);
}

// 7. OVERLAY & ANIMATION
function openOverlay(el) { el.classList.add('show'); document.body.classList.add('no-scroll'); }
function closeOverlay(el) { el.classList.remove('show'); document.body.classList.remove('no-scroll'); }

function animateResult(){
  // 값 세팅
  if(state.record === 'daily'){
    const d = state.daily;
    const txtKm = fmtKm(d.km) + 'Km';
    const txtPace = fmtPace(d.paceMin, d.paceSec);
    const txtTime = fmtTime(d.h, d.m, d.s);
    
    [els.rDailyDistance, els.rDailyDistance2].forEach(e => e.textContent = txtKm);
    [els.rDailyPace, els.rDailyPace2].forEach(e => e.textContent = txtPace);
    [els.rDailyTime, els.rDailyTime2].forEach(e => e.textContent = txtTime);
    
    // Monthly Result Hide, Daily Show
    document.getElementById('resultMonthly').style.display = 'none';
    document.getElementById('resultDaily').style.display = 'block';
  } else {
    const m = state.monthly;
    const txtKm = fmtKm(m.km) + 'Km';
    const txtRuns = String(m.runs).padStart(2,'0');
    const txtPace = fmtPace(m.paceMin, m.paceSec);
    const txtTime = fmtTime(m.h, m.m, m.s);
    
    const mName = getMonthName(m.m);
    els.rMonthTitle.innerHTML = `${mName}<br/>${m.y}`;
    els.rMonthLine.textContent = `${mName} ${m.y}`;

    [els.rMonthlyDistance, els.rMonthlyDistance2].forEach(e => e.textContent = txtKm);
    [els.rMonthlyRuns, els.rMonthlyRuns2].forEach(e => e.textContent = txtRuns);
    [els.rMonthlyPace, els.rMonthlyPace2].forEach(e => e.textContent = txtPace);
    [els.rMonthlyTime, els.rMonthlyTime2].forEach(e => e.textContent = txtTime);

    document.getElementById('resultDaily').style.display = 'none';
    document.getElementById('resultMonthly').style.display = 'block';
  }
}

// INIT
bindEvents();
updateUI();
