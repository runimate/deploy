// ocr.js — FAST & STABLE OCR (RUNIMATE v2)
// - ES Module
// - ROI 멀티패스(거리) + ROI 멀티패스(페이스/시간) + 전체텍스트 보조 파서
// - 중요: 모듈 최상단에서 "Tesseract" 심볼 직접 참조 금지 (동적 로드 환경에서 정확도/안정성 저하 원인)

let _tessReady = false;

/* =========================
   1) Tesseract 보장 (v2 권장)
========================= */
async function ensureTesseract() {
  if (window.Tesseract) {
    _tessReady = true;
    return window.Tesseract;
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Tesseract.js v2'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  _tessReady = true;
  return window.Tesseract;
}

/* =========================
   2) Canvas / Image Utils
========================= */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function toCanvas(imgDataURL) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ img, w: img.width, h: img.height });
    img.onerror = rej;
    img.src = imgDataURL;
  });
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function normalizeOCR(s) {
  return (s || '')
    .replace(/[\u2018\u2019\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[·•]/g, '.')
    .replace(/\u200B|\u00A0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function zero2(n) { return String(n).padStart(2, '0'); }

/* =========================
   3) Preprocess (binarize + invert detect + scale)
========================= */
async function preprocessImageToDataURL(imgDataURL, {
  scale = 2.4,
  threshold = 190,
  invertAuto = true
} = {}) {
  const { img, w: W, h: H } = await toCanvas(imgDataURL);
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  // (A) 간단한 밝기 평균으로 배경이 어두운지 판단(코너 샘플)
  let bgDark = false;
  if (invertAuto) {
    const sample = [];
    const pts = [
      [Math.floor(w * 0.06), Math.floor(h * 0.06)],
      [Math.floor(w * 0.94), Math.floor(h * 0.06)],
      [Math.floor(w * 0.06), Math.floor(h * 0.94)],
      [Math.floor(w * 0.94), Math.floor(h * 0.94)],
    ];
    for (const [x, y] of pts) {
      const i = (y * w + x) * 4;
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      sample.push(g);
    }
    const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
    bgDark = avg < 120;
  }

  // (B) grayscale + threshold
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    let v = g > threshold ? 255 : 0;
    if (invertAuto && bgDark) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

async function unsharp(srcDataURL, amount = 0.9) {
  const { img, w, h } = await toCanvas(srcDataURL);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  // 간단한 가로 방향 샤프닝(속도 우선)
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const i = (y * w + x) * 4;
      const j = (y * w + x - 1) * 4;
      d[i] = clamp(d[i] + amount * (d[i] - d[j]), 0, 255);
      d[i + 1] = clamp(d[i + 1] + amount * (d[i + 1] - d[j + 1]), 0, 255);
      d[i + 2] = clamp(d[i + 2] + amount * (d[i + 2] - d[j + 2]), 0, 255);
    }
  }
  ctx.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

/* =========================
   4) ROI Crops
========================= */
async function cropROI(imgDataURL, {
  topPct = 0.06, heightPct = 0.30, sidePct = 0.06,
  scale = 2.8
} = {}) {
  const { img, w, h } = await toCanvas(imgDataURL);
  const x = Math.round(w * sidePct);
  const y = Math.round(h * topPct);
  const cw = Math.round(w * (1 - 2 * sidePct));
  const ch = Math.round(h * heightPct);

  const outW = Math.round(cw * scale);
  const outH = Math.round(ch * scale);

  const c = makeCanvas(outW, outH);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, cw, ch, 0, 0, outW, outH);
  return c.toDataURL('image/png');
}

// Distance: 상단 큰 숫자 영역
async function cropDistanceROI(imgDataURL) {
  return cropROI(imgDataURL, { topPct: 0.06, heightPct: 0.30, sidePct: 0.06, scale: 2.8 });
}

// Pace/Time: 중단~하단 영역(스크린샷 구조가 조금 달라도 잡히게 넓게)
async function cropPaceTimeROI(imgDataURL) {
  // NRC에서 페이스/시간은 보통 상단 큰 숫자 아래쪽~중앙에 위치
  // 너무 타이트하게 자르면 폰트/기종별로 놓치므로 넓게
  return cropROI(imgDataURL, { topPct: 0.28, heightPct: 0.52, sidePct: 0.06, scale: 2.4 });
}

/* =========================
   5) 후보 추출/스코어링
========================= */
function numsFromText(s) {
  const t = normalizeOCR(s || '');
  const m = t.match(/\b\d{1,3}[.,]\d{1,2}\b/g) || [];
  return m.map(x => ({
    val: parseFloat(x.replace(',', '.')),
    dec: (x.split(/[.,]/)[1] || '').length
  }));
}

function kmCandidatesFromWords(words) {
  if (!Array.isArray(words) || !words.length) return [];
  const lines = new Map();

  for (const w of words) {
    const id = w.line ?? `y${Math.round(((w.bbox?.y0 || 0) + (w.bbox?.y1 || 0)) / 2)}`;
    const h = (w.bbox ? Math.max(0, (w.bbox.y1 - w.bbox.y0)) : 0);
    const y = (w.bbox ? (w.bbox.y0 + w.bbox.y1) / 2 : 0);
    const t = (w.text || '').trim();
    if (!lines.has(id)) lines.set(id, { text: [], maxH: 0, y: Infinity });
    const L = lines.get(id);
    L.text.push(t);
    L.maxH = Math.max(L.maxH, h);
    L.y = Math.min(L.y, y);
  }

  // 상단 근처/큰 글자 라인을 우선
  const arr = [...lines.values()]
    .sort((a, b) => (a.y - b.y) || (b.maxH - a.maxH))
    .slice(0, 5);

  const out = [];
  for (const L of arr) {
    const joined = L.text.join(' ');
    const onlyNum = L.text.filter(t => /^[0-9.,]+$/.test(t)).join('');
    const c1 = numsFromText(joined);
    const c2 = numsFromText(onlyNum);
    c1.concat(c2).forEach(o => out.push({ ...o, src: 'word-top', score: L.maxH }));
  }
  return out;
}

function groupKmCandidates(cands, preferDec = 2) {
  const groups = new Map();
  for (const c of cands) {
    const val = c.val;
    if (!isFinite(val)) continue;
    if (val <= 0 || val > 999) continue;

    const key = (Math.round(val * 100) / 100).toFixed(2);
    if (!groups.has(key)) {
      groups.set(key, { val: parseFloat(key), count: 0, roi: 0, decHits: 0, score: 0 });
    }
    const g = groups.get(key);
    g.count++;
    if (String(c.src || '').includes('roi')) g.roi += 1;
    g.decHits += (c.dec === preferDec) ? 2 : 0.5;
    g.score += (c.score || 0);
  }
  return [...groups.values()].sort((a, b) =>
    (b.roi - a.roi) ||
    (b.decHits - a.decHits) ||
    (b.count - a.count) ||
    (b.score - a.score)
  );
}

/* =========================
   6) Pace/Time/Runs Parsing (강화)
========================= */
function parseTimeFromText(textRaw) {
  const text = normalizeOCR(textRaw);

  // 1) HH:MM:SS
  let m = text.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (m) {
    const h = +m[1], min = +m[2], s = +m[3];
    return { timeH: h, timeM: min, timeS: s, timeRaw: `${zero2(h)}:${zero2(min)}:${zero2(s)}` };
  }

  // 2) MM:SS
  m = text.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (m) {
    const min = +m[1], s = +m[2];
    return { timeH: null, timeM: min, timeS: s, timeRaw: `${zero2(min)}:${zero2(s)}` };
  }

  // 3) 한국어: 1시간 2분 3초 / 12분 34초
  m = text.match(/(\d{1,2})\s*시간\s*(\d{1,2})\s*분\s*(\d{1,2})\s*초/);
  if (m) {
    const h = +m[1], min = +m[2], s = +m[3];
    return { timeH: h, timeM: min, timeS: s, timeRaw: `${zero2(h)}:${zero2(min)}:${zero2(s)}` };
  }
  m = text.match(/(\d{1,2})\s*분\s*(\d{1,2})\s*초/);
  if (m) {
    const min = +m[1], s = +m[2];
    return { timeH: null, timeM: min, timeS: s, timeRaw: `${zero2(min)}:${zero2(s)}` };
  }

  // 4) 영문: 1h 2m 3s / 12m 34s
  m = text.match(/\b(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*(\d{1,2})\s*s\b/i);
  if (m) {
    const h = +m[1], min = +m[2], s = +m[3];
    return { timeH: h, timeM: min, timeS: s, timeRaw: `${zero2(h)}:${zero2(min)}:${zero2(s)}` };
  }
  m = text.match(/\b(\d{1,2})\s*m\s*(\d{1,2})\s*s\b/i);
  if (m) {
    const min = +m[1], s = +m[2];
    return { timeH: null, timeM: min, timeS: s, timeRaw: `${zero2(min)}:${zero2(s)}` };
  }

  return { timeH: null, timeM: null, timeS: null, timeRaw: null };
}

function parsePaceFromText(textRaw) {
  const text = normalizeOCR(textRaw);

  // 1) 6'30"
  let m = text.match(/\b(\d{1,2})\s*'\s*(\d{2})\s*"?\b/);
  if (m) return { paceMin: parseInt(m[1], 10), paceSec: parseInt(m[2], 10), paceRaw: `${m[1]}'${m[2]}"` };

  // 2) 6:30 (OCR에서 '를 :로 읽는 케이스)
  m = text.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (m) {
    const min = parseInt(m[1], 10), sec = parseInt(m[2], 10);
    // 시간(00:59)과 혼동 방지: pace는 보통 3~15분대. 너무 큰 값은 버림.
    if (min >= 2 && min <= 20) return { paceMin: min, paceSec: sec, paceRaw: `${min}'${zero2(sec)}"` };
  }

  // 3) "페이스 6 30" 같은 찢김 방지
  m = text.match(/\b(\d{1,2})\s+(\d{2})\b/);
  if (m) {
    const min = parseInt(m[1], 10), sec = parseInt(m[2], 10);
    if (min >= 2 && min <= 20 && sec >= 0 && sec <= 59) return { paceMin: min, paceSec: sec, paceRaw: `${min}'${zero2(sec)}"` };
  }

  return { paceMin: null, paceSec: null, paceRaw: null };
}

function parseRunsFromText(textRaw) {
  const text = normalizeOCR(textRaw);
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];

    // Runs / Run / 러닝 / 횟수
    if (/^(Runs?|러닝|횟수)\b/i.test(L)) {
      const prev = lines[i - 1] || "";
      const next = lines[i + 1] || "";
      let mm;

      if ((mm = prev.match(/^\s*(\d{1,3})\s*$/))) return +mm[1];
      if ((mm = next.match(/^\s*(\d{1,3})\s*$/))) return +mm[1];
      if ((mm = L.match(/\b(\d{1,3})\b/))) return +mm[1];
    }
  }

  // 앵커 못 찾으면 "Runs" 근처 or Pace 이전 범위에서 마지막 정수
  const pacePos = text.search(/\d{1,2}\s*'\s*\d{2}|\d{1,2}\s*:\s*\d{2}/);
  const scope = pacePos > 0 ? text.slice(0, pacePos) : text;
  const cands = (scope.match(/\b\d{1,3}\b/g) || []).map(s => +s).filter(n => n >= 0 && n <= 999);
  return cands.length ? cands[cands.length - 1] : null;
}

function parseKmFromLabel(textRaw) {
  const text = normalizeOCR(textRaw);

  const re2dec = /(\d{1,3})\s*[.,]\s*(\d{2})\b/;
  const re1dec = /(\d{1,3})\s*[.,]\s*(\d{1})\b/;
  const reInt = /\b(\d{1,3})\b/;

  const first2Dec = s => (s.match(re2dec) ? `${RegExp.$1}.${RegExp.$2}` : null);
  const first1Dec = s => (s.match(re1dec) ? `${RegExp.$1}.${RegExp.$2}` : null);
  const firstInt = s => (s.match(reInt) ? `${RegExp.$1}` : null);

  // distance label 후보들
  const labelIdx = [
    text.search(/킬로미터|km\b/i),
    text.search(/거리|distance/i),
    text.search(/주행거리/i),
  ].filter(i => i !== -1);

  if (!labelIdx.length) return null;

  const idx = Math.min(...labelIdx);
  const before = text.slice(Math.max(0, idx - 70), idx);
  const kmStr = first2Dec(before) || first1Dec(before) || firstInt(before);
  return kmStr ? parseFloat(kmStr.replace(',', '.')) : null;
}

/* =========================
   7) Tesseract Recognize Helpers
========================= */
function getPSM(T, fallback) {
  // v2: T.PSM may exist. 없으면 fallback.
  return (T && T.PSM && Number.isFinite(T.PSM[fallback])) ? T.PSM[fallback] : null;
}

function kmLineOpts(T, mode = 'SINGLE_LINE') {
  const psm =
    (T?.PSM?.SINGLE_LINE ?? 7);
  return {
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: '0123456789.,',
    classify_bln_numeric_mode: '1'
  };
}

function kmWordOpts(T) {
  const psm =
    (T?.PSM?.SINGLE_WORD ?? 8);
  return {
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: '0123456789.,',
    classify_bln_numeric_mode: '1'
  };
}

function paceTimeOpts(T) {
  // 숫자/구분자/한글(분초시간)/영문(hms)까지 허용
  const psm =
    (T?.PSM?.SINGLE_BLOCK ?? 3);
  return {
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: "0123456789:'\"hmsHMS분초시간 .",
  };
}

function fullTextOpts(T) {
  const psm =
    (T?.PSM?.SINGLE_BLOCK ?? 3);
  return {
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1'
  };
}

/* =========================
   8) 거리(KM) 멀티패스 후보 생성
========================= */
async function multiPassKmCandidates(imgDataURL, debugBag) {
  const T = await ensureTesseract();

  const out = [];

  // ROI
  const roi0 = await cropDistanceROI(imgDataURL);

  // pass variants
  const roiSharp = await unsharp(roi0, 0.9);
  const roiBinA = await preprocessImageToDataURL(roiSharp, { scale: 1.0, threshold: 190, invertAuto: true });
  const roiBinB = await preprocessImageToDataURL(roiSharp, { scale: 1.0, threshold: 175, invertAuto: true });

  debugBag.roiDistance = { roi0, roiSharp, roiBinA, roiBinB };

  const [r1, r2, r3, r4] = await Promise.all([
    T.recognize(roiSharp, 'eng', kmLineOpts(T)),
    T.recognize(roiBinA, 'eng', kmLineOpts(T)),
    T.recognize(roiBinA, 'eng', kmWordOpts(T)),
    T.recognize(roiBinB, 'eng', kmLineOpts(T)),
  ]);

  const pack = [
    ['roiSharp-line', roiSharp, r1],
    ['roiBinA-line', roiBinA, r2],
    ['roiBinA-word', roiBinA, r3],
    ['roiBinB-line', roiBinB, r4],
  ];

  for (const [tag, _img, res] of pack) {
    const conf = (res?.data?.confidence ?? 60) / 100;
    const text = res?.data?.text ?? '';
    debugBag.kmTexts.push({ tag, confidence: res?.data?.confidence ?? null, text });

    numsFromText(text).forEach(o => out.push({ ...o, src: tag, score: (o.score || 0) + conf * 14 }));
    kmCandidatesFromWords(res?.data?.words).forEach(o => out.push({ ...o, src: `${tag}-words`, score: (o.score || 0) + conf * 14 }));
  }

  return out;
}

/* =========================
   9) 페이스/시간 ROI 멀티패스
========================= */
async function multiPassPaceTime(imgDataURL, debugBag) {
  const T = await ensureTesseract();

  const roi0 = await cropPaceTimeROI(imgDataURL);
  const roiSharp = await unsharp(roi0, 0.75);
  const roiBinA = await preprocessImageToDataURL(roiSharp, { scale: 1.0, threshold: 185, invertAuto: true });
  const roiBinB = await preprocessImageToDataURL(roiSharp, { scale: 1.0, threshold: 170, invertAuto: true });

  debugBag.roiPaceTime = { roi0, roiSharp, roiBinA, roiBinB };

  const [r1, r2, r3] = await Promise.all([
    T.recognize(roiSharp, 'eng+kor', paceTimeOpts(T)),
    T.recognize(roiBinA, 'eng+kor', paceTimeOpts(T)),
    T.recognize(roiBinB, 'eng+kor', paceTimeOpts(T)),
  ]);

  const texts = [
    ['pt-roiSharp', r1?.data?.text ?? '', r1?.data?.confidence ?? null],
    ['pt-roiBinA', r2?.data?.text ?? '', r2?.data?.confidence ?? null],
    ['pt-roiBinB', r3?.data?.text ?? '', r3?.data?.confidence ?? null],
  ];

  debugBag.ptTexts.push(...texts.map(([tag, text, confidence]) => ({ tag, text, confidence })));

  // 여러 텍스트를 합쳐서 파싱(놓침 방지)
  const merged = texts.map(t => t[1]).join('\n');
  return merged;
}

/* =========================
   10) KM 최종 선택 (OCR 우선 유지)
========================= */
function pickBestKm(cands, recordType = 'daily') {
  if (!cands || !cands.length) return null;

  const preferDec = (recordType === 'monthly') ? 1 : 2;
  const ranked = groupKmCandidates(cands, preferDec);
  return ranked[0]?.val ?? null;
}

/* =========================
   11) Public API
========================= */
export async function extractAll(imgDataURL, { recordType = 'daily', debug = false } = {}) {
  const debugBag = {
    kmTexts: [],
    ptTexts: [],
    roiDistance: null,
    roiPaceTime: null,
    fullText: null
  };

  await ensureTesseract();
  const T = window.Tesseract;

  // (1) KM candidates from ROI multipass
  const kmCands = await multiPassKmCandidates(imgDataURL, debugBag);

  // (2) Pace/Time from ROI multipass (merged text)
  const ptMergedText = await multiPassPaceTime(imgDataURL, debugBag);
  const ptPace = parsePaceFromText(ptMergedText);
  const ptTime = parseTimeFromText(ptMergedText);

  // (3) Full text pass (보조)
  const rFull = await T.recognize(imgDataURL, 'eng+kor', fullTextOpts(T));
  const fullText = rFull?.data?.text ?? '';
  debugBag.fullText = fullText;

  const auxKm = parseKmFromLabel(fullText);
  if (auxKm != null && isFinite(auxKm)) {
    kmCands.push({ val: auxKm, dec: (String(auxKm).split('.')[1] || '').length, src: 'aux-label', score: 10 });
  }

  const fullPace = parsePaceFromText(fullText);
  const fullTime = parseTimeFromText(fullText);

  const runs = (recordType === 'monthly') ? parseRunsFromText(fullText) : null;

  // (4) Final selection (KM은 계산으로 덮지 않음)
  const kmBest = pickBestKm(kmCands, recordType);

  // (5) Pace/Time: ROI 결과가 우선, 없으면 fullText 보조
  const paceMin = (ptPace.paceMin != null ? ptPace.paceMin : fullPace.paceMin);
  const paceSec = (ptPace.paceSec != null ? ptPace.paceSec : fullPace.paceSec);

  const timeRaw = (ptTime.timeRaw || fullTime.timeRaw || null);
  const timeH = (ptTime.timeRaw ? ptTime.timeH : fullTime.timeH);
  const timeM = (ptTime.timeRaw ? ptTime.timeM : fullTime.timeM);
  const timeS = (ptTime.timeRaw ? ptTime.timeS : fullTime.timeS);

  // sanity clamp (너무 말도 안 되는 값 방지)
  let km = (kmBest != null && isFinite(kmBest)) ? kmBest : null;
  if (km != null) {
    if (recordType === 'daily') km = clamp(km, 0.1, 200);
    else km = clamp(km, 0.1, 999);
  }

  const out = {
    km: km ?? 0,
    runs,
    paceMin: paceMin ?? null,
    paceSec: (paceSec != null ? clamp(paceSec, 0, 59) : null),
    timeH: (timeH != null ? clamp(timeH, 0, 99) : null),
    timeM: (timeM != null ? clamp(timeM, 0, 59) : null),
    timeS: (timeS != null ? clamp(timeS, 0, 59) : null),
    timeRaw
  };

  if (debug) out._debug = debugBag;
  return out;
}

/* =========================
   12) (옵션) 포맷 유틸 — 앞자리 0 제거용
   - 너가 요청한 "05' 30" -> "5' 30" 형식에 도움
========================= */
export function formatPace(paceMin, paceSec) {
  if (paceMin == null || paceSec == null) return '';
  const m = String(parseInt(paceMin, 10));
  const s = zero2(parseInt(paceSec, 10));
  return `${m}' ${s}"`;
}

export function formatTime(timeH, timeM, timeS) {
  // HH:MM:SS or MM:SS, 앞 0 제거(예: 01:05:09 -> 1:05:09, 05:30 -> 5:30)
  if (timeM == null && timeS == null && timeH == null) return '';
  const h = (timeH != null ? parseInt(timeH, 10) : null);
  const m = (timeM != null ? parseInt(timeM, 10) : 0);
  const s = (timeS != null ? parseInt(timeS, 10) : 0);

  if (h != null && h > 0) return `${h}:${zero2(m)}:${zero2(s)}`;
  return `${m}:${zero2(s)}`;
}
