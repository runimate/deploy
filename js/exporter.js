/* exporter.js v7 — exact on-screen capture + transparent background only
 * - Captures the exact visible rect (includes CSS transform scale)
 * - Only background becomes transparent (content forced opaque)
 * - Worker loaded via CDN->Blob URL to avoid cross-origin worker errors
 */

(function () {
  const CHROMA_NUM = 0xff00ff;                    // for GIF option
  const CHROMA_RGB = { r: 255, g: 0, b: 255 };    // #ff00ff
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  const $ = (s) => document.querySelector(s);
  const setStatus = (t) => { const el = $('#export-status'); if (el) el.textContent = t; };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // --- Worker: fetch text → Blob URL (same-originable)
  async function getWorkerUrl() {
    const resp = await fetch(CDN_WORKER, { mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Cannot fetch gif.worker.js (${resp.status})`);
    const txt = await resp.text();
    return URL.createObjectURL(new Blob([txt], { type: 'application/javascript' }));
  }

  // --- Layout settle: fonts & transform 적용을 2프레임 보장
  async function settleLayout() {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    try { if (typeof window.fitKmRow === 'function') window.fitKmRow(); } catch {}
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // --- Snapshot of EXACT visible rect (includes transform scale)
  async function snapshotVisibleRect(targetEl, scale = 1) {
    await settleLayout();

    // 캡처 기준은 "화면에 보이는 크기"
    const rect = targetEl.getBoundingClientRect();
    const dpr  = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    const snap = await html2canvas(document.body, {
      backgroundColor: null,            // 전체를 투명으로
      x: Math.floor(rect.left + window.scrollX),
      y: Math.floor(rect.top  + window.scrollY),
      width:  Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      scale: Math.max(1, scale) * dpr,  // 해상도 배율 * DPR
      useCORS: true,
      allowTaint: false,
      imageTimeout: 12000,
      foreignObjectRendering: false
    });

    // 픽셀 후처리: 거의 투명한 픽셀만 CHROMA로, 나머지는 완전 불투명
    const w = snap.width, h = snap.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(snap, 0, 0);

    const img  = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const thr  = 8; // 배경 알파 임계치 (0~255)

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a <= thr) {
        data[i]     = CHROMA_RGB.r;
        data[i + 1] = CHROMA_RGB.g;
        data[i + 2] = CHROMA_RGB.b;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 255; // 콘텐츠는 항상 완전 불투명
        // 혹시 색이 우연히 CHROMA와 같으면 살짝 틀어주기(투명으로 오인 방지)
        if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255) {
          data[i] = 254;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /**
   * Export visible area as transparent-background GIF
   * areaSelector: 👈 화면에서 보이는 "컨테이너"를 지정하세요.
   *   - 레이아웃 그대로 원하면 '#stage-canvas' (스케일 포함)
   *   - 원본 해상도(720px 내부만)면 '#stage'
   */
  async function exportRunAsGif({
    areaSelector = '#stage-canvas',   // ← 레이아웃 그대로를 기본값으로 바꿈
    durationMs   = 2900,
    fps          = 20,
    scale        = 1,
    filename     = 'runimate.gif'
  } = {}) {
    const area = document.querySelector(areaSelector);
    if (!area) throw new Error('Capture area not found: ' + areaSelector);

    // 애니메이션 시작(필요 시) + 살짝 대기
    if (typeof window.onRun === 'function') {
      window.onRun();
      await wait(180);
    }

    setStatus?.('Preparing worker…');
    const workerUrl = await getWorkerUrl();

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps)));
    const frames     = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      transparent: CHROMA_NUM,     // 0xff00ff → 투명
      background: CHROMA_NUM,      // 팔레트 배경도 동일 지정
      dither: false
    });

    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const tick = performance.now();
      if (tick - t0 > durationMs + frameDelay) break;

      const frameCanvas = await snapshotVisibleRect(area, scale);
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });

      const spent = performance.now() - tick;
      const rest  = frameDelay - spent;
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
      gif.on('abort', () => { setStatus?.('Failed: render aborted'); reject(new Error('GIF render aborted')); });
      gif.on('error', (e) => { setStatus?.('Failed: ' + (e?.message || e)); reject(e); });
      gif.render();
    });
  }

  // expose
  window.exportRunAsGif = exportRunAsGif;
})();
