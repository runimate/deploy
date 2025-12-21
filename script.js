/* =========================================================
  RUNIMATE v2.0 — script.js (HTML id 정합 버전)
  - HTML의 실제 id와 모두 일치하도록 수정됨
  - Daily / Monthly / Garmin / NRC / Manual / Result 동작 정상화
========================================================= */

const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

const els = {
  // record type
  btnDaily: byId('btnDaily'),
  btnMonthly: byId('btnMonthly'),

  // data type tabs
  tabGarmin: byId('tabGarmin'),
  tabNRC: byId('tabNrc'),
  tabManual: byId('tabManual'),

  // data contents
  contentGarmin: byId('contentGarmin'),
  contentNRC: byId('contentNrc'),
  contentManual: byId('contentManual'),
  dataEmpty: byId('dataEmpty'),

  // NRC upload (daily/monthly 공용)
  nrcFile: byId('fileNrc'),
  btnNrcUpload: byId('btnUploadNrc'),
  ocrStatus: byId('ocrStatus'),

  // manual
  chipDistance: byId('chipDistance'),
  chipPace: byId('chipPace'),
  manualKm: byId('manualKm'),
  manualPace: byId('manualPace'),
  manualTime: byId('manualTime'),

  // month picker
  monthBlock: byId('monthBlock'),
  btnMonth: byId('btnMonth'),

  // font/layout/bg
  fontBtns: [
    byId('fontAnton'),
    byId('fontDots'),
    byId('fontLcd'),
    byId('fontGothic'),
    byId('fontSpeed'),
  ],
  layoutBtns: [byId('btnType1'), byId('btnType2')],
  bgBtns: [byId('btnBgWhite'), byId('btnBgBlack')],

  // preview
  previewDailyWrap: byId('previewDaily'),
  previewMonthlyWrap: byId('previewMonthly'),

  pvDailyDistance: byId('pvDailyDistance'),
  pvDailyPace: byId('pvDailyPace'),
  pvDailyTime: byId('pvDailyTime'),

  pvDailyDistance2: byId('pvDailyDistance2'),
  pvDailyPace2: byId('pvDailyPace2'),
  pvDailyTime2: byId('pvDailyTime2'),

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

  // run button
  btnRun: byId('btnRun'),

  // overlays
  ovResult: byId('screenResult'),
  ovGarminLogin: byId('screenGarminLogin'),
  ovGarminSelect: byId('screenSelectWorkout'),
  ovMonthPicker: byId('screenMonthPicker'),

  closeResult: byId('closeResult'),
  closeGarminLogin: byId('closeGarminLogin'),
  closeGarminSelect: byId('closeSelectWorkout'),
  closeMonthPicker: byId('closeMonthPicker'),

  // garmin login
  gcEmail: byId('gcEmail'),
  gcPw: byId('gcPw'),
  btnGarminSignIn: byId('btnGarminSignIn'),

  // garmin main + list
  garminCard: byId('garminCard'),
  garminCardDate: byId('garminDate'),
  garminCardDist: byId('garminKm'),
  garminCardPace: byId('garminPace'),
  garminCardTime: byId('garminTime'),
  btnGarminList: byId('btnGarminList'),
  workoutList: byId('workoutList'),

  // result
  rDailyDistance: byId('rDailyDistance'),
  rDailyPace: byId('rDailyPace'),
  rDailyTime: byId('rDailyTime'),
  rDailyDistance2: byId('rDailyDistance2'),
  rDailyPace2: byId('rDailyPace2'),
  rDailyTime2: byId('rDailyTime2'),

  rMonthlyDistance: byId('rMonthlyDistance'),
  rMonthlyRuns: byId('rMonthlyRuns'),
  rMonthlyPace: byId('rMonthlyPace'),
  rMonthlyTime: byId('rMonthlyTime'),
  rMonthlyDistance2: byId('rMonthlyDistance2'),
  rMonthlyRuns2: byId('rMonthlyRuns2'),
  rMonthlyPace2: byId('rMonthlyPace2'),
  rMonthlyTime2: byId('rMonthlyTime2'),
};

