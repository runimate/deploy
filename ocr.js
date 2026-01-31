/* ocr.js — SMART OCR v2.1 (RUNS Enhanced) */

/* 1) Tesseract 로드 */
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

/* 2) 이미지 전처리 */
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

async function toCanvas(imgDataURL){
  return new Promise((res, rej)=>{
    const img=new Image();
    img.crossOrigin = 'Anonymous';
    img.onload=()=>res({img, w:img.width, h:img.height});
    img.onerror=rej;
    img.src=imgDataURL;
  });
}

async function preprocessImage(imgDataURL){
  const {img, w, h} = await toCanvas(imgDataURL);
  
  // OCR 인식률 향상을 위해 이미지 확대
  const scale = w < 1500 ? 2.5 : 1.5; 
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,sw,sh);
  ctx.drawImage(img, 0, 0, sw, sh);

  const imageData = ctx.getImageData(0, 0, sw, sh);
  const d = imageData.data;
  
  // 그레이스케일 + 대비 강화
  for(let i=0; i<d.length; i+=4){
    let gray = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    gray = (gray - 50) * 1.5; 
    if(gray < 0) gray = 0;
    if(gray > 255) gray = 255;
    
    const val = gray > 160 ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = val;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return c.toDataURL('image/png');
}

/* 3) 파싱 헬퍼 */
function cleanText(t){ return (t||'').replace(/[\u2018\u2019\u2032\u2035]/g,"'").replace(/[\u201C\u201D\u2033]/g,'"').trim(); }
function parseNum(t){ return parseFloat(t.replace(/,/g,'').replace(/O/gi,'0').replace(/l/gi,'1')); }

