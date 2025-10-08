/* exporter.js — RUNIMATE Transparent GIF Export (html2canvas + gif.js) */

/**
 * 투명 GIF를 만들기 위해 크로마 키(녹색) 방식을 사용한다.
 * 1) html2canvas로 DOM(#stage 등)을 PNG 캔버스로 스냅
 * 2) 새로운 캔버스에 초록(#00FF00)으로 도배 후 그 위에 스냅 캔버스를 drawImage
 * 3) gif.js 옵션 transparent:'#00FF00' 로 지정 → 초록색을 완전투명 처리
 *
 * 주의: GIF 특성상 1-bit 알파라 부드러운 반투명 경계는 손실될 수 있음.
 */

(function(){
  const CHROMA = '#00FF00';

  function wait(ms){ return new Promise(res=>setTimeout(res, ms)); }

  async function captureFrameCanvas(targetEl, scale=1){
    // DOM → 캔버스 스냅샷 (배경 투명)
    const snap = await html2canvas(targetEl, {
      backgroundColor: null,
      scale: scale > 0 ? scale : 1,
      useCORS: true
    });
    // 크로마 키 캔버스로 합성
    const c = document.createElement('canvas');
    c.width = snap.width; c.height = snap.height;
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.fillStyle = CHROMA;
    ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(snap, 0, 0);
    ctx.restore();
    return c;
  }

  /**
   * 애니메이션 실행 + 캡처 + GIF 저장
   * @param {Object} opt
   * @param {string} opt.areaSelector - 캡처할 DOM 선택자
   * @param {number} opt.durationMs   - 총 캡처 시간(ms)
   * @param {number} opt.fps          - 초당 프레임
   * @param {number} opt.scale        - 해상도 스케일
   * @param {string} opt.filename     - 저장 파일명
   */
  async function exportRunAsGif({
    areaSelector = '#stage',
    durationMs   = 2900,
    fps          = 20,
    scale        = 1,
    filename     = 'runimate.gif'
  } = {}){
    const area = document.querySelector(areaSelector);
    if (!area) throw new Error('Capture area not found: '+areaSelector);

    // 애니메이션 시작 (이미 실행 중이라면 무시)
    if (typeof window.onRun === 'function') {
      window.onRun();
    }

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps))); // ms
    const frames = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,            // 낮을수록 고화질/무거움
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js',
      transparent: CHROMA,    // 초록을 완전투명 처리
      dither: false
    });

    // 약간의 준비 시간 (폰트 로드/초기 페이드 등)
    await wait(60);

    // 프레임 루프
    const startedAt = performance.now();
    for (let i=0; i<frames; i++){
      const now = performance.now();
      const elapsed = now - startedAt;
      if (elapsed > durationMs + frameDelay) break;

      const frameCanvas = await captureFrameCanvas(area, scale);
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });

      // 다음 프레임까지 대기 (가급적 일정한 간격 유지)
      const spent = performance.now() - now;
      const rest = frameDelay - spent;
      if (rest > 0) await wait(rest);
    }

    return new Promise((resolve, reject)=>{
      gif.on('finished', (blob)=>{
        try{
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename; a.click();
          URL.revokeObjectURL(url);
          resolve();
        }catch(e){ reject(e); }
      });
      gif.on('abort', ()=> reject(new Error('GIF render aborted')));
      gif.on('error', (e)=> reject(e));

      gif.render();
    });
  }

  // 공개 API
  window.exportRunAsGif = exportRunAsGif;
})();
