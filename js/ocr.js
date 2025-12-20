/* ocr.js
 * RUNIMATE v2 OCR Module (upgrade-friendly)
 * - window.RunimateOCR 로 노출
 */

(function () {
  function normalizeText(raw) {
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .trim();
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function parseNRCText(text) {
    // distance: 14.64 km / 14,64 km / 14.64km
    let distanceKm = null;
    const distMatch = text.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(km|kilometer|kilometre)\b/i);
    if (distMatch) {
      const v = parseFloat(distMatch[1].replace(',', '.'));
      if (isFinite(v)) distanceKm = v;
    }

    // time: hh:mm:ss
    let timeSec = null;
    const timeMatch = text.match(/(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})/);
    if (timeMatch) {
      const hh = parseInt(timeMatch[1], 10);
      const mm = parseInt(timeMatch[2], 10);
      const ss = parseInt(timeMatch[3], 10);
      if (isFinite(hh) && isFinite(mm) && isFinite(ss)) {
        timeSec = hh * 3600 + mm * 60 + ss;
      }
    }

    // pace: mm:ss (prefer hint)
    let paceSec = null;

    const paceHint = text.match(/(?:pace|\/\s*km|per\s*km).{0,24}?(\d{1,2})\s*[:']\s*(\d{2})/i);
    if (paceHint) {
      const mm = parseInt(paceHint[1], 10);
      const ss = parseInt(paceHint[2], 10);
      if (mm >= 0 && mm <= 30 && ss >= 0 && ss < 60) paceSec = mm * 60 + ss;
    }

    if (paceSec == null) {
      const all = [...text.matchAll(/(\d{1,2})\s*[:']\s*(\d{2})/g)];
      for (const m of all) {
        const mm = parseInt(m[1], 10);
        const ss = parseInt(m[2], 10);
        if (mm >= 0 && mm <= 30 && ss >= 0 && ss < 60) {
          paceSec = mm * 60 + ss;
          break;
        }
      }
    }

    // sanity
    if (distanceKm != null) distanceKm = clamp(distanceKm, 0, 999);
    if (paceSec != null) paceSec = clamp(paceSec, 0, 30 * 60 + 59);
    if (timeSec != null) timeSec = clamp(timeSec, 0, 99 * 3600 + 59 * 60 + 59);

    return { distanceKm, paceSec, timeSec };
  }

  async function recognizeNRCImage(file, onProgress) {
    if (!window.Tesseract) throw new Error('Tesseract is not loaded');

    const imgUrl = URL.createObjectURL(file);
    try {
      const { data } = await Tesseract.recognize(imgUrl, 'eng', {
        logger: (m) => {
          if (!onProgress) return;
          if (m.status && typeof m.progress === 'number') {
            onProgress(`${m.status} ${(m.progress * 100).toFixed(0)}%`);
          } else if (m.status) {
            onProgress(m.status);
          }
        }
      });

      const rawText = normalizeText(data?.text || '');
      const parsed = parseNRCText(rawText);
      return { ...parsed, rawText };
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }

  window.RunimateOCR = {
    recognizeNRCImage,
    parseNRCText
  };
})();
