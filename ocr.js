import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

// 1. 이미지 전처리
function preprocessImage(imageSource) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSource;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // 글자를 더 선명하게 (Contrast)
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const contrast = gray > 160 ? 255 : Math.max(0, gray - 40);
        data[i] = data[i+1] = data[i+2] = contrast;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
  });
}

// 2. 파싱 헬퍼 (문자열 -> 초)
function parseToSeconds(textStr) {
    if (!textStr) return 0;
    const clean = textStr.replace(/[^\d:'"’\.]/g, '');
    
    // 시:분:초
    let match = clean.match(/(\d+):(\d+):(\d+)/);
    if (match) return parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]);

    // 분:초 or 분'초"
    match = clean.match(/(\d+)[:'’](\d+)/);
    if (match) return parseInt(match[1])*60 + parseInt(match[2]);

    return 0;
}

// 3. 메인 추출 함수 (하이브리드)
export async function extractAll(imageDatas, options = {}) {
  const processedImg = await preprocessImage(imageDatas);

  const worker = await createWorker('eng');
  // 숫자, 기호, 그리고 영어 대문자(KM 등을 위해) 허용
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.:\'"’kmKM', 
  });

  const ret = await worker.recognize(processedImg);
  const lines = ret.data.lines; // 위치 정보가 포함된 라인들
  const fullText = ret.data.text; // 전체 텍스트 (Plan B용)
  await worker.terminate();

  // --- [Plan A] 위치/크기 기반 (Geometry) ---
  let resultA = { km: 0, paceSec: 0, timeSec: 0 };
  
  // 유효한 데이터 라인 필터링
  const dataLines = lines.filter(line => {
      const t = line.text.trim();
      return /\d/.test(t) && t.length >= 2; 
  }).map(line => ({
      text: line.text.trim(),
      y: line.bbox.y0,
      x: line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0
  }));

  if (dataLines.length > 0) {
      // 1. 거리: 가장 큰 글자
      dataLines.sort((a, b) => b.height - a.height);
      const distMatch = dataLines[0].text.match(/(\d+\.?\d*)/);
      if (distMatch) resultA.km = parseFloat(distMatch[0]);

      // 2. 페이스/시간: 거리보다 아래에 있는 것들 정렬
      const distanceY = dataLines[0].y;
      let others = dataLines.filter(item => item !== dataLines[0] && item.y > distanceY);
      
      // 정렬: Y우선, Y비슷하면 X우선 (Pace -> Time 순서)
      others.sort((a, b) => {
          if (Math.abs(a.y - b.y) < 20) return a.x - b.x;
          return a.y - b.y;
      });

      if (others.length > 0) resultA.paceSec = parseToSeconds(others[0].text);
      if (others.length > 1) resultA.timeSec = parseToSeconds(others[1].text);
  }

  // --- [Plan B] 텍스트 패턴 기반 (Regex Fallback) ---
  // Plan A가 실패(0)했을 경우, 전체 텍스트에서 '모양'을 찾아 채워넣음
  
  // 1. 페이스 패턴: 숫자'숫자" (예: 5'30")
  if (resultA.paceSec === 0) {
      // 따옴표(')와 쌍따옴표(")가 같이 있는 패턴 찾기
      const paceMatch = fullText.match(/(\d+)['’](\d+)["'’]?/);
      if (paceMatch) {
          resultA.paceSec = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
          // console.log("Plan B (Pace) Activated:", paceMatch[0]);
      }
  }

  // 2. 시간 패턴: 시:분:초 또는 긴 분:초
  if (resultA.timeSec === 0) {
      // h:mm:ss
      const timeFullMatch = fullText.match(/(\d+):(\d{2}):(\d{2})/);
      if (timeFullMatch) {
          resultA.timeSec = parseInt(timeFullMatch[1])*3600 + parseInt(timeFullMatch[2])*60 + parseInt(timeFullMatch[3]);
      } else {
          // mm:ss (페이스랑 헷갈릴 수 있으므로, 페이스 값과 다른 것 찾기)
          const timeMatches = fullText.matchAll(/(\d+):(\d{2})/g);
          for (const m of timeMatches) {
              const val = parseInt(m[1]) * 60 + parseInt(m[2]);
              // 페이스가 아니면서(값이 다르고), 너무 짧지 않은(1분 이상) 값
              if (val !== resultA.paceSec && val > 60) {
                  resultA.timeSec = val;
                  // console.log("Plan B (Time) Activated:", m[0]);
                  break; // 첫 번째 유효한 시간 발견 시 종료
              }
          }
      }
  }
  
  // 3. 거리 패턴: "k" 또는 "m" 근처의 숫자 (Plan A가 실패했을 때만)
  if (resultA.km === 0) {
      const kmMatch = fullText.match(/(\d+\.\d+)\s*[kKmM]/);
      if (kmMatch) {
          resultA.km = parseFloat(kmMatch[1]);
      }
  }

  // --- [Final] 상호 보정 (Calculation) ---
  let { km, paceSec, timeSec } = resultA;

  // 값이 2개만 있고 1개가 비었을 때 수학적으로 계산
  if (timeSec === 0 && km > 0 && paceSec > 0) timeSec = Math.round(km * paceSec);
  if (paceSec === 0 && km > 0 && timeSec > 0) paceSec = Math.round(timeSec / km);
  // 시간이 있고 페이스가 있는데 거리가 0인 경우 (드물지만)
  if (km === 0 && timeSec > 0 && paceSec > 0) km = parseFloat((timeSec / paceSec).toFixed(2));

  return {
    km,
    paceMin: Math.floor(paceSec / 60),
    paceSec: paceSec % 60,
    timeH: Math.floor(timeSec / 3600),
    timeM: Math.floor((timeSec % 3600) / 60),
    timeS: timeSec % 60,
    runs: 0
  };
}
