/* exporter.js — RUNIMATE Transparent GIF Export (html2canvas + gif.js.optimized)
 * 방법: 크로마 키(초록 #00FF00) 배경을 투명화
 *  1) html2canvas로 DOM을 캔버스로 스냅샷 (배경 투명)
 *  2) 새로운 캔버스에 초록으로 채우고 스냅샷을 합성
 *  3) gif.js 옵션 transparent:'#00FF00' 로 해당 색을 완전투명 처리
 * 한계: GIF는 1-bit alpha라 부드러운 반투명 경계가 손실될 수 있음
 */

(function(){
  const CHROMA = '#00FF00';

  const wait = (ms)=>new Promise(res=>setTimeout(res, ms));

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
    ctx.fillStyle = CHROMA;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(snap, 0, 0);
    return c;
  }

  /**
   * 애니메이션 캡처 → 투명 GIF 저장
   * @param {Object} opt
   * @param {string} opt.areaSelector - 캡처할 DOM
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

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps))); // ms/프레임
    const frames = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,            // 낮을수록 고화질(파일↑,속도↓)
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js',
      transparent: CHROMA,    // 초록을 완전투명 처리
      dither: false
    });

    // 초기 정지 프레임 약간 대기(폰트/레이아웃 안정화)
    await wait(60);

    const t0 = performance.now();
    for (let i=0; i<frames; i++){
      const now = performance.now();
      if (now - t0 > durationMs + frameDelay) break;

      const frameCanvas = await captureFrameCanvas(area, scale);
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });

      // 프레임 간격 유지
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

  // 공개
  window.exportRunAsGif = exportRunAsGif;
})();
