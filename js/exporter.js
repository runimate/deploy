/* exporter.js — transparent GIF (no layout shift, no green fringe, full-run capture) */
/* global html2canvas, GIF */
(function(){
  // 워커를 CDN에서 읽어 Blob URL로 주입 (CORS/404 회피)
  async function getGifWorkerUrl(){
    const src = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';
    const res = await fetch(src, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Cannot fetch gif.worker.js');
    const code = await res.text();
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }

  const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));

  // 투명 캔버스 캡처 (레이아웃 건드리지 않음)
  async function captureTransparentCanvas(el, scale=1){
    const dpr = Math.min(2, window.devicePixelRatio || 1); // 너무 큰 dpr은 계단/용량↑
    const canvas = await html2canvas(el, {
      backgroundColor: null,        // 완전 투명
      scale: dpr * scale,
      logging: false,
      useCORS: true,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight
    });
    // Safari 최적화: willReadFrequently
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    const g = out.getContext('2d', { willReadFrequently: true });
    g.drawImage(canvas, 0, 0);
    return out;
  }

  // 알파가 거의 0인 픽셀을 key색(#010203)으로 바꾸기 → GIF 투명 인덱스 매핑
  function applyTransparencyKey(canvas, keyRGB = [1, 2, 3], alphaThresh = 12){
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0,0,canvas.width,canvas.height);
    const data = img.data;
    const [kr,kg,kb] = keyRGB;
    for (let i=0; i<data.length; i+=4){
      const a = data[i+3];
      if (a <= alphaThresh){
        data[i] = kr; data[i+1] = kg; data[i+2] = kb; data[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // GIF lib은 24bit RGB → 0xRRGGBB
    return (kr<<16) | (kg<<8) | kb;
  }

  // 텍스트 변화가 멈췄는지 감지 (안정 프레임 수 연속)
  function makeStabilityChecker({ mode }){
    const target = (mode==='race') ? document.getElementById('race-time')
                                   : document.getElementById('km');
    let last = target ? target.textContent : '';
    let stable = 0;
    return ()=> {
      const now = target ? target.textContent : '';
      if (now === last) stable++;
      else { stable = 0; last = now; }
      return stable;
    };
  }

  async function encodeGif({ frames, delayMs, filename, transparentRGB }){
    const workerScript = await getGifWorkerUrl();
    const gif = new GIF({
      workers: 2,
      workerScript,
      quality: 10,           // 낮을수록 품질↑/속도↓
      transparent: transparentRGB,
      repeat: 0
    });
    frames.forEach(c => gif.addFrame(c, { copy:true, delay: Math.max(20, Math.round(delayMs)) }));

    return new Promise((resolve, reject)=>{
      gif.on('finished', blob=>{
        const file = new File([blob], filename, { type: 'image/gif' });
        if (navigator.canShare && navigator.canShare({ files:[file] })){
          navigator.share({ files:[file], title: 'RUNIMATE' })
            .then(()=> resolve(true))
            .catch(()=> { downloadBlob(blob, filename); resolve(false); });
        } else { downloadBlob(blob, filename); resolve(true); }
      });
      gif.on('abort', ()=> reject(new Error('GIF abort')));
      gif.on('error', err=> reject(err));
      gif.render();
    });
  }

  function downloadBlob(blob, filename){
    const a=document.createElement('a');
    const url=URL.createObjectURL(blob);
    a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }

  // 공개 API
  window.exportRunAsGif = async function exportRunAsGif({
    areaSelector = '#stage',
    fps = 18,
    scale = 1,
    filename = 'runimate.gif',
    minMs = 1000,           // 너무 짧지 않게 최소 길이
    maxMs = 5000,           // 안전장치
    stableNeed = 10,        // 이 프레임 수만큼 연속 안정이면 종료
    tailFrames = 10         // 멈춘 후 꼬리 프레임 추가
  } = {}){
    const el = document.querySelector(areaSelector);
    if (!el) throw new Error('Capture element not found');

    const mode = document.body.classList.contains('mode-race') ? 'race' : 'dm';
    const stableCheck = makeStabilityChecker({ mode });

    const frameInterval = 1000 / fps;
    const frames = [];

    const t0 = performance.now();
    let next = t0;
    let lastStable = 0;

    while (true){
      // 다음 프레임 시점까지 대기
      const now = performance.now();
      if (next > now) await sleep(next - now);
      next += frameInterval;

      // 캡처
      const cv = await captureTransparentCanvas(el, scale);
      const transRGB = applyTransparencyKey(cv, [1,2,3], 12); // #010203

      // 첫 프레임에서 투명색 결정 위해 저장
      if (!frames.__transparent) frames.__transparent = transRGB;
      frames.push(cv);

      // 안정성 체크
      const s = stableCheck();
      if (s > lastStable) lastStable = s;

      const elapsed = performance.now() - t0;
      const longEnough = elapsed >= minMs;
      const stabilized = lastStable >= stableNeed;

      if ((longEnough && stabilized) || elapsed >= maxMs) break;
    }

    // 꼬리 프레임 추가(정지 화면 유지)
    const endFrame = frames[frames.length-1];
    for (let i=0;i<tailFrames;i++) frames.push(endFrame);

    // 인코딩
    await encodeGif({
      frames,
      delayMs: frameInterval,
      filename,
      transparentRGB: frames.__transparent
    });
  };
})();
