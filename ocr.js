// js/ocr.js — SMART HYBRID OCR v3.1 (Auto-Invert & Math Guard)

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

// 2. 캔버스 변환 유틸
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

// 3. 다크모드 대응 및 대비 강화 전처리 (매우 중요)
async function preprocessImage(imgDataURL) {
  const { img, w, h } = await toCanvas(imgDataURL);
  const scale = w < 1000 ? 2.5 : 1.5; 
  const sw = Math.round(w * scale), sh = Math.round(h * scale);

  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const d = imageData.data;
  
  // A. 다크모드/라이트모드 판별 (평균 밝기 계산)
  let totalLuma = 0;
  for (let i = 0; i < d.length; i += 4) {
      totalLuma += d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
  }
  const isDarkMode = (totalLuma / (sw * sh)) < 127;

  // B. 이진화 및 극단적 대비 처리 (항상 흰 배경에 검은 글씨로 통일)
  for (let i = 0; i < d.length; i += 4) {
    let gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    
    if (isDarkMode) {
        gray = 255 - gray; // 다크모드면 색상을 반전시킴
    }
    
    gray = (gray - 50) * 1.8; // 대비 강화
    const val = gray > 140 ? 255 : 0; // 이진화
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return c.toDataURL('image/png');
}

// 4. 텍스트 정제
function cleanText(t) { return (t || '').replace(/[\u2018\u2019\u2032\u2035]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').trim(); }
function parseNum(t) { return parseFloat(t.replace(/,/g, '').replace(/O/gi, '0').replace(/l/gi, '1')); }

// 5. 전역 텍스트 파싱 (시간과 페이스 꼬임 방지)
function parseValues(fullText, lines, height) {
  let results = {
    km: { val: 0, size: 0 },
    pace: { m: 0, s: 0 },
    time: { h: 0, m: 0, s: 0 },
    runs: { val: null }
  };

  // [거리] 화면 상단에서 폰트가 가장 큰 숫자
  lines.forEach(line => {
    const text = cleanText(line.text);
    const fontH = line.bbox.y1 - line.bbox.y0;
    const cy = (line.bbox.y0 + line.bbox.y1) / 2;

    if (/^[\d.,]+$/.test(text) && !/['":]/.test(text) && cy < height * 0.5) {
        if (fontH > results.km.size) {
            results.km = { val: parseNum(text), size: fontH };
        }
    }
  });

  // [페이스] 전체 텍스트에서 ' 기호 검색 (ex: 5'59")
  const paceMatch = fullText.match(/(\d{1,2})\s*['’]\s*(\d{2})/);
  if (paceMatch) {
      results.pace = { m: parseInt(paceMatch[1]), s: parseInt(paceMatch[2]) };
  }

  // [시간] 전체 텍스트에서 : 기호 검색 (페이스와 절대 중복되지 않게)
  const timeMatch3 = fullText.match(/(\d{1,2})\s*[:;]\s*(\d{2})\s*[:;]\s*(\d{2})/);
  if (timeMatch3) {
      results.time = { h: parseInt(timeMatch3[1]), m: parseInt(timeMatch3[2]), s: parseInt(timeMatch3[3]) };
  } else {
      // MM:SS 추출 (페이스 값과 동일하면 무시)
      const timeMatches2 = [...fullText.matchAll(/(\d{1,2})\s*[:;]\s*(\d{2})/g)];
      for (const m of timeMatches2) {
          const mm = parseInt(m[1]), ss = parseInt(m[2]);
          if (results.pace.m === mm && results.pace.s === ss) continue;
          results.time = { h: 0, m: mm, s: ss };
          break;
      }
  }

  // [횟수] Runs
  const runMatch = fullText.match(/(\d{1,3})\s*(Runs|Run|러닝)/i);
  if (runMatch) results.runs = { val: parseInt(runMatch[1]) };

  return results;
}

// 6. 지능형 수학 보정기 (5->3, 10->7 등 앞자리 오인식 완벽 보정)
function dynamicDecimalGuard(rawKm, estKm) {
    if (!rawKm || !estKm) return rawKm;
    const diff = Math.abs(rawKm - estKm);
    
    // 오차가 0.8 ~ 5.0 사이로 크게 난 경우 (앞자리 착각)
    if (diff > 0.8 && diff < 5.0) {
        const decRaw = rawKm % 1;
        const decEst = estKm % 1;
        
        // 소수점 차이가 0.15 이내라면 앞자리만 틀린 것이 확실함!
        if (Math.abs(decRaw - decEst) < 0.15) {
            const estInt = Math.round(estKm - decRaw);
            const fixedKm = parseFloat((estInt + decRaw).toFixed(2));
            console.log(`[Math Guard 발동] ${rawKm}km -> ${fixedKm}km 로 보정되었습니다.`);
            return fixedKm;
        }
    }
    return rawKm;
}

// 7. 메인 실행 함수 (Window 객체에 등록)
window.extractAll = async function(imgDataURL, { recordType = 'daily' } = {}) {
  try {
    await ensureTesseract();
    
    const processedImg = await preprocessImage(imgDataURL);
    const { data } = await Tesseract.recognize(processedImg, 'eng+kor', {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT 
    });

    const imgObj = await toCanvas(processedImg);
    
    // 파싱 실행
    const parsed = parseValues(data.text, data.lines, imgObj.h);

    let km = parsed.km.val || 0;
    let runs = recordType === 'monthly' ? (parsed.runs.val || 0) : 1;
    let paceMin = parsed.pace.m;
    let paceSec = parsed.pace.s;
    let timeH = parsed.time.h;
    let timeM = parsed.time.m;
    let timeS = parsed.time.s;

    const totalPaceSec = (paceMin * 60) + paceSec;
    const totalTimeSec = (timeH * 3600) + (timeM * 60) + timeS;
    
    // 누락 데이터 수학적 채우기
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

    // 최종 교차 검증 (Distance 수학적 보정)
    const estKm = (totalTimeSec > 0 && totalPaceSec > 0) ? (totalTimeSec / totalPaceSec) : null;
    km = dynamicDecimalGuard(km, estKm);

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
