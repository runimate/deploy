/* eslint-disable */
(function () {
  const WKR = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js';

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  // html2canvas로 두 번(흰/검) 렌더 → 알파/전경 복원
  async function renderDualMatte(target, scale=1) {
    const baseOpts = {
      scale,
      backgroundColor: '#ffffff',     // 1st: white
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: false,
      logging: false,
      onclone(doc){
        doc.documentElement.classList.add('exporting');
        // 캡처 영역 배경 강제
        const t = doc.querySelector(target.id ? `#${target.id}` : null) || doc.querySelector(target.tagName);
        if (t) t.style.background = 'transparent';
      }
    };

    // pass 1: white
    const cWhite = await html2canvas(target, baseOpts);

    // pass 2: black
    const cBlack = await html2canvas(target, {
      ...baseOpts,
      backgroundColor: '#000000'
    });

    const w = cWhite.width, h = cWhite.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d', { willReadFrequently: true });

    const wctx = cWhite.getContext('2d', { willReadFrequently: true });
    const bctx = cBlack.getContext('2d', { willReadFrequently: true });
    const wImg = wctx.getImageData(0,0,w,h);
    const bImg = bctx.getImageData(0,0,w,h);
    const wo = wImg.data, bo = bImg.data;

    // 결과 버퍼
    const outImg = octx.createImageData(w,h);
    const oo = outImg.data;

    // 알파 복원: α = 1 - max_i(Cw_i - Cb_i)
    // 전경 복원: F = Cb / α  (채널별)
    for (let i=0; i<oo.length; i+=4){
      const cwR = wo[i]/255,   cbR = bo[i]/255;
      const cwG = wo[i+1]/255, cbG = bo[i+1]/255;
      const cwB = wo[i+2]/255, cbB = bo[i+2]/255;

      const aR = 1 - (cwR - cbR);
      const aG = 1 - (cwG - cbG);
      const aB = 1 - (cwB - cbB);
      let a = Math.max(0, Math.min(1, Math.max(aR, aG, aB))); // 보수적으로 최대 채널 사용

      // 수치 안정화: 아주 작은 값 클램프
      if (a < 1/255) a = 0;

      let r=0,g=0,b=0;
      if (a > 0){
        r = Math.max(0, Math.min(255, Math.round(cbR / a * 255)));
        g = Math.max(0, Math.min(255, Math.round(cbG / a * 255)));
        b = Math.max(0, Math.min(255, Math.round(cbB / a * 255)));
      }

      oo[i]   = r;
      oo[i+1] = g;
      oo[i+2] = b;
      oo[i+3] = Math.round(a * 255);
    }

    octx.putImageData(outImg, 0, 0);
    return out;
  }

  // 프레임 1장 캡처 (dual-matte 사용)
  async function snapshotCanvas(areaEl, scale){
    // 두 번 렌더는 무거우므로 다음 animation frame에 넘겨 부하 분산
    await new Promise(requestAnimationFrame);
    const canvas = await renderDualMatte(areaEl, scale);
    return canvas;
  }

  // 텍스트 변화 감지 (DM: #km, 월/일: #date-display, 레이스: #race-time)
  function readKeyText(){
    const km = document.getElementById('km')?.textContent || '';
    const race = document.getElementById('race-time')?.textContent || '';
    return (race && document.body.classList.contains('mode-race')) ? race : km;
  }

  async function exportRunAsGif({
    areaSelector = '#stage-canvas',
    durationMs    = 2200,
    fps           = 20,
    scale         = 1,
    filename      = 'runimate.gif',
    transparent   = true,
    alphaThreshold = null, // dual-matte를 쓰므로 필요 없음(호환 파라미터)
    fullCapture    = false,
    settleTailMs   = 400,  // 풀캡처: 값 변동 멈춘 뒤 꼬리 유지 시간
    minMs          = 700   // 풀캡처: 최소 길이
  } = {}) {

    const areaEl = document.querySelector(areaSelector) || document.getElementById('stage-canvas') || document.body;

    // 캡처 모드 진입 (스타일 투명화)
    document.documentElement.classList.add('exporting');

    const frameDelay = Math.max(10, Math.round(1000 / fps));
    const maxFrames  = Math.ceil(durationMs / frameDelay);

    // GIF 인코더
    const gif = new GIF({
      workers: 2,
      workerScript: WKR,
      quality: 10,
      dither: false,
      transparent: transparent ? 0x00FFFF : null // transparent index는 내부적으로 재계산됨
    });

    let frames = 0;
    let start = performance.now();
    let lastChangeAt = start;
    let lastText = readKeyText();
    let finished = false;

    while (!finished) {
      // 한 프레임 캡처
      const canvas = await snapshotCanvas(areaEl, scale);

      // (참고) 단일 임계 투명화가 필요하다면 여기서 alphaThreshold 적용 가능
      if (alphaThreshold != null){
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0,0,canvas.width, canvas.height);
        const data = img.data;
        for (let i=0; i<data.length; i+=4){
          if (data[i+3] < alphaThreshold) data[i+3] = 0;
        }
        ctx.putImageData(img,0,0);
      }

      gif.addFrame(canvas, { copy: true, delay: frameDelay });
      frames++;

      // 풀캡처 모드: 텍스트 변화 감지로 종료 시점 판단
      if (fullCapture) {
        const now = performance.now();
        const curText = readKeyText();
        if (curText !== lastText) {
          lastText = curText;
          lastChangeAt = now;
        }
        const elapsed = now - start;
        const stable = now - lastChangeAt;

        // 최소 길이 보장 + 안정 구간 꼬리 확보 후 종료
        if (elapsed >= minMs && stable >= settleTailMs) {
          finished = true;
        }
      } else {
        // 고정 길이
        if (frames >= maxFrames) finished = true;
      }

      // 프레임 간 간격 유지
      await sleep(frameDelay);
    }

    // 인코딩 → Blob → 저장/공유
    const blob = await new Promise((res) => {
      gif.on('finished', res);
      gif.render();
    });

    document.documentElement.classList.remove('exporting');

    // 모바일이면 공유 시트 (사진 앱 저장 가능)
    try{
      const file = new File([blob], filename, { type: 'image/gif' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files:[file], title:'RUNIMATE' });
        return;
      }
    }catch{/* ignore */ }

    // 폴백: 다운로드
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // 전역 공개
  window.exportRunAsGif = exportRunAsGif;
})();
