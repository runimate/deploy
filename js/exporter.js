/* eslint-disable */
(function () {
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  const rAF = () => new Promise(requestAnimationFrame);
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

  // ── 1) Worker URL: 항상 CDN → Blob URL (로컬 HEAD 체크 제거)
  async function getWorkerUrl() {
    const res = await fetch(CDN_WORKER, { cache: 'no-store' });
    const txt = await res.text();
    const blob = new Blob([txt], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  // ── 2) Dual-matte 스냅샷(마젠타/헤일로 제거용)
  async function renderDualMatte(target, scale=1) {
    const base = {
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
    const cW = await html2canvas(target, base);
    const cB = await html2canvas(target, { ...base, backgroundColor: '#000000' });

    const w = cW.width, h = cW.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d', { willReadFrequently: true });

    const wctx = cW.getContext('2d', { willReadFrequently: true });
    const bctx = cB.getContext('2d', { willReadFrequently: true });
    const wImg = wctx.getImageData(0,0,w,h);
    const bImg = bctx.getImageData(0,0,w,h);
    const wo = wImg.data, bo = bImg.data;

    const outImg = octx.createImageData(w,h);
    const oo = outImg.data;

    for (let i=0;i<oo.length;i+=4){
      const cwR=wo[i]/255,   cbR=bo[i]/255;
      const cwG=wo[i+1]/255, cbG=bo[i+1]/255;
      const cwB=wo[i+2]/255, cbB=bo[i+2]/255;

      const a = Math.max(0, Math.min(1, Math.max(
        1 - (cwR - cbR),
        1 - (cwG - cbG),
        1 - (cwB - cbB)
      )));
      const A = a < 1/255 ? 0 : a;

      let r=0,g=0,b=0;
      if (A>0){
        r = Math.max(0, Math.min(255, Math.round(cbR / A * 255)));
        g = Math.max(0, Math.min(255, Math.round(cbG / A * 255)));
        b = Math.max(0, Math.min(255, Math.round(cbB / A * 255)));
      }
      oo[i]   = r;
      oo[i+1] = g;
      oo[i+2] = b;
      oo[i+3] = Math.round(A*255);
    }
    octx.putImageData(outImg, 0, 0);
    return out;
  }

  async function snapshotCanvas(areaEl, scale){
    await rAF(); // 부하 분산
    return renderDualMatte(areaEl, scale);
  }

  function readKeyText(){
    const km = document.getElementById('km')?.textContent || '';
    const race = document.getElementById('race-time')?.textContent || '';
    return (race && document.body.classList.contains('mode-race')) ? race : km;
  }

  async function exportRunAsGif({
    areaSelector = '#stage',    // 레이아웃 틀어짐 방지
    durationMs    = 2200,
    fps           = 18,
    scale         = 1,
    filename      = 'runimate.gif',
    transparent   = true,
    fullCapture   = false,
    settleTailMs  = 400,
    minMs         = 900
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
    const t0 = performance.now();
    let lastChangeAt = t0;
    let lastText = readKeyText();
    let finished = false;

    while (!finished){
      const canvas = await snapshotCanvas(areaEl, scale);
      gif.addFrame(canvas, { copy: true, delay: frameDelay });
      frames++;

      if (fullCapture){
        const now = performance.now();
        const cur = readKeyText();
        if (cur !== lastText){ lastText = cur; lastChangeAt = now; }
        const elapsed = now - t0;
        const stable  = now - lastChangeAt;
        if (elapsed >= minMs && stable >= settleTailMs) finished = true;
      } else {
        if (frames >= maxFrames) finished = true;
      }
      await sleep(frameDelay);
    }

    const blob = await new Promise((res)=>{ gif.on('finished', res); gif.render(); });
    document.documentElement.classList.remove('exporting');

    try{
      const file = new File([blob], filename, { type: 'image/gif' });
      if (navigator.canShare && navigator.canShare({ files:[file] })) {
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
