/* eslint-disable */
(function () {
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  // --- 1) Worker URL 확보: 로컬 → CDN→ Blob URL ---
  let workerUrlPromise = null;
  async function getWorkerUrl() {
    if (workerUrlPromise) return workerUrlPromise;
    workerUrlPromise = (async () => {
      // 1-a. 같은 저장소에 gif.worker.js가 있는 경우(권장): /js/gif.worker.js
try {
  // 기존 문제라인 ↓↓↓
  // const localUrl = new URL('./gif.worker.js', import.meta?.url || document.currentScript?.src || location.href).toString();
  // 수정본 ↓↓↓
  const baseUrl = document.currentScript ? document.currentScript.src : location.href;
  const localUrl = new URL('./gif.worker.js', baseUrl).toString();

  const ok = await fetch(localUrl, { method: 'HEAD', cache: 'no-store' }).then(r=>r.ok).catch(()=>false);
  if (ok) return localUrl;
} catch {}

      // 1-b. CDN에서 받아와 Blob URL로 변환(교차 출처 문제 회피)
      const res = await fetch(CDN_WORKER, { cache: 'no-store' });
      const txt = await res.text();
      const blob = new Blob([txt], { type: 'application/javascript' });
      return URL.createObjectURL(blob);  // blob: URL은 Worker에 안전하게 사용 가능
    })();
    return workerUrlPromise;
  }

  // --- 2) Dual-matte 스냅샷 (보라/마젠타 헤일로 제거) ---
  async function renderDualMatte(target, scale=1) {
    const baseOpts = {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: false,
      logging: false,
      onclone(doc){
        doc.documentElement.classList.add('exporting');
        const t = doc.querySelector(target.id ? `#${target.id}` : null) || doc.querySelector(target.tagName);
        if (t) t.style.background = 'transparent';
      }
    };
    const cWhite = await html2canvas(target, baseOpts);
    const cBlack = await html2canvas(target, { ...baseOpts, backgroundColor: '#000000' });

    const w = cWhite.width, h = cWhite.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d', { willReadFrequently: true });

    const wctx = cWhite.getContext('2d', { willReadFrequently: true });
    const bctx = cBlack.getContext('2d', { willReadFrequently: true });
    const wImg = wctx.getImageData(0,0,w,h);
    const bImg = bctx.getImageData(0,0,w,h);

    const wo = wImg.data, bo = bImg.data;
    const outImg = octx.createImageData(w,h);
    const oo = outImg.data;

    for (let i=0; i<oo.length; i+=4){
      const cwR = wo[i]/255,   cbR = bo[i]/255;
      const cwG = wo[i+1]/255, cbG = bo[i+1]/255;
      const cwB = wo[i+2]/255, cbB = bo[i+2]/255;

      const aR = 1 - (cwR - cbR);
      const aG = 1 - (cwG - cbG);
      const aB = 1 - (cwB - cbB);
      let a = Math.max(0, Math.min(1, Math.max(aR, aG, aB)));
      if (a < 1/255) a = 0;

      let r=0,g=0,b=0;
      if (a > 0){
        r = Math.max(0, Math.min(255, Math.round(cbR / a * 255)));
        g = Math.max(0, Math.min(255, Math.round(cbG / a * 255)));
        b = Math.max(0, Math.min(255, Math.round(cbB / a * 255)));
      }

      oo[i]   = r;
      oo[i+1] = g;
      oo[i+2] = b;
      oo[i+3] = Math.round(a * 255);
    }
    octx.putImageData(outImg, 0, 0);
    return out;
  }

  async function snapshotCanvas(areaEl, scale){
    await new Promise(requestAnimationFrame);
    return renderDualMatte(areaEl, scale);
  }

  function readKeyText(){
    const km = document.getElementById('km')?.textContent || '';
    const race = document.getElementById('race-time')?.textContent || '';
    return (race && document.body.classList.contains('mode-race')) ? race : km;
  }

  async function exportRunAsGif({
    areaSelector = '#stage',   // 레이아웃 깨짐 방지
    durationMs    = 2200,
    fps           = 18,
    scale         = 1,
    filename      = 'runimate.gif',
    transparent   = true,
    alphaThreshold = null,
    fullCapture    = false,
    settleTailMs   = 400,
    minMs          = 900
  } = {}) {

    const areaEl = document.querySelector(areaSelector) || document.getElementById('stage') || document.body;
    document.documentElement.classList.add('exporting');

    const frameDelay = Math.max(10, Math.round(1000 / fps));
    const maxFrames  = Math.ceil(durationMs / frameDelay);

    const workerUrl = await getWorkerUrl();
    const gif = new GIF({
      workers: 2,
      workerScript: workerUrl,
      quality: 10,
      dither: false,
      transparent: transparent ? 0x00FFFF : null
    });

    let frames = 0;
    const start = performance.now();
    let lastChangeAt = start;
    let lastText = readKeyText();
    let finished = false;

    while (!finished) {
      const canvas = await snapshotCanvas(areaEl, scale);

      if (alphaThreshold != null){
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0,0,canvas.width, canvas.height);
        const data = img.data;
        for (let i=0; i<data.length; i+=4){
          if (data[i+3] < alphaThreshold) data[i+3] = 0;
        }
        ctx.putImageData(img,0,0);
      }

      gif.addFrame(canvas, { copy: true, delay: frameDelay });
      frames++;

      if (fullCapture) {
        const now = performance.now();
        const curText = readKeyText();
        if (curText !== lastText) { lastText = curText; lastChangeAt = now; }
        const elapsed = now - start;
        const stable = now - lastChangeAt;
        if (elapsed >= minMs && stable >= settleTailMs) finished = true;
      } else {
        if (frames >= maxFrames) finished = true;
      }
      await sleep(frameDelay);
    }

    const blob = await new Promise((res) => { gif.on('finished', res); gif.render(); });
    document.documentElement.classList.remove('exporting');

    try{
      const file = new File([blob], filename, { type: 'image/gif' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files:[file], title:'RUNIMATE' });
        return;
      }
    }catch{}

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  window.exportRunAsGif = exportRunAsGif;
})();