// =============================
// STATE + UTIL
// =============================
const state = {
  record: 'daily',
  dataType: null,
  font: 'dots',
  layout: 'type1',
  bg: 'white',
  daily: { km: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
  monthly: { km: 0, runs: 0, paceMin: 0, paceSec: 0, h: 0, m: 0, s: 0 },
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const zero2 = (n) => String(n).padStart(2, '0');
const fmtKm2 = (km) => Number(km || 0).toFixed(2);

function displayPace(m, s) {
  if (!m && !s) return `00'00"`;
  return `${m}'${zero2(s)}"`;
}
function displayTime(h, m, s) {
  if (!h && !m && !s) return `00:00:00`;
  if (h > 0) return `${h}:${zero2(m)}:${zero2(s)}`;
  return `${m}:${zero2(s)}`;
}
function calcTimeFromKmPace(km, paceMin, paceSec) {
  const pace = paceMin * 60 + paceSec;
  const sec = km * pace;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { h, m, s };
}

// =============================
// VIEW + STATE 업데이트
// =============================
function setRecord(type) {
  state.record = type;
  els.btnDaily.classList.toggle('active', type === 'daily');
  els.btnMonthly.classList.toggle('active', type === 'monthly');
  els.tabGarmin.disabled = (type === 'monthly');
  els.tabManual.disabled = (type === 'monthly');
  updatePreview();
}
function setDataType(type) {
  state.dataType = type;
  els.tabGarmin.classList.toggle('active', type === 'garmin');
  els.tabNRC.classList.toggle('active', type === 'nrc');
  els.tabManual.classList.toggle('active', type === 'manual');

  els.contentGarmin.style.display = type === 'garmin' ? 'block' : 'none';
  els.contentNRC.style.display = type === 'nrc' ? 'block' : 'none';
  els.contentManual.style.display = type === 'manual' ? 'block' : 'none';
  els.dataEmpty.style.display = type ? 'none' : 'block';

  if (type === 'garmin') openScreen(els.ovGarminLogin);
}
function setFont(font) {
  state.font = font.toLowerCase();
  els.fontBtns.forEach((b) =>
    b.classList.toggle('active', b.id.toLowerCase().includes(font.toLowerCase()))
  );
  document.body.dataset.font = state.font;
}
function setLayout(l) {
  state.layout = l;
  els.layoutBtns.forEach((b) => b.classList.toggle('active', b.id === `btn${l.charAt(0).toUpperCase()}${l.slice(1)}`));
  document.body.dataset.layout = l;
}
function setBg(bg) {
  state.bg = bg;
  els.bgBtns.forEach((b) => b.classList.toggle('active', b.id.toLowerCase().includes(bg)));
  document.body.dataset.bg = bg;
}
function updatePreview() {
  if (state.record === 'daily') {
    els.previewDailyWrap.style.display = 'block';
    els.previewMonthlyWrap.style.display = 'none';
    const d = state.daily;
    els.pvDailyDistance.textContent = `${fmtKm2(d.km)}Km`;
    els.pvDailyPace.textContent = displayPace(d.paceMin, d.paceSec);
    els.pvDailyTime.textContent = displayTime(d.h, d.m, d.s);
    els.pvDailyDistance2.textContent = `${fmtKm2(d.km)}Km`;
    els.pvDailyPace2.textContent = displayPace(d.paceMin, d.paceSec);
    els.pvDailyTime2.textContent = displayTime(d.h, d.m, d.s);
  } else {
    els.previewDailyWrap.style.display = 'none';
    els.previewMonthlyWrap.style.display = 'block';
    const mo = state.monthly;
    els.pvMonthlyDistance.textContent = `${fmtKm2(mo.km)}Km`;
    els.pvMonthlyRuns.textContent = String(mo.runs).padStart(2, '0');
    els.pvMonthlyPace.textContent = displayPace(mo.paceMin, mo.paceSec);
    els.pvMonthlyTime.textContent = displayTime(mo.h, mo.m, mo.s);
    els.pvMonthlyDistance2.textContent = `${fmtKm2(mo.km)}Km`;
    els.pvMonthlyRuns2.textContent = String(mo.runs).padStart(2, '0');
    els.pvMonthlyPace2.textContent = displayPace(mo.paceMin, mo.paceSec);
    els.pvMonthlyTime2.textContent = displayTime(mo.h, mo.m, mo.s);
  }
}

// =============================
// 오버레이
// =============================
function openScreen(el) {
  el?.classList.add('show');
}
function closeScreen(el) {
  el?.classList.remove('show');
}

// =============================
// 바인딩
// =============================
function bind() {
  els.btnDaily.addEventListener('click', () => setRecord('daily'));
  els.btnMonthly.addEventListener('click', () => setRecord('monthly'));

  els.tabGarmin.addEventListener('click', () => setDataType('garmin'));
  els.tabNRC.addEventListener('click', () => setDataType('nrc'));
  els.tabManual.addEventListener('click', () => setDataType('manual'));

  els.fontBtns.forEach((b) => b.addEventListener('click', () => setFont(b.textContent)));
  els.layoutBtns.forEach((b) => b.addEventListener('click', () => setLayout(b.id.replace('btn', '').toLowerCase())));
  els.bgBtns.forEach((b) => b.addEventListener('click', () => setBg(b.textContent.toLowerCase())));

  els.btnNrcUpload.addEventListener('click', () => els.nrcFile.click());
  els.nrcFile.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) handleNrcFile(f);
  });

  els.btnGarminSignIn.addEventListener('click', () => {
    closeScreen(els.ovGarminLogin);
    seedFakeWorkouts();
    openScreen(els.ovGarminSelect);
  });
  els.btnGarminList.addEventListener('click', () => {
    seedFakeWorkouts();
    openScreen(els.ovGarminSelect);
  });
  els.closeGarminSelect.addEventListener('click', () => closeScreen(els.ovGarminSelect));
  els.closeGarminLogin.addEventListener('click', () => closeScreen(els.ovGarminLogin));
  els.closeResult.addEventListener('click', () => closeScreen(els.ovResult));

  els.btnRun.addEventListener('click', () => runResultAnimation());
}

