/* exporter.js v4 — Transparent GIF Export (html2canvas + gif.js)
 * Fix: cross-origin worker blocked → fetch worker text, build Blob URL (same-origin)
 * Also: ignore <img> by default to avoid canvas tainting from external images.
 */

(function () {
  const CHROMA = '#00FF00';
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  const $ = (s) => document.querySelector(s);
  const setStatus = (t) => { const el = $('#export-status'); if (el) el.textContent = t; };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // ─────────────────────────────────────────────
  // Get a same-origin-able Worker URL:
  // 1) Try local /js/gif.worker.js (recommended: commit this file!)
  // 2) Fallback: fetch from CDN, convert to Blob URL
  // ─────────────────────────────────────────────
  async function getWorkerUrl() {
    // 1) Try local first (fastest & robust)
    try {
      const local = '/js/gif.worker.js';
      const resp = await fetch(local, { cache: 'no-cache' });
      if (resp.ok) return local;
    } catch (_) { /* try CDN next */ }

    // 2) Fetch from CDN and blob-ify
    const resp = await fetch(CDN_WORKER, { mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Cannot fetch gif.worker.js (${resp.status})`);
    const txt = await resp.text();
    const blob = new Blob([txt], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return url;
  }

  // DOM → canvas snapshot (with chroma background)
  async function captureFrameCanvas(targetEl, scale = 1, { ignoreImages = true } = {}) {
    const snap = await html2canvas(targetEl, {
      backgroundColor: null,
      scale: scale > 0 ? scale : 1,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      ignoreElements: ignoreImages ? (el) => el.tagName === 'IMG' : undefined
    });

    const c = document.createElement('canvas');
    c.width = snap.width; c.height = snap.height;
    // willReadFrequently 힌트(경고 억제 + 약간의 성능 도움)
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = CHROMA;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(snap, 0, 0);
    return c;
  }

  /**
   * Capture → Transparent GIF
   * @param {Object} opt
   * @param {string} opt.areaSelector
   * @param {number} opt.durationMs
   * @param {number} opt.fps
   * @param {number} opt.scale
   * @param {string} opt.filename
   * @param {boolean} opt.ignoreImages
   */
  async function exportRunAsGif({
    areaSelector = '#stage',
    durationMs = 2900,
    fps = 20,
    scale = 1,
    filename = 'runimate.gif',
    ignoreImages = true
  } = {}) {
    const area = document.querySelector(areaSelector);
    if (!area) throw new Error('Capture area not found: ' + areaSelector);

    // Prepare worker URL (local or CDN→Blob)
    setStatus?.('Preparing worker…');
    const workerUrl = await getWorkerUrl();

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps)));
    const frames = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      transparent: CHROMA,
      dither: false
    });

    await wait(60); // fonts/layout settle

    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const now = performance.now();
      if (now - t0 > durationMs + frameDelay) break;

      const frameCanvas = await captureFrameCanvas(area, scale, { ignoreImages });
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });

      const spent = performance.now() - now;
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
          resolve();
        } catch (e) { reject(e); }
      });
      gif.on('abort',  () => reject(new Error('GIF render aborted')));
      gif.on('error',  (e) => reject(e));
      gif.render();
    });
  }

  window.exportRunAsGif = exportRunAsGif;
})();
