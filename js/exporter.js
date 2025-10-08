/* exporter.js v5 — Transparent GIF Export (html2canvas + gif.js.optimized)
 * Fixes:
 *  - Transparent: strict chroma-key (#ff00ff) compositing
 *  - Layout: keep IMG layout via visibility:hidden during capture
 *  - Worker: no more 404; fetch CDN worker → Blob URL (same-originable)
 */

(function () {
  // 잘 안 쓰이는 마젠타를 크로마키로 사용 (콘텐츠 색과 충돌 최소화)
  const CHROMA = '#ff00ff';
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  const $ = (s) => document.querySelector(s);
  const setStatus = (t) => { const el = $('#export-status'); if (el) el.textContent = t; };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // ─────────────────────────────────────────────
  // GIF worker: CDN 텍스트를 받아 Blob URL로 변환 (크로스오리진 차단 회피)
  // ─────────────────────────────────────────────
  async function getWorkerUrl({ preferLocal = false } = {}) {
    // 1) (옵션) 로컬 파일 우선 시도 — 원하면 /js/gif.worker.js 추가해 사용 가능
    if (preferLocal) {
      try {
        const local = '/js/gif.worker.js';
        const resp = await fetch(local, { cache: 'no-cache' });
        if (resp.ok) return local;
      } catch { /* continue to CDN */ }
    }
    // 2) CDN에서 텍스트로 가져와 Blob URL 생성
    const resp = await fetch(CDN_WORKER, { mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Cannot fetch gif.worker.js (${resp.status})`);
    const txt = await resp.text();
    const blob = new Blob([txt], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  // 캡처 동안만 subtree IMG를 visibility:hidden 처리해서 레이아웃 유지
  function applyCaptureImageMask(rootEl) {
    const style = document.createElement('style');
    style.id = 'export-hide-img-style';
    style.textContent = `
      ${selectorOf(rootEl)} img { visibility: hidden !important; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }
  function selectorOf(el){
    // 간단한 스코프용 선택자 생성
    if (el.id) return `#${cssEscape(el.id)}`;
    const tag = el.tagName.toLowerCase();
    return `${tag}[data-export-scope="1"]`;
  }
  function cssEscape(s){ return s.replace(/([#.;:[\](),>+~*^$|\\])/g, '\\$1'); }

  // DOM → Canvas (투명 배경 스냅샷 + 크로마키 합성)
  async function captureFrameCanvas(targetEl, scale = 1, { keepLayoutWithHiddenImgs = true } = {}) {
    const cleanup = [];
    try{
      // 캡처 범위 스코프 지정(선택자용)
      let scoped = false;
      if (!targetEl.id) {
        targetEl.setAttribute('data-export-scope','1');
        scoped = true;
        cleanup.push(()=> targetEl.removeAttribute('data-export-scope'));
      }

      // IMG를 레이아웃 유지한 채 픽셀만 숨김
      if (keepLayoutWithHiddenImgs) {
        cleanup.push(applyCaptureImageMask(targetEl));
      }

      // 폰트 로드 완료 대기(레이아웃 안정화)
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch {}
      }

      // DPR 반영 (또렷하게)
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      const snap = await html2canvas(targetEl, {
        backgroundColor: null,              // 스냅샷은 완전 투명
        scale: Math.max(1, scale) * dpr,    // 해상도 스케일 * DPR
        useCORS: true,
        allowTaint: false,
        imageTimeout: 12000,
        foreignObjectRendering: false       // 일반 렌더러가 더 안정적
      });

      // 스냅샷을 크로마키 바탕으로 합성
      const c = document.createElement('canvas');
      c.width = snap.width; c.height = snap.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = CHROMA;               // 바닥을 마젠타로 채우기
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(snap, 0, 0);            // 투명 영역은 마젠타가 비침 → GIF에서 투명화됨
      return c;
    } finally {
      cleanup.forEach(fn=>{ try{ fn(); }catch{} });
    }
  }

  /**
   * Capture → Transparent GIF
   * @param {Object} opt
   * @param {string} opt.areaSelector
   * @param {number} opt.durationMs
   * @param {number} opt.fps
   * @param {number} opt.scale
   * @param {string} opt.filename
   * @param {boolean} opt.preferLocalWorker
   */
  async function exportRunAsGif({
    areaSelector = '#stage',
    durationMs   = 2900,
    fps          = 20,
    scale        = 1,
    filename     = 'runimate.gif',
    preferLocalWorker = false
  } = {}) {
    const area = document.querySelector(areaSelector);
    if (!area) throw new Error('Capture area not found: ' + areaSelector);

    setStatus?.('Preparing…');

    // 애니메이션이 꺼져있다면 자동 실행 후 살짝 대기 (초반 0.00 홀드 보장)
    if (typeof window.onRun === 'function') {
      window.onRun();
      await wait(200);
    }

    // 워커 준비
    const workerUrl = await getWorkerUrl({ preferLocal: preferLocalWorker });

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps)));
    const frames = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      transparent: CHROMA,      // 마젠타를 완전 투명으로 처리
      dither: false
    });

    // 캡처 루프
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const tick = performance.now();
      if (tick - t0 > durationMs + frameDelay) break;

      const frameCanvas = await captureFrameCanvas(area, scale, { keepLayoutWithHiddenImgs: true });
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

  // 공개 API
  window.exportRunAsGif = exportRunAsGif;
})();
