/* ocr.js */

// 이미지 전처리 함수
function preprocessImage(imageSource) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageSource;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // 흑백/대비 증가 처리
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const contrast = gray > 160 ? 255 : Math.max(0, gray - 40);
        data[i] = contrast;
        data[i+1] = contrast;
        data[i+2] = contrast;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
  });
}

// 텍스트 추출 함수 (전역 함수로 선언)
async function extractAll(imageSource) {
  if (typeof Tesseract === 'undefined') {
      alert("Tesseract 라이브러리가 로드되지 않았습니다.");
      return {};
  }

  const processedImage = await preprocessImage(imageSource);
  const worker = await Tesseract.createWorker('eng');
  
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.:kKmMsS/ ',
  });

  const { data: { text } } = await worker.recognize(processedImage);
  await worker.terminate();

  // 결과 파싱
  const resultA = { km: 0, paceSec: 0, timeSec: 0, runs: 0 };
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = lines.join(' ').toLowerCase();

  // 1. 페이스
  const paceMatch = fullText.match(/(\d+)'(\d{2})"/);
  if (paceMatch) {
      resultA.paceSec = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
  } else {
      const paceSlash = fullText.match(/(\d+):(\d{2})\s*[\/]?\s*k/);
      if (paceSlash) resultA.paceSec = parseInt(paceSlash[1]) * 60 + parseInt(paceSlash[2]);
  }

  // 2. 시간
  if (resultA.timeSec === 0) {
      const timeFullMatch = fullText.match(/(\d+):(\d{2}):(\d{2})/);
      if (timeFullMatch) {
          resultA.timeSec = parseInt(timeFullMatch[1])*3600 + parseInt(timeFullMatch[2])*60 + parseInt(timeFullMatch[3]);
      } else {
          const timeMatches = fullText.matchAll(/(\d+):(\d{2})/g);
          for (const m of timeMatches) {
              const val = parseInt(m[1]) * 60 + parseInt(m[2]);
              if (val > 60 && val !== resultA.paceSec) {
                  resultA.timeSec = val;
                  break; 
              }
          }
      }
  }
  
  // 3. 거리
  if (resultA.km === 0) {
      const kmMatch = fullText.match(/(\d+\.\d+)\s*[kKmM]/);
      if (kmMatch) resultA.km = parseFloat(kmMatch[1]);
  }

  // 상호 보정
  let { km, paceSec, timeSec } = resultA;
  if (km > 0 && paceSec > 0 && timeSec === 0) timeSec = Math.round(km * paceSec);
  if (timeSec > 0 && paceSec > 0 && km === 0) km = parseFloat((timeSec / paceSec).toFixed(2));
  if (timeSec > 0 && km > 0 && paceSec === 0) paceSec = Math.round(timeSec / km);

  return { km, paceMin: Math.floor(paceSec/60), paceSec: paceSec%60, timeH: Math.floor(timeSec/3600), timeM: Math.floor((timeSec%3600)/60), timeS: timeSec%60 };
}