// =============================
// 스텁: OCR / 가민 데이터
// =============================
async function handleNrcFile(file) {
  els.ocrStatus.textContent = `OCR Reading...`;
  setTimeout(() => (els.ocrStatus.textContent = `OCR Done ✓`), 1000);
}
function seedFakeWorkouts() {
  if (!els.workoutList) return;
  els.workoutList.innerHTML = '';
  const sample = Array.from({ length: 10 }, (_, i) => ({
    date: `2025.12.${10 + i}`,
    km: 10 + i * 0.5,
    pace: { m: 5, s: 30 },
    t: { h: 1, m: 5, s: 0 },
  }));
  sample.forEach((r) => {
    const btn = document.createElement('button');
    btn.className = 'workout-item';
    btn.innerHTML = `<div>${r.date} - ${r.km}Km</div>`;
    btn.onclick = () => {
      state.daily.km = r.km;
      state.daily.paceMin = r.pace.m;
      state.daily.paceSec = r.pace.s;
      state.daily.h = r.t.h;
      state.daily.m = r.t.m;
      state.daily.s = r.t.s;
      els.garminCardDate.textContent = r.date;
      els.garminCardDist.textContent = `${fmtKm2(r.km)}Km`;
      els.garminCardPace.textContent = displayPace(r.pace.m, r.pace.s);
      els.garminCardTime.textContent = displayTime(r.t.h, r.t.m, r.t.s);
      updatePreview();
      closeScreen(els.ovGarminSelect);
    };
    els.workoutList.appendChild(btn);
  });
}

// =============================
// 결과 애니메이션
// =============================
function runResultAnimation() {
  openScreen(els.ovResult);
  const d = state.record === 'daily' ? state.daily : state.monthly;
  if (state.record === 'daily') {
    els.rDailyDistance.textContent = `${fmtKm2(d.km)}Km`;
    els.rDailyPace.textContent = displayPace(d.paceMin, d.paceSec);
    els.rDailyTime.textContent = displayTime(d.h, d.m, d.s);
    els.rDailyDistance2.textContent = `${fmtKm2(d.km)}Km`;
    els.rDailyPace2.textContent = displayPace(d.paceMin, d.paceSec);
    els.rDailyTime2.textContent = displayTime(d.h, d.m, d.s);
  } else {
    els.rMonthlyDistance.textContent = `${fmtKm2(d.km)}Km`;
    els.rMonthlyRuns.textContent = String(d.runs).padStart(2, '0');
    els.rMonthlyPace.textContent = displayPace(d.paceMin, d.paceSec);
    els.rMonthlyTime.textContent = displayTime(d.h, d.m, d.s);
  }
}

// =============================
// INIT
// =============================
function init() {
  setRecord('daily');
  setFont('dots');
  setLayout('type1');
  setBg('white');
  updatePreview();
  bind();
}
init();
