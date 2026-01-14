/* ocr.js — FAST OCR (High Performance Version) */

/* 1) Tesseract 로드 확인 */
async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  // CDN이 HTML 헤더에 없을 경우를 대비한 백업 로드
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

/* 2) 캔버스 유틸 & 전처리 (사용자님 원본 로직) */
function toImage(src){ return new Promise((res, rej)=>{ const img=new Image(); img.crossOrigin = 'Anonymous'; img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

async function toCanvas(imgDataURL){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res({img, w:img.width, h:img.height});
    img.src=imgDataURL;
  });
}

// 고급 전처리: 스케일링 + 이진화
async function preprocessImageToDataURL(imgDataURL, scale = 2.4, threshold = 190){
  const {img, w:W, h:H} = await toCanvas(imgDataURL);
  const w = Math.round(W*scale), h = Math.round(H*scale);
  const c = makeCanvas(w,h);
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img,0,0,w,h);
  const im=ctx.getImageData(0,0,w,h), d=im.data;
  for(let i=0;i<d.length;i+=4){
    const g = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    const v = g>threshold ? 255 : 0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return c.toDataURL('image/png');
}

// 선명화 필터 (Unsharp Mask)
async function unsharp(srcDataURL, amount=0.9){
  const {img,w,h} = await toCanvas(srcDataURL);
  const c=makeCanvas(w,h), ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const im=ctx.getImageData(0,0,w,h), d=im.data;
  for(let y=0;y<h;y++){
    for(let x=1;x<w;x++){
      const i=(y*w+x)*4, j=(y*w+x-1)*4;
      d[i]   = Math.min(255, Math.max(0, d[i]   + amount*(d[i]   - d[j])));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + amount*(d[i+1] - d[j+1])));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + amount*(d[i+2] - d[j+2])));
    }
  }
  ctx.putImageData(im,0,0);
  return c.toDataURL('image/png');
}

