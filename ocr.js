// js/ocr.js — SMART HYBRID OCR v3.4 (Ultimate Crop-Resistant Auto Detect)

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

// 2. 다크모드 대응 및 대비 강화 전처리
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

// 3. ✨ [궁극기] 일간/월간 모드 공간 지능 판별기
function autoDetectMode(data, width) {
    const fullText = data.text;
    
    // A. 텍스트 기반 1차 확인 (연도+월, 또는 Runs 글자 존재 여부)
    const datePatternKor = /20\d{2}\s*년\s*\d{1,2}\s*월/;
    const datePatternEng = /(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*20\d{2}/i;
    const runsPattern = /(?:^|\s)(\d{1,3})\s*(Runs|Run|러닝)/i;

    if (datePatternKor.test(fullText) || datePatternEng.test(fullText) || runsPattern.test(fullText)) {
        console.log("💡 [Auto Detect] '날짜' 또는 '러닝' 텍스트로 월간(Monthly) 모드 감지됨.");
        return 'monthly';
    }

    // B. [핵심] 공간 기반 2차 확인 (바짝 크롭된 이미지 대응)
    // 텍스트를 못 찾았더라도, 페이스(ex: 5'30")의 X 좌표가 화면 가운데(35% 이후)에 있다면 무조건 월간 모드!
    for (let word of data.words) {
        const text = cleanText(word.text);
        if (/\d{1,2}\s*['’]\s*\d{2}/.test(text)) {
            const cx = (word.bbox.x0 + word.bbox.x1) / 2;
            if (cx > width * 0.35) {
                console.log("💡 [Auto Detect] 상단이 잘렸으나 페이스가 가운데 위치하여 월간(Monthly) 모드로 감지됨.");
                return 'monthly';
            }
            break;
        }
    }
    
    console.log("💡 [Auto Detect] 일간(Daily) 기록으로 감지되었습니다.");
    return 'daily';
}

// 4. 전역 텍스트 파싱
function parseValues(data, width, height) {
  let results = {
    km: { val: 0, size: 0 },
    pace: { m: 0, s: 0 },
    time: { h: 0, m: 0, s: 0 },
    runs: { val: null }
  };

  const fullText = data.text;

  // [거리]
  data.lines.forEach(line => {
    const text = cleanText(line.text);
    const fontH = line.bbox.y1 - line.bbox.y0;
    const cy = (line.bbox.y0 + line.bbox.y1) / 2;

    if (/^[\d.,]+$/.test(text) && !/['":]/.test(text) && cy < height * 0.55) {
        if (fontH > results.km.size) {
            results.km = { val: parseNum(text), size: fontH };
        }
    }
  });

  // [페이스]
  const paceMatch = fullText.match(/(\d{1,2})\s*['’]\s*(\d{2})/);
  if (paceMatch) {
      results.pace = { m: parseInt(paceMatch[1]), s: parseInt(paceMatch[2]) };
  }

  // [시간]
  const timeMatch3 = fullText.match(/(\d{1,2})\s*[:;]\s*(\d{2})\s*[:;]\s*(\d{2})/);
  if (timeMatch3) {
      results.time = { h: parseInt(timeMatch3[1]), m: parseInt(timeMatch3[2]), s: parseInt(timeMatch3[3]) };
  } else {
      const timeMatches2 = [...fullText.matchAll(/(\d{1,2})\s*[:;]\s*(\d{2})/g)];
      for (const m of timeMatches2) {
          const mm = parseInt(m[1]), ss = parseInt(m[2]);
          if (results.pace.m === mm && results.pace.s === ss) continue;
          results.time = { h: 0, m: mm, s: ss };
          break;
      }
  }

  // [횟수 (Runs)]
  const runMatch = fullText.match(/(?:^|\s)(\d{1,3})\s*(Runs|Run|러닝)/i);
  if (runMatch) {
      results.runs = { val: parseInt(runMatch[1]) };
  } else {
      for (let word of data.words) {
          const text = cleanText(word.text);
          const cx = (word.bbox.x0 + word.bbox.x1) / 2;
          const cy = (word.bbox.y0 + word.bbox.y1) / 2;

          if (cy > height * 0.4 && cx < width * 0.45 && /^\d{1,3}$/.test(text)) {
              results.runs = { val: parseInt(text) };
              break; 
          }
      }
  }

  return results;
}

// 5. 지능형 수학 보정기
function dynamicDecimalGuard(rawKm, estKm) {
    if (!rawKm || !estKm) return rawKm;
    const diff = Math.abs(rawKm - estKm);
    
    if (diff > 0.8 && diff < 5.0) {
        const decRaw = rawKm % 1;
        const decEst = estKm % 1;
        if (Math.abs(decRaw - decEst) < 0.15) {
            const estInt = Math.round(estKm - decRaw);
            const fixedKm = parseFloat((estInt + decRaw).toFixed(2));
            return fixedKm;
        }
    }
    return rawKm;
}

// 6. 메인 실행 함수
window.extractAll = async function(imgDataURL, { recordType = 'auto' } = {}) {
  try {
    await ensureTesseract();
    
    const processedImg = await preprocessImage(imgDataURL);
    const { data } = await Tesseract.recognize(processedImg, 'eng+kor', {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT 
    });

    const imgObj = await toCanvas(processedImg);
    
    // ⚠️ 변경점: 자동 감지 함수에 data와 너비(width)를 함께 넘겨 공간까지 판별하게 함
    let currentMode = recordType;
    if (currentMode === 'auto') {
        currentMode = autoDetectMode(data, imgObj.w);
    }

    const parsed = parseValues(data, imgObj.w, imgObj.h);

    let km = parsed.km.val || 0;
    
    // 일간 모드일 경우 고도(Elevation) 숫자가 Runs로 착각되는 것을 완벽 방지
    let runs = currentMode === 'monthly' ? (parsed.runs.val || 0) : 1;
    
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

    const estKm = (totalTimeSec > 0 && totalPaceSec > 0) ? (totalTimeSec / totalPaceSec) : null;
    km = dynamicDecimalGuard(km, estKm);

    return {
      km: parseFloat(km.toFixed(2)),
      runs: runs,
      paceMin,
      paceSec,
      timeH, timeM, timeS,
      timeRaw: `${timeH > 0 ? timeH + ':' : ''}${String(timeM).padStart(2,'0')}:${String(timeS).padStart(2,'0')}`,
      detectedMode: currentMode
    };

  } catch (e) {
    console.error("SMART OCR Error:", e);
    return { km: 0, runs: 0, paceMin: 0, paceSec: 0, timeH: 0, timeM: 0, timeS: 0 };
  }
};
