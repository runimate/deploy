/* exporter.js — transparent GIF (layout-stable, full-run capture, no green fringe) */
/* global html2canvas, GIF */
(function () {
  // --- util ---
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // CORS 회피용: CDN에서 워커를 받아 Blob URL로 사용
  async function getGifWorkerUrl() {
    const url = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Cannot fetch gif.worker.js');
    const code = await res.text();
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }

  // 알파≈0 픽셀을 key색(#010203)으로 치환 → GIF의 transparent로 지정
  function alphaToKey(canvas, keyRGB = [1, 2, 3], alphaThresh = 12) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    const [kr, kg, kb] = keyRGB;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a <= alphaThresh) {
        data[i] = kr; data[i + 1] = kg; data[i + 2] = kb; data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return (kr << 16) | (kg << 8) | kb;
  }

  // transform 스냅 회피: stage-canvas의 스케일을 임시 제거하고, stage만 정확 좌표로 캡처
  async function captureStageRect(el, scale = 1) {
    const canvasWrap = document.getElementById('stage-canvas');
    const prevTransform = canvasWrap ? canvasWrap.style.transform : '';
    if (canvasWrap) canvasWrap.style.transform = 'none';

    // 정확한 렉트 측정
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    const cv = await html2canvas(document.body, {
      backgroundColor: null,          // 완전 투명
      logging: false,
      useCORS: true,
      scale: dpr * scale,
      x: Math.max(0, Math.floor(rect.left + window.scrollX)),
      y: Math.max(0, Math.floor(rect.top + window.scrollY)),
      width,
      height,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight
    });

    // 잘라낸 영역만 따로 복사 (성능↑)
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    out.getContext('2d', { willReadFrequently: true }).drawImage(cv, 0, 0);

    // 원복
    if (canvasWrap) canvasWrap.style.transform = prevTransform;
    return out;
  }

  // 값 변화 감시: “한 번이라도 값이 변함” + “그 후 안정 프레임 N회 연속”이면 종료
  function makeStability({ mode }) {
    const target = (mode === 'race')
      ? document.getElementById('race-time')
      : document.getElementById('km');

    let last = target ? target.textContent : '';
    let stableRun = 0;
    let sawChange = false;

    return () => {
      const now = target ? target.textContent : '';
      if (now === last) {
        stableRun++;
      } else {
        last = now;
        stableRun = 0;
        sawChange = true;
      }
      return { stableRun, sawChange };
    };
  }

  async function encodeGif({ frames, delayMs, filename, transparentRGB }) {
    const workerScript = await getGifWorkerUrl();
    const gif = new GIF({
      workers: 2,
      workerScript,
      quality: 10,
      transparent: transparentRGB,
      repeat: 0
    });
    frames.forEach((c) => gif.addFrame(c, { copy: true, delay: Math.max(20, Math.round(delayMs)) }));

    return new Promise((resolve, reject) => {
      gif.on('finished', (blob) => {
        const file = new File([blob], filename, { type: 'image/gif' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'RUNIMATE' })
            .then(() => resolve(true))
            .catch(() => { downloadBlob(blob, filename); resolve(false); });
        } else {
          downloadBlob(blob, filename);
          resolve(true);
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
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }

  // 공개 API
  window.exportRunAsGif = async function exportRunAsGif({
    areaSelector = '#stage',
    fps = 18,
    scale = 1,
    filename = 'runimate.gif',
    minMs = 1200,          // 최소 녹화 길이
    maxMs = 6000,          // 안전 상한
    needStable = 10,       // 변화 후 안정 프레임 연속 N
    tailFrames = 10        // 멈춘 뒤 꼬리 프레임
  } = {}) {
    const el = document.querySelector(areaSelector);
    if (!el) throw new Error('Capture element not found');

    const mode = document.body.classList.contains('mode-race') ? 'race' : 'dm';
    const check = makeStability({ mode });

    const frameInterval = 1000 / fps;
    const frames = [];
    let transparentRGB = null;

    const t0 = performance.now();
    let next = t0;

    while (true) {
      // 프레임 타이밍 정렬
      const now = performance.now();
      if (next > now) await sleep(next - now);
      next += frameInterval;

      // 캡처(변형 해제 + 영역 캡처)
      const cv = await captureStageRect(el, scale);

      // 알파→키색 치환(첫 프레임에서 투명 RGB 결정)
      if (transparentRGB == null) transparentRGB = alphaToKey(cv, [1, 2, 3], 12);
      else alphaToKey(cv, [1, 2, 3], 12);
      frames.push(cv);

      // 종료 조건: 최소 길이 충족 & “한번이라도 변한 뒤” 안정 N프레임
      const { stableRun, sawChange } = check();
      const elapsed = performance.now() - t0;
      if ((elapsed >= minMs && sawChange && stableRun >= needStable) || elapsed >= maxMs) break;
    }

    // 꼬리 프레임
    const last = frames[frames.length - 1];
    for (let i = 0; i < tailFrames; i++) frames.push(last);

    await encodeGif({
      frames,
      delayMs: frameInterval,
      filename,
      transparentRGB
    });
  };
})();