// 상단 숫자 영역 크롭 (ROI)
async function cropTopNumberROI(imgDataURL, topPct=0.06, heightPct=0.30, sidePct=0.06, scale=2.8){
  const {img, w, h} = await toCanvas(imgDataURL);
  const x = Math.round(w*sidePct);
  const y = Math.round(h*topPct);
  const cw = Math.round(w*(1-2*sidePct));
  const ch = Math.round(h*heightPct);
  const c = makeCanvas(Math.round(cw*scale), Math.round(ch*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,x,y,cw,ch,0,0,c.width,c.height);
  return c.toDataURL('image/png');
}

/* 3) 파서 유틸 */
function normalizeOCR(s){
  return (s||'').replace(/[\u2018\u2019\u2032\u2035]/g,"'").replace(/[\u201C\u201D\u2033]/g,'"').replace(/[·•]/g,'.').replace(/\u200B|\u00A0/g,' ').replace(/[ ]{2,}/g,' ').trim();
}
function zero2(n){ return String(n).padStart(2,'0'); }
function numsFromText(s){
  const t = normalizeOCR(s||'');
  const m = t.match(/\b\d{1,3}[.,]\d{1,2}\b/g) || [];
  return m.map(x => ({ val: parseFloat(x.replace(',','.')), dec: (x.split(/[.,]/)[1]||'').length }));
}
function kmCandidatesFromWords(words){
  if(!Array.isArray(words) || !words.length) return [];
  const lines = new Map();
  for(const w of words){
    const id = w.line ?? `y${Math.round(((w.bbox?.y0||0)+(w.bbox?.y1||0))/2)}`;
    const h  = (w.bbox ? Math.max(0,(w.bbox.y1 - w.bbox.y0)) : 0);
    const t  = (w.text||'').trim();
    if(!lines.has(id)) lines.set(id, { text:[], maxH:0 });
    const L = lines.get(id);
    L.text.push(t);
    L.maxH = Math.max(L.maxH, h);
  }
  const arr = [...lines.values()].sort((a,b)=> b.maxH - a.maxH).slice(0,4);
  const out=[];
  for(const L of arr){
    const joined = L.text.join(' ');
    const onlyNum = L.text.filter(t=>/^[0-9.,]+$/.test(t)).join('');
    numsFromText(joined).concat(numsFromText(onlyNum)).forEach(o=> out.push({ ...o, src:'word-top', score:L.maxH }));
  }
  return out;
}

function parseFromOCR(textRaw){
  const text = normalizeOCR(textRaw);
  const paceMatch = text.match(/\b(\d{1,2})\s*'\s*(\d{2})\s*"?\b/);
  let timeH=null,timeM=null,timeS=null,timeRaw=null;
  let m = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  if(m){ timeH=+m[1]; timeM=+m[2]; timeS=+m[3]; timeRaw=`${zero2(timeH)}:${zero2(timeM)}:${zero2(timeS)}`; }
  else{ m = text.match(/\b(\d{1,2}):(\d{2})\b/); if(m){ timeM=+m[1]; timeS=+m[2]; timeRaw=`${zero2(timeM)}:${zero2(timeS)}`; } }

  let kmFromLabel = null;
  const idx = text.search(/킬로미터|kilometer/i);
  if (idx !== -1) {
    const before = text.slice(Math.max(0, idx - 60), idx);
    const mKm = before.match(/(\d{1,3})[.,](\d{1,2})/);
    if(mKm) kmFromLabel = mKm[0];
  }

  // Runs 파싱
  const runs = (() => {
    const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for(let i=0;i<lines.length;i++){
      const L = lines[i];
      if (/^(Runs?|러닝)\b/i.test(L)){
        const prev = lines[i-1]||"", next = lines[i+1]||"";
        let mm;
        if ((mm = prev.match(/^\s*(\d{1,3})\s*$/))) return +mm[1];
        if ((mm = next.match(/^\s*(\d{1,3})\s*$/))) return +mm[1];
        if ((mm = L.match(/\b(\d{1,3})\b/)))       return +mm[1];
      }
    }
    return null;
  })();

  return { km: kmFromLabel ? parseFloat(kmFromLabel.replace(',','.')) : null, runs, paceMin: paceMatch ? +paceMatch[1] : null, paceSec: paceMatch ? +paceMatch[2] : null, timeH, timeM, timeS, timeRaw };
}

/* 4) 멀티패스 후보생성 */
async function multiPassKmCandidates_FAST(imgDataURL){
  await ensureTesseract();
  const out = [];
  const roi0 = await cropTopNumberROI(imgDataURL);
  const roi1 = await unsharp(roi0, 0.9);
  const roi2 = await preprocessImageToDataURL(roi1, 1.0, 190);

  const [rA, rB] = await Promise.all([
    Tesseract.recognize(roi1, 'eng', { tessedit_char_whitelist: '0123456789.,' }),
    Tesseract.recognize(roi2, 'eng', { tessedit_char_whitelist: '0123456789.,', tessedit_pageseg_mode: 8 }) // Single Word
  ]);

  [rA, rB].forEach((res, idx)=>{
    const conf = (res.data?.confidence ?? 60)/100;
    numsFromText(res.data.text).forEach(o=> out.push({ ...o, src:`roi${idx}`, score:conf*10 }));
    kmCandidatesFromWords(res.data.words).forEach(o=> out.push({ ...o, src:`roi${idx}-w`, score:conf*10 }));
  });
  return { cands: out, roiBin: roi2 };
}

/* 5) 핵심: 공개 API (window 객체에 등록) */
window.extractAll = async function(imgDataURL, { recordType='daily' } = {}){
  await ensureTesseract();

  // 1. 상단 ROI 정밀 분석 (거리 후보)
  const fast = await multiPassKmCandidates_FAST(imgDataURL);
  let kmCandidates = fast.cands;

  // 2. 전체 이미지 분석 (Pace, Time, Runs, 보조 거리)
  const rFull = await Tesseract.recognize(imgDataURL, 'eng+kor');
  const p = parseFromOCR(rFull.data.text || "");
  if (p.km!=null) kmCandidates.push({ val: p.km, dec: 2, src:'aux', score:5 });

  // 3. 거리 선택 로직 (빈도수 + 점수 기반)
  let kmBest = null;
  if(kmCandidates.length){
    kmCandidates.sort((a,b) => b.score - a.score);
    kmBest = kmCandidates[0].val;
  }

  // 4. 상호 보정 (거리 = 시간 / 페이스)
  let finalKm = kmBest ?? p.km ?? 0;
  const ts = (p.timeH||0)*3600 + (p.timeM||0)*60 + (p.timeS||0);
  const ps = (p.paceMin||0)*60 + (p.paceSec||0);
  
  if(ts > 0 && ps > 0) {
      const calcedKm = ts / ps;
      // OCR 결과가 없거나, 계산값과 큰 차이가 나면 계산값 우선 (단, 20% 오차범위 내라면 OCR 신뢰)
      if (finalKm === 0 || Math.abs(finalKm - calcedKm) > 0.5) {
          finalKm = parseFloat(calcedKm.toFixed(2));
      }
  }

  return {
    km: finalKm,
    runs: (recordType==='monthly') ? (p.runs ?? null) : null,
    paceMin: p.paceMin, paceSec: p.paceSec,
    timeH: p.timeH, timeM: p.timeM, timeS: p.timeS,
    timeRaw: p.timeRaw
  };
};
