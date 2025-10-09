/* exporter.js — Transparent GIF, stable layout, full-run incl. 0.00 preroll */
/* global html2canvas, GIF */
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── 1) Worker를 CDN에서 Blob URL로 변환 (CORS 회피)
  async function getGifWorkerUrl() {
    const url = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Cannot fetch gif.worker.js');
    const code = await res.text();
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }

  // ── 2) 임시 투명 스킨 적용/해제 (모든 배경을 강제 transparent)
  function applyTransparentSkin() {
    const css = `
      html, body,
      .bg-white, .bg-black,
      #stage-canvas, #stage, .stage-inner,
      #dm-board, #race-board {
        background: transparent !important;
      }
      /* 스크롤 영향 방지 */
      html, body { background-color: transparent !important; }
    `;
    const tag = document.createElement('style');
    tag.id = 'runimate-export-skin';
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => tag.remove();
  }

  // ── 3) alpha≈0 픽셀을 키색(#010203)으로 치환 → GIF transparent 인덱스 사용
  function alphaToKey(canvas, keyRGB = [1, 2, 3], alphaThresh = 12) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const [kr, kg, kb] = keyRGB;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= alphaThresh) {
        d[i] = kr; d[i + 1] = kg; d[i + 2] = kb; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return (kr << 16) | (kg << 8) | kb;
  }

  // ── 4) 레이아웃 스냅 방지: stage-canvas의 transform 임시 해제 후 정확 rect 캡처
  async function captureStageRect(el, scale = 1) {
    const wrap = document.getElementById('stage-canvas');
    const prev = wrap ? wrap.style.transform : '';
    if (wrap) wrap.style.transform = 'none';

    const rect = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = await html2canvas(document.body, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: dpr * scale,
      x: Math.floor(rect.left + window.scrollX),
      y: Math.floor(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight
    });

    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    out.getContext('2d', { willReadFrequently: true }).drawImage(cv, 0, 0);

    if (wrap) wrap.style.transform = prev;
    return out;
  }

  // ── 5) 값 변화 감시: “한 번이라도 변한 뒤” 안정 N 프레임이면 종료
  function makeStability(mode) {
    const t = (mode === 'race') ? document.getElementById('race-time') : document.getElementById('km');
    let last = t ? t.textContent : '';
    let stableRun = 0;
    let sawChange = false;
    return () => {
      const now = t ? t.textContent : '';
      if (now === last) stableRun++;
      else { last = now; stableRun = 0; sawChange = true; }
      return { stableRun, sawChange };
    };
  }

  // ── 6) GIF 인코딩 + 모바일 share 지원
  async function encodeGif({ frames, delayMs, filename, transparentRGB }) {
    const workerScript = await getGifWorkerUrl();
    const gif = new GIF({
      workers: 2,
      workerScript,
      quality: 10,
      transparent: transparentRGB,
      repeat: 0
    });
    frames.forEach(c => gif.addFrame(c, { copy: true, delay: Math.max(20, Math.round(delayMs)) }));
    return new Promise((resolve, reject) => {
      gif.on('finished', blob => {
        const file = new File([blob], filename, { type: 'image/gif' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'RUNIMATE' })
            .then(() => resolve(true))
            .catch(() => { downloadBlob(blob, filename); resolve(false); });
        } else {
          downloadBlob(blob, filename); resolve(true);
        }
      });
      gif.on('error', reject);
      gif.on('abort', () => reject(new Error('GIF abort')));
      gif.render();
    });
  }
  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }

  // ── 7) 공개 API
  window.exportRunAsGif = async function exportRunAsGif({
    areaSelector = '#stage',
    fps = 18,
    scale = 1,
    filename = 'runimate.gif',
    // 길이 제어
    prerollMs = 800,       // ✅ 0.00에서 머무르는 시간(프리롤)
    minMs = 1200,          // 최소 녹화
    maxMs = 6500,          // 안전 상한
    needStable = 10,       // 변화 후 안정 프레임 수
    tailFrames = 10        // 멈춤 후 꼬리
  } = {}) {
    const el = document.querySelector(areaSelector);
    if (!el) throw new Error('Capture element not found');

    // 배경 투명 스킨 적용
    const restoreSkin = applyTransparentSkin();

    const mode = document.body.classList.contains('mode-race') ? 'race' : 'dm';
    const check = makeStability(mode);
    const delay = 1000 / fps;
    const frames = [];
    let transparentRGB = null;

    // 0.00로 복귀 후 약간 안정화
    if (typeof window.exitFocus === 'function') window.exitFocus();
    await sleep(60);

    // ✅ 프리롤: 0.00 상태 캡처
    const prerollFrames = Math.max(1, Math.round(prerollMs / delay));
    for (let i = 0; i < prerollFrames; i++) {
      const cv0 = await captureStageRect(el, scale);
      if (transparentRGB == null) transparentRGB = alphaToKey(cv0, [1, 2, 3], 12);
      else alphaToKey(cv0, [1, 2, 3], 12);
      frames.push(cv0);
      await sleep(delay);
    }

    // 애니메이션 시작
    if (typeof window.onRun === 'function') window.onRun();

    // 본 녹화
    const t0 = performance.now();
    let next = t0;
    while (true) {
      const now = performance.now();
      if (next > now) await sleep(next - now);
      next += delay;

      const cv = await captureStageRect(el, scale);
      alphaToKey(cv, [1, 2, 3], 12);
      frames.push(cv);

      const { stableRun, sawChange } = check();
      const elapsed = performance.now() - t0;
      if ((elapsed >= minMs && sawChange && stableRun >= needStable) || elapsed >= maxMs) break;
    }

    // 꼬리 프레임
    const last = frames[frames.length - 1];
    for (let i = 0; i < tailFrames; i++) frames.push(last);

    try {
      await encodeGif({ frames, delayMs: delay, filename, transparentRGB: transparentRGB ?? (1 << 16 | 2 << 8 | 3) });
    } finally {
      restoreSkin(); // 스킨 원복
    }
  };
})();
