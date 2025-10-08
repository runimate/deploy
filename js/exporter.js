/* exporter.js v9 — true transparent background + mobile share/save
 * 방법:
 *  1) 캡처 순간: html/body/stage 배경을 transparent !important 로 강제
 *  2) html2canvas(backgroundColor:null)로 알파가 포함된 스냅샷 획득
 *  3) 최종 캔버스에 스냅샷을 그린 뒤, globalCompositeOperation='destination-over'
 *     로 #ff00ff(크로마)를 바닥에만 채움 → GIF transparent=#ff00ff
 *  4) 모바일: Web Share API Level 2(파일 공유) 지원 시 공유시트 열기
 */

(function () {
  const CHROMA_HEX = '#ff00ff';
  const CHROMA_NUM = 0xff00ff;
  const CDN_WORKER = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';
  const $ = (s) => document.querySelector(s);
  const setStatus = (t) => { const el = $('#export-status'); if (el) el.textContent = t; };
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  // ── Worker 준비(CDN → Blob URL)
  async function getWorkerUrl() {
    const resp = await fetch(CDN_WORKER, { mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Cannot fetch gif.worker.js (${resp.status})`);
    const js = await resp.text();
    return URL.createObjectURL(new Blob([js], { type: 'application/javascript' }));
  }

  // ── 폰트/레이아웃 안정화
  async function settleLayout() {
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }
    try { if (typeof window.fitKmRow === 'function') window.fitKmRow(); } catch {}
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // ── 캡처 순간 배경 투명 강제 (cleanup 반환)
  function forceTransparentBg() {
    const style = document.createElement('style');
    style.id = 'export-transparent-bg-style';
    style.textContent = `
      html, body, .bg-white, .bg-black,
      .stage-outer, #stage-canvas, #stage {
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }

  // ── 화면에 보이는 rect 그~대로 스냅샷(변환 스케일 포함)
  async function snapshotVisibleRect(targetEl, scale = 1) {
    await settleLayout();
    const cleanupBg = forceTransparentBg(); // ★ 투명 배경 강제
    try {
      const rect = targetEl.getBoundingClientRect();
      const dpr  = Math.max(1, Math.floor(window.devicePixelRatio || 1));

      const snap = await html2canvas(document.body, {
        backgroundColor: null, // 알파 포함
        x: Math.floor(rect.left + window.scrollX),
        y: Math.floor(rect.top  + window.scrollY),
        width:  Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        scale: Math.max(1, scale) * dpr,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 15000,
        foreignObjectRendering: false
      });

      // 아래쪽에만 크로마를 채워 넣어(알파 0 픽셀에만) GIF의 투명으로 사용
      const w = snap.width, h = snap.height;
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d', { willReadFrequently: true });
      // 1) 콘텐츠 먼저
      ctx.drawImage(snap, 0, 0);
      // 2) 알파 0 영역에만 배경 크로마 깔기
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = CHROMA_HEX;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      return out;
    } finally {
      cleanupBg();
    }
  }

  // ── 공유/저장 (모바일 우선)
  async function saveOrShareBlob(blob, filename = 'runimate.gif') {
    try {
      const file = new File([blob], filename, { type: 'image/gif' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'RUNIMATE',
          text: 'My run animation'
        });
        setStatus?.('Shared.');
        return;
      }
    } catch { /* 폴백 진행 */ }

    // 폴백: a[download]
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    // iOS 사파리에서 새 탭 열림 → 유저가 “이미지 저장” 가능
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus?.('Downloaded.');
  }

  // ── 공개 API
  async function exportRunAsGif({
    areaSelector = '#stage-canvas', // 화면과 동일(스케일 포함)
    durationMs   = 2900,
    fps          = 20,
    scale        = 1,
    filename     = 'runimate.gif',
    autoRunIfIdle = true
  } = {}) {
    const area = document.querySelector(areaSelector);
    if (!area) throw new Error('Capture area not found: ' + areaSelector);

    if (autoRunIfIdle && typeof window.onRun === 'function') {
      window.onRun();
      await wait(180);
    }

    setStatus?.('Preparing…');
    const workerUrl = await getWorkerUrl();

    const frameDelay = Math.max(10, Math.round(1000 / Math.max(1, fps)));
    const frames     = Math.max(1, Math.round(durationMs / frameDelay));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      transparent: CHROMA_NUM, // #ff00ff 인덱스를 투명으로
      background: CHROMA_NUM,
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
      gif.on('finished', async (blob) => {
        try {
          await saveOrShareBlob(blob, filename);
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
