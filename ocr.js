// ocr.js — FAST & STABLE OCR (RUNIMATE v2.1 - Daily Optimized)
// - ES Module
// - ROI 멀티패스(거리) + ROI 핀포인트(페이스/시간) + 정규식 강화
// - Daily 모드(001~013 케이스) 데이터 라인 정밀 타격

let _tessReady = false;

/* =========================
   1) Tesseract 보장
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
    .replace(/[\u2018\u2019\u2032\u2035´`]/g, "'") // 다양한 작은따옴표 정규화
    .replace(/[\u201C\u201D\u2033]/g, '"')         // 다양한 큰따옴표 정규화
    .replace(/[·•]/g, '.')
    .replace(/O/g, '0') // 숫자 0을 알파벳 O로 오인하는 경우 보정
    .replace(/o/g, '0')
    .replace(/\u200B|\u00A0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function zero2(n) { return String(n).padStart(2, '0'); }

/* =========================
   3) Preprocess (Binarize + Unsharp)
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

  // (A) 배경 밝기 감지
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

  // (B) 이진화
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
   4) ROI Crops (좌표 최적화)
========================= */
async function cropROI(imgDataURL, {
  topPct, heightPct, sidePct = 0.05,
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

// Distance: 상단 큰 숫자 영역 (변경 없음, 잘 작동함)
async function cropDistanceROI(imgDataURL) {
  return cropROI(imgDataURL, { topPct: 0.05, heightPct: 0.25, sidePct: 0.05, scale: 3.0 });
}

// Pace/Time: *핵심 변경*
// 기존: 상단~중단을 넓게 잡음 -> 레이블(Avg Pace)까지 포함되어 오인식 가능성 있음
// 변경: 숫자가 위치한 'Row'만 핀포인트로 잡음 (Top 22% ~ 38% 구간)
async function cropPaceTimeROI(imgDataURL) {
  return cropROI(imgDataURL, { topPct: 0.22, heightPct: 0.16, sidePct: 0.04, scale: 2.8 });
}

/* =========================
   5) Parsers (정규식 강화)
========================= */
function numsFromText(s) {
  const t = normalizeOCR(s || '');
  const m = t.match(/\b\d{1,3}[.,]\d{1,2}\b/g) || [];
  return m.map(x => ({
    val: parseFloat(x.replace(',', '.')),
    dec: (x.split(/[.,]/)[1] || '').length
  }));
}

function groupKmCandidates(cands, preferDec = 2) {
  const groups = new Map();
  for (const c of cands) {
    const val = c.val;
    if (!isFinite(val) || val <= 0 || val > 999) continue;

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
    (b.roi - a.roi) || (b.decHits - a.decHits) || (b.count - a.count) || (b.score - a.score)
  );
}

function parseTimeFromText(textRaw) {
  const text = normalizeOCR(textRaw);

  // 1) HH:MM:SS (예: 1:56:30 - 010.png 케이스)
  let m = text.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (m) {
    const h = +m[1], min = +m[2], s = +m[3];
    return { timeH: h, timeM: min, timeS: s, timeRaw: `${zero2(h)}:${zero2(min)}:${zero2(s)}` };
  }

  // 2) MM:SS (예: 44:30) - Pace와 혼동 주의, 보통 Time은 Pace보다 큼(값 체크는 후처리에 위임)
  m = text.match(/\b(\d{1,3})\s*:\s*(\d{2})\b/);
  if (m) {
    const min = +m[1], s = +m[2];
    // 분이 60을 넘어가면 HH:MM으로 간주할 수도 있으나, NRC는 보통 MM:SS로 표시 (99:59까지)
    return { timeH: null, timeM: min, timeS: s, timeRaw: `${zero2(min)}:${zero2(s)}` };
  }

  return { timeH: null, timeM: null, timeS: null, timeRaw: null };
}

function parsePaceFromText(textRaw) {
  const text = normalizeOCR(textRaw);

  // 1) 표준: 5'38" (따옴표 명확)
  let m = text.match(/\b(\d{1,2})\s*'\s*(\d{2})\s*"?\b/);
  if (m) return { paceMin: +m[1], paceSec: +m[2], paceRaw: `${m[1]}'${m[2]}"` };

  // 2) OCR 오류 대응: 5'38 (큰따옴표 누락)
  m = text.match(/\b(\d{1,2})\s*'\s*(\d{2})\b/);
  if (m) return { paceMin: +m[1], paceSec: +m[2], paceRaw: `${m[1]}'${m[2]}"` };

  // 3) OCR 오류 대응: 7:00" (작은따옴표를 콜론으로 오인했으나 뒤에 큰따옴표가 있는 경우)
  m = text.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*"\b/);
  if (m) return { paceMin: +m[1], paceSec: +m[2], paceRaw: `${m[1]}'${m[2]}"` };

  return { paceMin: null, paceSec: null, paceRaw: null };
}

/* =========================
   6) Main Extraction Logic
========================= */
export async function extractAll(imgDataURL, { recordType = 'daily', debug = false } = {}) {
  const debugBag = { kmTexts: [], ptTexts: [], roiPaceTime: null };
  const T = await ensureTesseract();

  // (1) Distance (KM) - Multi-pass
  const roiDist = await cropDistanceROI(imgDataURL);
  const roiDistSharp = await unsharp(roiDist, 1.0); // 샤프닝 강화
  const roiDistBin = await preprocessImageToDataURL(roiDistSharp, { scale: 1.0, threshold: 190 });

  const kmCands = [];
  const kmOpts = {
    tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
    tessedit_char_whitelist: '0123456789.,'
  };

  // Distance Pass 1 & 2
  await Promise.all([
    T.recognize(roiDistSharp, 'eng', kmOpts).then(r => {
      numsFromText(r.data.text).forEach(o => kmCands.push({ ...o, src: 'roi-sharp', score: 10 }));
    }),
    T.recognize(roiDistBin, 'eng', kmOpts).then(r => {
      numsFromText(r.data.text).forEach(o => kmCands.push({ ...o, src: 'roi-bin', score: 10 }));
    })
  ]);

  const kmBest = groupKmCandidates(kmCands, 2)[0]?.val ?? null;

  // (2) Pace & Time - ROI Pinpoint
  // Daily 모드는 [Pace] [Time] [Cal] 한 줄에 있음. 이 줄만 핀포인트로 노림.
  const roiPT = await cropPaceTimeROI(imgDataURL);
  const roiPTSharp = await unsharp(roiPT, 0.8);
  const roiPTBin = await preprocessImageToDataURL(roiPTSharp, { scale: 1.0, threshold: 180 }); // 임계값 미세조정

  debugBag.roiPaceTime = { roiPT, roiPTSharp, roiPTBin };

  // Pace/Time Pass (PSM 7: Single Line 취급하여 한 줄 읽기 유도)
  // 레이블(Avg Pace 등)을 배제하고 숫자만 읽으므로 인식률 상승 기대
  const ptOpts = {
    tessedit_pageseg_mode: T.PSM.SINGLE_BLOCK, 
    tessedit_char_whitelist: "0123456789:'\"hmsHMS .",
  };

  const [res1, res2] = await Promise.all([
    T.recognize(roiPTSharp, 'eng', ptOpts),
    T.recognize(roiPTBin, 'eng', ptOpts)
  ]);

  // 두 결과 텍스트를 합쳐서 파싱 (보완)
  const combinedText = (res1.data.text + ' ' + res2.data.text);
  debugBag.ptTexts.push({ tag: 'combined', text: combinedText });

  const pRaw = parsePaceFromText(combinedText);
  let tRaw = parseTimeFromText(combinedText);

  // *Fallback Logic*: Time이 안 잡혔는데, Pace 파서가 1:56:30 같은 긴 시간을 Pace로 오인했을 리는 없지만,
  // 텍스트 덩어리에서 H:MM:SS가 Pace 정규식에 안 걸리고 Time 정규식에만 걸리도록 처리함.
  
  // 데이터 정제
  const km = (kmBest != null) ? clamp(kmBest, 0.1, 200) : 0;
  
  const out = {
    km,
    runs: null, // Daily 모드에선 안 씀
    paceMin: pRaw.paceMin,
    paceSec: pRaw.paceSec,
    timeH: tRaw.timeH,
    timeM: tRaw.timeM,
    timeS: tRaw.timeS,
    timeRaw: tRaw.timeRaw
  };

  if (debug) out._debug = debugBag;
  return out;
}

/* =========================
   7) Formatters
========================= */
export function formatPace(paceMin, paceSec) {
  if (paceMin == null || paceSec == null) return '';
  return `${parseInt(paceMin)}' ${zero2(parseInt(paceSec))}"`;
}

export function formatTime(timeH, timeM, timeS) {
  const h = timeH != null ? parseInt(timeH) : 0;
  const m = timeM != null ? parseInt(timeM) : 0;
  const s = timeS != null ? parseInt(timeS) : 0;
  if (h > 0) return `${h}:${zero2(m)}:${zero2(s)}`;
  return `${m}:${zero2(s)}`;
}
