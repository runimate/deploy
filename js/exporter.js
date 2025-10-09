/* exporter.js — single-button GIF exporter (chromakey transparent, mobile share) */
/* global html2canvas, GIF */
(function(){
  const CHROMA = '#00FF00';            // 라임 매트
  const TRANSPARENT_RGB = 0x00FF00;     // GIF transparent index용

  // 워커 스크립트를 CDN에서 받아 Blob URL로 세팅 (CORS/404 방지)
  async function getGifWorkerUrl(){
    const cdn = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';
    const res = await fetch(cdn, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Cannot fetch gif.worker.js');
    const txt = await res.text();
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
    return url;
  }

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

  // UI 가장자리 프린지 줄이기: 임시 outline 부여(흰/검 두번)
  function applyEdgeSafeOutline(root){
    // 캡처 중 전체에 문자 외곽선 추가 (얇게) — 프린지 완화
    const style = document.createElement('style');
    style.id = '__export_edgefix__';
    style.textContent = `
      #stage, #stage * {
        text-shadow: -0.5px 0 0 rgba(0,0,0,.15), 0.5px 0 0 rgba(0,0,0,.15),
                     0 -0.5px 0 rgba(0,0,0,.15), 0 0.5px 0 rgba(0,0,0,.15);
      }
      .bg-black #stage, .bg-black #stage * {
        text-shadow: -0.5px 0 0 rgba(255,255,255,.15), 0.5px 0 0 rgba(255,255,255,.15),
                     0 -0.5px 0 rgba(255,255,255,.15), 0 0.5px 0 rgba(255,255,255,.15);
      }
    `;
    document.head.appendChild(style);
    return ()=> style.remove();
  }

  async function captureOnce(el, scale=1){
    // 라임 매트로 캡처(후에 transparent로 지정)
    const canvas = await html2canvas(el, {
      backgroundColor: CHROMA,
      scale,
      logging: false,
      useCORS: true,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight
    });
    // Safari/모바일 성능: 캔버스에 willReadFrequently 힌트
    const c2 = document.createElement('canvas');
    c2.width = canvas.width; c2.height = canvas.height;
    const g = c2.getContext('2d', { willReadFrequently: true });
    g.drawImage(canvas, 0, 0);
    return c2;
  }

  async function encodeGif(frames, delayMs, filename='runimate.gif', transparentRGB=TRANSPARENT_RGB){
    const workerScript = await getGifWorkerUrl();
    const gif = new GIF({
      workers: 2,
      quality: 10,          // 낮을수록 품질↑(cpu↑). 10이 균형
      workerScript,
      transparent: transparentRGB,
      repeat: 0             // loop
    });
    frames.forEach(cv => gif.addFrame(cv, { copy: true, delay: Math.max(20, Math.round(delayMs)) }));
    return new Promise((resolve, reject)=>{
      gif.on('finished', blob=>{
        // 모바일: 가능한 경우 네이티브 공유 시트
        const file = new File([blob], filename, { type: 'image/gif' });
        if (navigator.canShare && navigator.canShare({ files:[file] })){
          navigator.share({ files:[file], title: 'RUNIMATE', text: 'My run animation' })
            .then(()=> resolve(true))
            .catch(()=> downloadBlob(blob, filename) || resolve(false));
        } else {
          downloadBlob(blob, filename);
          resolve(true);
        }
      });
      gif.on('abort', ()=> reject(new Error('GIF abort')));
      gif.on('error', e=> reject(e));
      gif.render();
    });
  }

  function downloadBlob(blob, filename){
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
    return true;
  }

  // 공개 API
  window.exportRunAsGif = async function exportRunAsGif({
    areaSelector = '#stage',
    fps = 18,
    scale = 1,
    filename = 'runimate.gif',
    fullCapture = true,
    settleTailMs = 450,
    minMs = 1200
  } = {}){
    const el = document.querySelector(areaSelector);
    if (!el) throw new Error('Capture element not found');

    // 캡처 안정화
    document.documentElement.classList.add('exporting');
    const undoOutline = applyEdgeSafeOutline();

    try{
      const frameInterval = 1000 / fps;

      // 전체 러닝 애니메이션 길이 추정 (ui.js 기준)
      // Daily/Monthly: 0.00 정지 260ms + 상승 1600ms + 꼬리
      // Race: 시간애니 2400ms
      const assumedMs = (document.body.classList.contains('mode-race')) ? 2400 : 1900;
      const totalMs = Math.max(minMs, assumedMs + settleTailMs);

      const frames = [];
      const t0 = performance.now();
      let next = t0;

      while (performance.now() - t0 < totalMs){
        // 다음 프레임까지 대기
        const now = performance.now();
        const wait = Math.max(0, next - now);
        if (wait > 0) await sleep(wait);
        // 스냅샷
        const cv = await captureOnce(el, scale);
        frames.push(cv);
        next += frameInterval;
      }

      await encodeGif(frames, frameInterval, filename, TRANSPARENT_RGB);
    } finally {
      undoOutline();
      document.documentElement.classList.remove('exporting');
    }
  };
})();