function parseTimeStr(str) {
  const s = cleanText(str).replace(/\s/g, ''); 
  
  let m = s.match(/(\d{1,2})[:;](\d{2})[:;](\d{2})/); // H:M:S
  if(m) return { h: +m[1], m: +m[2], s: +m[3], raw: `${m[1]}:${m[2]}:${m[3]}` };

  m = s.match(/(\d{1,2})['’](\d{2})["”]?/); // Pace
  if(m) return { m: +m[1], s: +m[2], raw: `${m[1]}'${m[2]}"` };

  m = s.match(/(\d{1,2})[:;](\d{2})/); // M:S
  if(m) return { m: +m[1], s: +m[2], raw: `${m[1]}:${m[2]}` };

  return null;
}

/* 4) 지오메트리 & 레이아웃 분석 */
function parseByGeometry(lines, width, height, recordType) {
  let candidates = {
    km: { val: 0, size: 0 },
    runs: { val: null, dist: 9999 },
    pace: { m:0, s:0, dist: 9999 },
    time: { h:0, m:0, s:0, dist: 9999 }
  };

  const KEYWORDS = {
    runs: /Runs|러닝|Run|Running/i,
    pace: /Pace|페이스|Avg|평균/i,
    time: /Time|시간|Duration/i
  };

  // 1. Distance (가장 큰 숫자)
  lines.forEach(line => {
    const text = cleanText(line.text);
    const box = line.bbox;
    const h = box.y1 - box.y0; 
    
    // 숫자이면서 길이가 적당한 것 (소수점 포함)
    if (/^[\d.,]+$/.test(text) && text.length < 9) {
       // 화면 상단 60% 영역 & 가장 큰 폰트
       if (box.y0 < height * 0.6 && h > candidates.km.size) {
          candidates.km = { val: parseNum(text), size: h };
       }
    }
  });

  // 2. 키워드 기반 값 찾기
  lines.forEach(line => {
    let text = cleanText(line.text);
    const cx = (line.bbox.x0 + line.bbox.x1) / 2;
    const cy = (line.bbox.y0 + line.bbox.y1) / 2;

    // [강화된 Runs 로직]
    if (KEYWORDS.runs.test(text)) {
        // Case A: "24 Runs" 처럼 같은 줄에 숫자가 있는 경우
        const inlineMatch = text.match(/^(\d{1,3})\s*(Runs|Run|러닝)/i);
        if (inlineMatch) {
            candidates.runs = { val: parseInt(inlineMatch[1]), dist: 0 };
        } 
        // Case B: 같은 줄에 숫자가 뒤에 있는 경우 "Runs 24"
        else {
            const inlineMatchBack = text.match(/(Runs|Run|러닝)\s*(\d{1,3})/i);
            if (inlineMatchBack) {
                candidates.runs = { val: parseInt(inlineMatchBack[2]), dist: 0 };
            } 
            // Case C: 숫자가 다른 줄에 있는 경우 (가장 가까운 이웃 탐색)
            else {
                findNearest(lines, cx, cy, 'runs', candidates);
            }
        }
    }

    if (KEYWORDS.pace.test(text)) findNearest(lines, cx, cy, 'pace', candidates);
    if (KEYWORDS.time.test(text)) findNearest(lines, cx, cy, 'time', candidates);
  });

  return candidates;
}

// 이웃 값 찾기 (거리 기반)
function findNearest(allLines, lx, ly, type, results) {
  allLines.forEach(target => {
    const t = cleanText(target.text);
    // 라벨 키워드가 포함된 줄은 값으로 쓰지 않음 (단, 숫자만 딱 있는 경우는 허용)
    if (/Runs|Pace|Time|러닝|페이스|시간/i.test(t)) return;

    const tx = (target.bbox.x0 + target.bbox.x1) / 2;
    const ty = (target.bbox.y0 + target.bbox.y1) / 2;
    
    // 거리 계산
    const dist = Math.sqrt(Math.pow(lx - tx, 2) + Math.pow(ly - ty, 2));
    
    // 너무 멀면 패스
    if (dist > 400) return;

    if (type === 'runs') {
        // Runs는 정수 (1~3자리)
        if (/^\d{1,3}$/.test(t) && !t.includes(':') && !t.includes("'")) {
             // 기존보다 더 가까우면 갱신
             if (dist < results.runs.dist) {
                 results.runs = { val: parseInt(t), dist };
             }
        }
    } else if (type === 'pace') {
        const p = parseTimeStr(t);
        if (p && p.h === undefined && dist < results.pace.dist) {
             results.pace = { ...p, dist };
        }
    } else if (type === 'time') {
        const tm = parseTimeStr(t);
        if (tm && dist < results.time.dist) {
             results.time = { ...tm, dist };
        }
    }
  });
}

/* 5) 메인 실행 함수 */
window.extractAll = async function(imgDataURL, { recordType='daily' } = {}){
  try {
    await ensureTesseract();
    const processedImg = await preprocessImage(imgDataURL);

    // 한글+영어 + Sparse Text 모드
    const { data } = await Tesseract.recognize(processedImg, 'eng+kor', {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT 
    });

    const imgObj = await toCanvas(processedImg);
    // 지오메트리 분석 실행
    const geo = parseByGeometry(data.lines, imgObj.w, imgObj.h, recordType);

    // 결과 매핑
    let km = geo.km.val || 0;
    
    // Runs 처리 로직
    let runs = geo.runs.val;
    
    // Monthly인데 OCR이 못 찾았다면?
    // fallback: 전체 텍스트에서 정규식으로 한번 더 훑기
    if (recordType === 'monthly' && runs === null) {
        const fullText = data.text || '';
        const regexMatch = fullText.match(/(\d{1,3})\s*(Runs|Run|러닝)/i);
        if (regexMatch) {
            runs = parseInt(regexMatch[1]);
        } else {
            runs = 0; // 정말 없으면 0
        }
    }
    // Daily는 기본 1회
    if (recordType === 'daily') runs = 1;

    let paceMin = geo.pace.m || 0;
    let paceSec = geo.pace.s || 0;
    let timeH = geo.time.h || 0;
    let timeM = geo.time.m || 0;
    let timeS = geo.time.s || 0;

    // 데이터 상호 보정 (누락된 값 채우기)
    // Time = Dist * Pace
    if (timeH+timeM+timeS === 0 && km > 0 && (paceMin*60+paceSec) > 0) {
        const totalSec = Math.round(km * (paceMin*60 + paceSec));
        timeH = Math.floor(totalSec / 3600);
        timeM = Math.floor((totalSec % 3600) / 60);
        timeS = totalSec % 60;
    }
    // Pace = Time / Dist
    else if ((paceMin+paceSec) === 0 && km > 0 && (timeH*3600 + timeM*60 + timeS) > 0) {
        const totalSec = timeH*3600 + timeM*60 + timeS;
        const paceTotal = totalSec / km;
        paceMin = Math.floor(paceTotal / 60);
        paceSec = Math.round(paceTotal % 60);
    }

    return {
      km,
      runs: (recordType === 'monthly') ? runs : null,
      paceMin,
      paceSec,
      timeH, timeM, timeS,
      timeRaw: `${timeH}:${String(timeM).padStart(2,'0')}:${String(timeS).padStart(2,'0')}`
    };

  } catch (e) {
    console.error("OCR Error:", e);
    return { km: 0, runs: 0, paceMin: 0, paceSec: 0, timeH: 0, timeM: 0, timeS: 0 };
  }
};
