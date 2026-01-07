/* ocr.js */
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

// 1. 이미지 전처리 (노이즈 제거 및 글자 선명화)
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
      
      // 그레이스케일 + 대비(Contrast) 증가
      for (let i = 0; i < data.length; i += 4) {
        // 밝기 계산 (Y = 0.299R + 0.587G + 0.114B)
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        
        // Thresholding: 160보다 밝으면 흰색, 아니면 진하게 눌러줌
        const contrast = gray > 160 ? 255 : Math.max(0, gray - 40);
        
        data[i] = data[i+1] = data[i+2] = contrast;
      }
      
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
  });
}

// 2. 텍스트 파싱 헬퍼 (문자열 -> 초 단위 변환)
function parseToSeconds(textStr) {
    if (!textStr) return 0;
    // 숫자, :, ', ", . 만 남기고 제거
    const clean = textStr.replace(/[^\d:'"’\.]/g, '');
    
    // 패턴 1: 시:분:초 (예: 1:20:30)
    let match = clean.match(/(\d+):(\d+):(\d+)/);
    if (match) return parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]);

    // 패턴 2: 분:초 또는 분'초" (예: 5'30", 38:12)
    match = clean.match(/(\d+)[:'’](\d+)/);
    if (match) return parseInt(match[1])*60 + parseInt(match[2]);

    return 0;
}

// 3. 메인 추출 함수 (하이브리드 로직)
export async function extractAll(imageDatas, options = {}) {
  // 1) 전처리 실행
  const processedImg = await preprocessImage(imageDatas);

  // 2) Tesseract 워커 생성
  const worker = await createWorker('eng');
  
  // 3) 설정: 숫자, 기호, 단위(k, m)만 허용 (한글/영어 라벨 무시)
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.:\'"’kmKM', 
  });

  // 4) 인식 실행 (텍스트 위치 정보인 lines와 전체 텍스트 fullText 모두 활용)
  const ret = await worker.recognize(processedImg);
  const lines = ret.data.lines; 
  const fullText = ret.data.text; 
  await worker.terminate();

  // --- [Plan A] 위치/크기 기반 (Geometry) ---
  let resultA = { km: 0, paceSec: 0, timeSec: 0 };
  
  // 유효한 데이터 라인 필터링 (숫자가 있고 길이가 2 이상)
  const dataLines = lines.filter(line => {
      const t = line.text.trim();
      return /\d/.test(t) && t.length >= 2; 
  }).map(line => ({
      text: line.text.trim(),
      y: line.bbox.y0,             // 상단 위치
      x: line.bbox.x0,             // 좌측 위치
      height: line.bbox.y1 - line.bbox.y0 // 글자 높이
  }));

  if (dataLines.length > 0) {
      // 1. 거리(Distance): 글자 크기가 가장 큰 것
      dataLines.sort((a, b) => b.height - a.height);
      const distMatch = dataLines[0].text.match(/(\d+\.?\d*)/);
      if (distMatch) resultA.km = parseFloat(distMatch[0]);

      // 2. 페이스 & 시간: 거리보다 아래에 있는 것들
      const distanceY = dataLines[0].y;
      let others = dataLines.filter(item => item !== dataLines[0] && item.y > distanceY);
      
      // 정렬: Y좌표 우선(위->아래), 비슷하면 X좌표 우선(좌->우)
      others.sort((a, b) => {
          if (Math.abs(a.y - b.y) < 20) return a.x - b.x;
          return a.y - b.y;
      });

      // 첫 번째는 무조건 페이스, 두 번째는 무조건 시간
      if (others.length > 0) resultA.paceSec = parseToSeconds(others[0].text);
      if (others.length > 1) resultA.timeSec = parseToSeconds(others[1].text);
  }

  // --- [Plan B] 텍스트 패턴 기반 (Fallback) ---
  // Plan A가 실패해서 값이 0일 경우, 전체 텍스트에서 '모양'을 찾아 채워넣음
  
  // 1. 페이스 패턴: 숫자'숫자" (예: 5'30")
  if (resultA.paceSec === 0) {
      const paceMatch = fullText.match(/(\d+)['’](\d+)["'’]?/);
      if (paceMatch) {
          resultA.paceSec = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
      }
  }

  // 2. 시간 패턴: 시:분:초 또는 긴 분:초
  if (resultA.timeSec === 0) {
      // h:mm:ss 찾기
      const timeFullMatch = fullText.match(/(\d+):(\d{2}):(\d{2})/);
      if (timeFullMatch) {
          resultA.timeSec = parseInt(timeFullMatch[1])*3600 + parseInt(timeFullMatch[2])*60 + parseInt(timeFullMatch[3]);
      } else {
          // mm:ss 찾기 (단, 페이스 값과 겹치지 않는 것)
          const timeMatches = fullText.matchAll(/(\d+):(\d{2})/g);
          for (const m of timeMatches) {
              const val = parseInt(m[1]) * 60 + parseInt(m[2]);
              // 1분 이상이고, 이미 찾은 페이스와 값이 다르면 시간으로 간주
              if (val > 60 && val !== resultA.paceSec) {
                  resultA.timeSec = val;
                  break; 
              }
          }
      }
  }
  
  // 3. 거리 패턴: "k" 또는 "m" 근처의 숫자 (Plan A도 실패했을 경우 최후의 수단)
  if (resultA.km === 0) {
      const kmMatch = fullText.match(/(\d+\.\d+)\s*[kKmM]/);
      if (kmMatch) resultA.km = parseFloat(kmMatch[1]);
  }

  // --- [Final] 상호 보정 (Calculation) ---
  // 셋 중 하나가 비었으면 수학적으로 계산해서 채움
  let { km, paceSec, timeSec } = resultA;

  if (timeSec === 0 && km > 0 && paceSec > 0) timeSec = Math.round(km * paceSec);
  if (paceSec === 0 && km > 0 && timeSec > 0) paceSec = Math.round(timeSec / km);
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
