// js/ocr.js — SMART HYBRID OCR v3.0 (V1 Geometry + V2.2 Guards)

/* ------------------------------------------------------------------
   1) Tesseract 로드 (인식률이 입증된 v5 사용)
------------------------------------------------------------------ */
async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Tesseract.js'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  return window.Tesseract;
}

/* ------------------------------------------------------------------
   2) 캔버스 및 이미지 전처리 유틸리티 (V.2.2의 고급 필터)
------------------------------------------------------------------ */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

async function toCanvas(imgDataURL) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => res({ img, w: img.width, h: img.height });
    img.onerror = rej;
    img.src = imgDataURL;
  });
}

// 이미지 선명화 (Unsharp Mask - 숫자의 경계선을 뚜렷하게)
async function unsharp(img, w, h, amount = 0.9) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const i = (y * w + x) * 4, j = (y * w + x - 1) * 4;
      d[i] = Math.min(255, Math.max(0, d[i] + amount * (d[i] - d[j])));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + amount * (d[i + 1] - d[j + 1])));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + amount * (d[i + 2] - d[j + 2])));
    }
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

// V.1 방식의 강력한 이진화(Binarization) 결합
async function preprocessImage(imgDataURL) {
  const { img, w, h } = await toCanvas(imgDataURL);
  const scale = w < 1500 ? 2.5 : 1.5; 
  const sw = Math.round(w * scale), sh = Math.round(h * scale);

  const sharpenedCanvas = await unsharp(img, sw, sh, 1.2);
  const ctx = sharpenedCanvas.getContext('2d', { willReadFrequently: true });
  
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const d = imageData.data;
  
  for (let i = 0; i < d.length; i += 4) {
    let gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    gray = (gray - 50) * 1.5; // V.1의 강력한 대비 향상
    const val = gray > 150 ? 255 : 0; // 흑백 문턱값
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return sharpenedCanvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------
   3) 텍스트 파싱 헬퍼 (정규식 기반)
------------------------------------------------------------------ */
function cleanText(t) { return (t || '').replace(/[\u2018\u2019\u2032\u2035]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').trim(); }
function parseNum(t) { return parseFloat(t.replace(/,/g, '').replace(/O/gi, '0').replace(/l/gi, '1')); }

function parseTimeStr(str) {
  const s = cleanText(str).replace(/\s/g, ''); 
  let m = s.match(/(\d{1,2})[:;](\d{2})[:;](\d{2})/); // H:M:S
  if (m) return { h: +m[1], m: +m[2], s: +m[3] };
  m = s.match(/(\d{1,2})['’](\d{2})["”]?/); // Pace
  if (m) return { m: +m[1], s: +m[2] };
  m = s.match(/(\d{1,2})[:;](\d{2})/); // M:S
  if (m) return { m: +m[1], s: +m[2] };
  return null;
}

/* ------------------------------------------------------------------
   4) V.1 핵심 엔진: 지오메트리(좌표/크기) 분석
------------------------------------------------------------------ */
function parseByGeometry(lines, width, height) {
  let candidates = {
    km: { val: 0, size: 0 },
    runs: { val: null, dist: 9999 },
    pace: { m: 0, s: 0, dist: 9999 },
    time: { h: 0, m: 0, s: 0, dist: 9999 }
  };

  const KEYWORDS = {
    runs: /Runs|러닝|Run|Running/i,
    pace: /Pace|페이스|Avg|평균/i,
    time: /Time|시간|Duration/i
  };

  // 1. 거리는 화면 상단 60% 안에서 폰트가 가장 큰 숫자! (V.1의 성공 비결)
  lines.forEach(line => {
    const text = cleanText(line.text);
    const box = line.bbox;
    const h = box.y1 - box.y0; 
    
    if (/^[\d.,]+$/.test(text) && text.length < 8) {
       if (box.y0 < height * 0.6 && h > candidates.km.size) {
          candidates.km = { val: parseNum(text), size: h };
       }
    }
  });

  // 2. 키워드 주변의 숫자를 탐색 (가장 가까운 거리 매칭)
  lines.forEach(line => {
    let text = cleanText(line.text);
    const cx = (line.bbox.x0 + line.bbox.x1) / 2;
    const cy = (line.bbox.y0 + line.bbox.y1) / 2;

    if (KEYWORDS.runs.test(text)) {
        const inlineMatch = text.match(/(\d{1,3})\s*(Runs|Run|러닝)/i);
        if (inlineMatch) candidates.runs = { val: parseInt(inlineMatch[1]), dist: 0 };
        else findNearest(lines, cx, cy, 'runs', candidates);
    }
    if (KEYWORDS.pace.test(text)) findNearest(lines, cx, cy, 'pace', candidates);
    if (KEYWORDS.time.test(text)) findNearest(lines, cx, cy, 'time', candidates);
  });

  return candidates;
}

function findNearest(allLines, lx, ly, type, results) {
  allLines.forEach(target => {
    const t = cleanText(target.text);
    if (/Runs|Pace|Time|러닝|페이스|시간/i.test(t)) return;

    const tx = (target.bbox.x0 + target.bbox.x1) / 2;
    const ty = (target.bbox.y0 + target.bbox.y1) / 2;
    const dist = Math.sqrt(Math.pow(lx - tx, 2) + Math.pow(ly - ty, 2));
    
    if (dist > 400) return;

    if (type === 'runs' && /^\d{1,3}$/.test(t) && dist < results.runs.dist) {
        results.runs = { val: parseInt(t), dist };
    } else if (type === 'pace') {
        const p = parseTimeStr(t);
        if (p && p.h === undefined && dist < results.pace.dist) results.pace = { ...p, dist };
    } else if (type === 'time') {
        const tm = parseTimeStr(t);
        if (tm && dist < results.time.dist) results.time = { ...tm, dist };
    }
  });
}

/* ------------------------------------------------------------------
   5) V.2.2 고급 방어 로직: 5-Guard (2,3을 5로 오인식하는 현상 방지)
------------------------------------------------------------------ */
function applyFiveGuard(rawKm, estKm) {
  // 수학적으로 계산된 거리(estKm)가 5.xx인데, OCR이 2.xx나 3.xx로 읽었다면 5로 강제 보정
  if (!rawKm || !estKm) return rawKm;
  const intPart = Math.floor(rawKm);
  
  if ((intPart === 2 || intPart === 3) && (estKm >= 4.85 && estKm <= 5.30)) {
    console.log(`[5-Guard 발동] ${rawKm} -> 5.xx 대역으로 보정됨`);
    return 5 + (rawKm - intPart);
  }
  return rawKm;
}


/* ------------------------------------------------------------------
   6) 메인 추출 파이프라인 (window 전역 함수로 연결)
------------------------------------------------------------------ */
window.extractAll = async function(imgDataURL, { recordType = 'daily' } = {}) {
  try {
    await ensureTesseract();
    
    // 1단계: 강력한 전처리
    const processedImg = await preprocessImage(imgDataURL);

    // 2단계: 문자 인식 (SPARSE_TEXT로 흩어진 텍스트 모두 캡처)
    const { data } = await Tesseract.recognize(processedImg, 'eng+kor', {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT 
    });

    const imgObj = await toCanvas(processedImg);
    
    // 3단계: V.1 지오메트리 엔진으로 위치 기반 값 추출
    const geo = parseByGeometry(data.lines, imgObj.w, imgObj.h);

    let km = geo.km.val || 0;
    let runs = geo.runs.val;
    let paceMin = geo.pace.m || 0;
    let paceSec = geo.pace.s || 0;
    let timeH = geo.time.h || 0;
    let timeM = geo.time.m || 0;
    let timeS = geo.time.s || 0;

    // Monthly 백업 로직 (못 찾았을 경우 정규식으로 한 번 더)
    if (recordType === 'monthly' && runs === null) {
        const fullText = data.text || '';
        const regexMatch = fullText.match(/(\d{1,3})\s*(Runs|Run|러닝)/i);
        runs = regexMatch ? parseInt(regexMatch[1]) : 0;
    }
    if (recordType === 'daily') runs = 1;

    // 4단계: V.1의 강력한 '데이터 상호 보정' 로직 (수학적 검증)
    const totalPaceSec = (paceMin * 60) + paceSec;
    const totalTimeSec = (timeH * 3600) + (timeM * 60) + timeS;
    
    // 페이스나 시간이 비어있을 경우 역산하여 채움
    if (totalTimeSec === 0 && km > 0 && totalPaceSec > 0) {
        const calcSec = Math.round(km * totalPaceSec);
        timeH = Math.floor(calcSec / 3600);
        timeM = Math.floor((calcSec % 3600) / 60);
        timeS = calcSec % 60;
    } else if (totalPaceSec === 0 && km > 0 && totalTimeSec > 0) {
        const calcPace = Math.round(totalTimeSec / km);
        paceMin = Math.floor(calcPace / 60);
        paceSec = calcPace % 60;
    }

    // 5단계: V.2.2의 5-Guard 적용 (수학적 거리가 5km대일 경우 오인식 방어)
    const estKm = (totalTimeSec > 0 && totalPaceSec > 0) ? (totalTimeSec / totalPaceSec) : null;
    km = applyFiveGuard(km, estKm);

    // 최종 결과 반환
    return {
      km: parseFloat(km.toFixed(2)),
      runs: (recordType === 'monthly') ? runs : null,
      paceMin,
      paceSec,
      timeH, timeM, timeS,
      timeRaw: `${timeH > 0 ? timeH + ':' : ''}${String(timeM).padStart(2,'0')}:${String(timeS).padStart(2,'0')}`
    };

  } catch (e) {
    console.error("SMART OCR Error:", e);
    return { km: 0, runs: 0, paceMin: 0, paceSec: 0, timeH: 0, timeM: 0, timeS: 0 };
  }
};
