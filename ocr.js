// js/ocr.js — SMART HYBRID OCR v4.1 (Mode-Aware Layout & Math Guard)

// 1. Tesseract 로드
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

// 2. 캔버스 및 전처리 유틸리티 (다크모드 완벽 대응)
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

async function preprocessImage(imgDataURL) {
  const { img, w, h } = await toCanvas(imgDataURL);
  const scale = w < 1000 ? 2.5 : 1.5; 
  const sw = Math.round(w * scale), sh = Math.round(h * scale);

  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const d = imageData.data;
  
  let totalLuma = 0;
  for (let i = 0; i < d.length; i += 4) {
      totalLuma += d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
  }
  const isDarkMode = (totalLuma / (sw * sh)) < 127;

  for (let i = 0; i < d.length; i += 4) {
    let gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (isDarkMode) gray = 255 - gray; 
    
    gray = (gray - 50) * 1.8;
    const val = gray > 140 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return c.toDataURL('image/png');
}

function cleanText(t) { return (t || '').replace(/[\u2018\u2019\u2032\u2035]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').trim(); }
function parseNum(t) { return parseFloat(t.replace(/,/g, '').replace(/O/gi, '0').replace(/l/gi, '1')); }

// 3. ✨ 핵심: 모드(일간/월간)에 따른 맞춤형 공간 파싱
function parseByLayout(lines, width, height, recordType) {
  let results = {
    km: { val: 0, size: 0 },
    pace: { m: 0, s: 0 },
    time: { h: 0, m: 0, s: 0 },
    runs: { val: null }
  };

  lines.forEach(line => {
    const text = cleanText(line.text);
    const box = line.bbox;
    const cx = (box.x0 + box.x1) / 2; 
    const cy = (box.y0 + box.y1) / 2; 
    const fontH = box.y1 - box.y0;    

    // A. 거리 (KM) - 화면 위쪽 45%
    if (cy < height * 0.45 && /^[\d.,]+$/.test(text) && !/['":]/.test(text)) {
        if (fontH > results.km.size) {
            results.km = { val: parseNum(text), size: fontH };
        }
    }

    // B. 하단 데이터 영역 (화면 45% ~ 85%)
    if (cy > height * 0.45 && cy < height * 0.85) {
        
        const match2 = text.match(/(\d{1,2})[^\d]+(\d{2})/); // 페이스 또는 MM:SS
        const match3 = text.match(/(\d{1,2})[^\d]+(\d{2})[^\d]+(\d{2})/); // H:MM:SS
        const isJustNumber = /^\d{1,3}$/.test(text); // 기호 없는 순수 숫자 (Runs 후보)

        // X 좌표를 기준으로 왼쪽, 가운데, 오른쪽 3등분
        let zone = '';
        if (cx < width * 0.35) zone = 'left';
        else if (cx < width * 0.65) zone = 'center';
        else zone = 'right';

        if (recordType === 'monthly') {
            // [월간 모드] 좌: Runs / 중: Pace / 우: Time
            if (zone === 'left' && isJustNumber) {
                results.runs = { val: parseInt(text) };
            }
            if (zone === 'center' && match2 && !match3) {
                results.pace = { m: parseInt(match2[1]), s: parseInt(match2[2]) };
            }
            if (zone === 'right') {
                if (match3) results.time = { h: parseInt(match3[1]), m: parseInt(match3[2]), s: parseInt(match3[3]) };
                else if (match2) results.time = { h: 0, m: parseInt(match2[1]), s: parseInt(match2[2]) };
            }
        } else {
            // [일간 모드] 좌: Pace / 중: Time / 우: Calories(무시)
            if (zone === 'left' && match2 && !match3) {
                results.pace = { m: parseInt(match2[1]), s: parseInt(match2[2]) };
            }
            if (zone === 'center') {
                if (match3) results.time = { h: parseInt(match3[1]), m: parseInt(match3[2]), s: parseInt(match3[3]) };
                else if (match2) results.time = { h: 0, m: parseInt(match2[1]), s: parseInt(match2[2]) };
            }
        }
    }

    // C. 백업: 한 줄에 "22 Runs" 형태로 예쁘게 붙어있을 경우
    const runMatch = text.match(/(\d{1,3})\s*(Runs|Run|러닝)/i);
    if (runMatch) results.runs = { val: parseInt(runMatch[1]) };
  });

  return results;
}

// 4. 수학적 교차 검증 보정기
function dynamicMathGuard(ocrKm, calcKm) {
    if (!ocrKm || !calcKm) return ocrKm;
    const diff = Math.abs(ocrKm - calcKm);
    
    if (diff > 0.8 && diff < 5.0) {
        const decOcr = ocrKm % 1;
        const decCalc = calcKm % 1;
        
        if (Math.abs(decOcr - decCalc) < 0.1) {
            const fixedKm = parseFloat(calcKm.toFixed(2));
            console.log(`[Math Guard 🚀] ${ocrKm}km -> ${fixedKm}km 로 자동 보정됨!`);
            return fixedKm;
        }
    }
    return ocrKm;
}

// 5. 메인 파이프라인
window.extractAll = async function(imgDataURL, { recordType = 'daily' } = {}) {
  try {
    await ensureTesseract();
    
    const processedImg = await preprocessImage(imgDataURL);
    const { data } = await Tesseract.recognize(processedImg, 'eng+kor', {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT 
    });

    const imgObj = await toCanvas(processedImg);
    
    // 파싱 함수에 recordType을 넘겨주어 레이아웃 기준을 다르게 적용
    const parsed = parseByLayout(data.lines, imgObj.w, imgObj.h, recordType);

    let km = parsed.km.val || 0;
    let runs = recordType === 'monthly' ? (parsed.runs.val || 0) : 1;
    let paceMin = parsed.pace.m;
    let paceSec = parsed.pace.s;
    let timeH = parsed.time.h;
    let timeM = parsed.time.m;
    let timeS = parsed.time.s;

    const totalPaceSec = (paceMin * 60) + paceSec;
    const totalTimeSec = (timeH * 3600) + (timeM * 60) + timeS;
    
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

    const calcKm = (totalTimeSec > 0 && totalPaceSec > 0) ? (totalTimeSec / totalPaceSec) : null;
    km = dynamicMathGuard(km, calcKm);

    return {
      km: parseFloat(km.toFixed(2)),
      runs: runs,
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
