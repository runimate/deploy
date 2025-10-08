/* exporter.js v6 — Transparent background only (no “holey” text)
 * Strategy:
 * 1) html2canvas snapshot with alpha
 * 2) Pixel pass:
 *    - if alpha <= 10 → set to CHROMA (opaque)  → will become transparent in GIF
 *    - else alpha = 255 (fully opaque); if accidental chroma, nudge away
 * 3) GIF encoder with transparent = CHROMA
 */

(function () {
  const CHROMA = { r: 255, g: 0, b: 255 }; // #ff00ff
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  const $ = (s) => document.querySelector(s);
  const setStatus = (t) => { const el = $('#export-status'); if (el) el.textContent = t; };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  function chromaCss() { return '#ff00ff'; }

  async function getWorkerUrl() {
    const resp = await fetch(CDN_WORKER, { mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Cannot fetch gif.worker.js (${resp.status})`);
    const txt = await resp.text();
    return URL.createObjectURL(new Blob([txt], { type: 'application/javascript' }));
  }

  async function ensureStableLayout() {
    // 폰트 로드 대기
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    // km-row 같은 스케일 계산 함수가 있으면 호출
    try { if (typeof window.fitKmRow === 'function') window.fitKmRow(); } catch {}
    // transform/레이아웃 반영될 때까지 2프레임 대기
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // DOM -> Canvas snapshot
  async function captureFrameCanvas(targetEl, scale = 1) {
    await ensureStableLayout();

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const snap = await html2canvas(targetEl, {
      backgroundColor: null,                    // 완전 투명으로 스냅
      scale: Math.max(1, scale) * dpr,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 12000,
      foreignObjectRendering: false
    });

    // 픽셀 후처리: 배경(알파 낮음)만 크로마키로, 나머지는 완전 불투명
    const w = snap.width, h = snap.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(snap, 0, 0);

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const thr = 10; // 배경 판정 알파 임계치(0~255)

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]; // alpha
      if (a <= thr) {
        // 완전 투명 배경 → 크로마키로 채움 (GIF의 transparent index)
        data[i]     = CHROMA.r;
        data[i + 1] = CHROMA.g;
        data[i + 2] = CHROMA.b;
        data[i + 3] = 255;
      } else {
        // 콘텐츠 픽셀 → 완전 불투명
        data[i + 3] = 255;
        // 혹시 색이 우연히 크로마키와 동일하면 살짝 틀어준다(투명으로 잘못 인식 방지)
        if (data[i] === CHROMA.r && data[i + 1] === CHROMA.g && data[i + 2] === CHROMA.b) {
          data[i] = 254; // 1만 낮춤
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /**
   * Capture → Transparent GIF (background only)
   */
  async function exportRunAsGif({
    areaSelector = '#stage',
    durationMs   = 2900,
    fps          = 20,
    scale        = 1,
    filename     = 'runimate.gif'
  } = {}) {
    const area = document.querySelector(areaSelector);
    if (!area) throw new Error('Capture area not found: ' + areaSelector);

    // 애니메이션이 꺼져 있으면 시작 + 살짝 대기(초반 0.00 홀드 포함)
    if (typeof window.onRun === 'function') {
      window.onRun();
      await wait(180);
    }

    setStatus?.('Preparing worker…');
    const workerUrl = await getWorkerUrl();

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps)));
    const frames = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      transparent: chromaCss(), // #ff00ff → 투명
      background: chromaCss(),  // 팔레트에 동일 색을 배경으로 등록
      dither: false
    });

    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const tick = performance.now();
      if (tick - t0 > durationMs + frameDelay) break;

      const frameCanvas = await captureFrameCanvas(area, scale);
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });

      const spent = performance.now() - tick;
      const rest = frameDelay - spent;
      if (rest > 0) await wait(rest);
    }

    return new Promise((resolve, reject) => {
      gif.on('finished', (blob) => {
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename; a.click();
          URL.revokeObjectURL(url);
          setStatus?.('Done. GIF saved.');
          resolve();
        } catch (e) { setStatus?.('Failed: ' + e.message); reject(e); }
      });
      gif.on('abort',  () => { setStatus?.('Failed: render aborted'); reject(new Error('GIF render aborted')); });
      gif.on('error',  (e) => { setStatus?.('Failed: ' + (e?.message||e)); reject(e); });
      gif.render();
    });
  }

  window.exportRunAsGif = exportRunAsGif;
})();
