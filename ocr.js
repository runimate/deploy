/* ocr.js — SMART OCR v2.0 (Geometry & Layout Context Aware) */

/* 1) Tesseract 로드 (CDN 백업) */
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

/* 2) 이미지 전처리 (캔버스 활용) */
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

// 흑백 대비 강화 및 스케일링
async function preprocessImage(imgDataURL){
  const {img, w, h} = await toCanvas(imgDataURL);
  
  // OCR 인식률 향상을 위해 이미지 확대 (최소 1500px 너비 확보)
  const scale = w < 1500 ? 2.5 : 1.5; 
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  
  // 흰 배경으로 초기화 (투명 PNG 대비)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,sw,sh);
  ctx.drawImage(img, 0, 0, sw, sh);

  const imageData = ctx.getImageData(0, 0, sw, sh);
  const d = imageData.data;
  
  // 그레이스케일 + 감마 보정 (흐릿한 텍스트 선명하게)
  for(let i=0; i<d.length; i+=4){
    let gray = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    // Contrast Stretching
    gray = (gray - 50) * 1.5; 
    if(gray < 0) gray = 0;
    if(gray > 255) gray = 255;
    
    // 이진화 (Thresholding) - 노이즈 제거
    const val = gray > 160 ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = val;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return c.toDataURL('image/png');
}

/* 3) 문자열 파싱 헬퍼 */
function cleanText(t){ return (t||'').replace(/[\u2018\u2019\u2032\u2035]/g,"'").replace(/[\u201C\u201D\u2033]/g,'"').trim(); }
function parseNum(t){ return parseFloat(t.replace(/,/g,'').replace(/O/gi,'0').replace(/l/gi,'1')); }

// 시간/페이스 정규식 파서
function parseTimeStr(str) {
  const s = cleanText(str).replace(/\s/g, ''); // 공백제거
  
  // Case 1: H:M:S (ex: 1:05:46)
  let m = s.match(/(\d{1,2})[:;](\d{2})[:;](\d{2})/);
  if(m) return { h: +m[1], m: +m[2], s: +m[3], raw: `${m[1]}:${m[2]}:${m[3]}` };

  // Case 2: Pace (ex: 6'28", 6'28)
  m = s.match(/(\d{1,2})['’](\d{2})["”]?/);
  if(m) return { m: +m[1], s: +m[2], raw: `${m[1]}'${m[2]}"` };

  // Case 3: M:S (ex: 23:28) - 보통 Time이나 Pace 둘 다 가능성 있음
  m = s.match(/(\d{1,2})[:;](\d{2})/);
  if(m) return { m: +m[1], s: +m[2], raw: `${m[1]}:${m[2]}` };

  return null;
}

/* 4) 지오메트리 분석 (위치 기반 데이터 매칭) */
function parseByGeometry(lines, width, height, recordType) {
  let candidates = {
    km: { val: 0, size: 0 },
    runs: { val: null, dist: 9999 }, // Daily일 땐 null 유지
    pace: { m:0, s:0, dist: 9999 },
    time: { h:0, m:0, s:0, dist: 9999 }
  };

  const KEYWORDS = {
    runs: /Runs|러닝|Run|Run.|Running/i,
    pace: /Pace|페이스|Avg|평균/i,
    time: /Time|시간|Duration/i
  };

  // 1. Distance 찾기 (가장 큰 숫자 & 상단 위치)
  lines.forEach(line => {
    const text = cleanText(line.text);
    const box = line.bbox;
    const h = box.y1 - box.y0; // 폰트 크기 추정
    
    // 숫자로만 구성된 텍스트 (소수점 포함)
    if (/^[\d.,]+$/.test(text) && text.length < 9) {
       // 상단 60% 영역 안에 있고, 기존 후보보다 폰트가 크면 갱신
       if (box.y0 < height * 0.6 && h > candidates.km.size) {
          candidates.km = { val: parseNum(text), size: h };
       }
    }
  });

  // 2. 라벨(키워드) 기반으로 값 찾기
  lines.forEach(line => {
    const text = cleanText(line.text);
    const cx = (line.bbox.x0 + line.bbox.x1) / 2;
    const cy = (line.bbox.y0 + line.bbox.y1) / 2;

    if (KEYWORDS.pace.test(text)) findNearest(lines, cx, cy, 'pace', candidates);
    if (KEYWORDS.time.test(text)) findNearest(lines, cx, cy, 'time', candidates);
    
    // Monthly 모드이거나, Daily라도 '러닝/Runs' 글자가 명확히 보이면 찾음
    if (KEYWORDS.runs.test(text)) {
        findNearest(lines, cx, cy, 'runs', candidates);
    }
  });

  return candidates;
}

// 라벨 근처의 값 찾기 (위/아래/옆 검색)
function findNearest(allLines, lx, ly, type, results) {
  allLines.forEach(target => {
    const t = cleanText(target.text);
    // 라벨 자신은 제외
    if(t.length < 1 || /Runs|Pace|Time|러닝|페이스|시간/i.test(t)) return;

    const tx = (target.bbox.x0 + target.bbox.x1) / 2;
    const ty = (target.bbox.y0 + target.bbox.y1) / 2;
    
    // 유클리드 거리 계산
    const dist = Math.sqrt(Math.pow(lx - tx, 2) + Math.pow(ly - ty, 2));
    
    // 너무 멀면 무시 (화면 높이의 20% 이상 떨어진 건 관계 없음)
    // 단, Daily 모드에서는 간격이 좁으므로 엄격하게 체크
    if (dist > 300) return; 

    // 타입별 검증
    if (type === 'runs') {
        // Runs는 정수여야 함 (Monthly: 13, Daily: 1)
        if (/^\d{1,3}$/.test(t) && !t.includes(':') && !t.includes("'")) {
             if (dist < results.runs.dist) results.runs = { val: parseInt(t), dist };
        }
    } else if (type === 'pace') {
        // 페이스: 6'30" 또는 6:30
        const p = parseTimeStr(t);
        // 페이스는 보통 시간이(Hour) 없음. 분:초 구조
        if (p && p.h === undefined && dist < results.pace.dist) {
             results.pace = { ...p, dist };
        }
    } else if (type === 'time') {
        // 시간: 1:05:46 또는 23:28
        const tm = parseTimeStr(t);
        if (tm && dist < results.time.dist) {
             results.time = { ...tm, dist };
        }
    }
  });
}

/* 5) 메인 함수 */
window.extractAll = async function(imgDataURL, { recordType='daily' } = {}){
  try {
    await ensureTesseract();
    const processedImg = await preprocessImage(imgDataURL);

    // OCR 실행 (한국어+영어)
    // PSM 11 (Sparse Text) 모드가 라벨/값 분리된 레이아웃에 최적
    const { data } = await Tesseract.recognize(processedImg, 'eng+kor', {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT 
    });

    const imgObj = await toCanvas(processedImg);
    const geo = parseByGeometry(data.lines, imgObj.w, imgObj.h, recordType);

    // 결과 정리
    let km = geo.km.val || 0;
    
    // Runs: Monthly면 필수, Daily면 없으면 null(또는 1)
    let runs = geo.runs.val;
    if (recordType === 'monthly' && runs === null) runs = 0; // 못 찾았으면 0
    if (recordType === 'daily' && runs === null) runs = 1;   // Daily는 기본 1

    let paceMin = geo.pace.m || 0;
    let paceSec = geo.pace.s || 0;
    
    let timeH = geo.time.h || 0;
    let timeM = geo.time.m || 0;
    let timeS = geo.time.s || 0;

    // 데이터 보정 (Missing Data Recovery)
    // 시간이 0인데, 거리와 페이스가 있다면 역산 (Time = Dist * Pace)
    if (timeH+timeM+timeS === 0 && km > 0 && (paceMin*60+paceSec) > 0) {
        const totalSec = Math.round(km * (paceMin*60 + paceSec));
        timeH = Math.floor(totalSec / 3600);
        timeM = Math.floor((totalSec % 3600) / 60);
        timeS = totalSec % 60;
    }
    // 페이스가 0인데, 거리와 시간이 있다면 역산 (Pace = Time / Dist)
    else if ((paceMin+paceSec) === 0 && km > 0 && (timeH*3600 + timeM*60 + timeS) > 0) {
        const totalSec = timeH*3600 + timeM*60 + timeS;
        const paceTotal = totalSec / km;
        paceMin = Math.floor(paceTotal / 60);
        paceSec = Math.round(paceTotal % 60);
    }

    return {
      km,
      runs: (recordType === 'monthly') ? runs : null, // Daily 요청이면 UI에 표시 안하므로 null 리턴
      paceMin,
      paceSec,
      timeH, timeM, timeS,
      timeRaw: `${timeH}:${String(timeM).padStart(2,'0')}:${String(timeS).padStart(2,'0')}`
    };

  } catch (e) {
    console.error("OCR Error:", e);
    // 에러 발생 시 기본값 반환하여 앱이 멈추지 않게 함
    return { km: 0, runs: 0, paceMin: 0, paceSec: 0, timeH: 0, timeM: 0, timeS: 0 };
  }
};
