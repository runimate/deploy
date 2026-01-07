/* ocr.js - v3.0 Improved Logic */
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

// 1. 이미지 전처리 개선 (너무 강한 이진화 제거)
// 흑백으로 바꾸되, 글자를 너무 깎아먹지 않도록 부드럽게 처리
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
      
      // 그레이스케일 변환 및 대비 증가 (Thresholding 대신 Contrast 사용)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 밝기 계산 (가중치 적용)
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // 대비를 높임 (글자는 더 진하게, 배경은 더 하얗게)
        // 180보다 밝으면 255(흰색), 아니면 원래 색보다 조금 더 어둡게
        if (gray > 180) {
            gray = 255;
        } else {
            gray = Math.max(0, gray - 50); // 글자 강조
        }

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
  });
}

// 2. 시간/페이스 파싱 헬퍼 (유연성 강화)
function parseToSeconds(textStr) {
    if (!textStr) return 0;
    
    // 노이즈 제거 (알파벳, 공백 제거하고 숫자와 : ' " 만 남김)
    // 예: "4' 55''" -> "4'55''"
    const clean = textStr.replace(/[^\d:'"’]/g, '');
    
    // 패턴 1: 분'초" (페이스)
    // 따옴표 종류가 다양해서( ' ’ " ) 모두 대응
    let match = clean.match(/(\d+)['’](\d+)/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    
    // 패턴 2: 시:분:초
    match = clean.match(/(\d+):(\d+):(\d+)/);
    if (match) {
        return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    }

    // 패턴 3: 분:초
    match = clean.match(/(\d+):(\d+)/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    
    return 0;
}

export async function extractAll(imageDatas, options = {}) {
  // 1) 전처리 실행
  const processedImg = await preprocessImage(imageDatas);

  // 2) Tesseract 워커 생성
  const worker = await createWorker('eng');
  
  // 3) 설정 변경 (중요!)
  // 이전에는 숫자만 읽게 해서 'Pace' 같은 단어를 못 읽음 -> 알파벳 대소문자 추가
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.:\'"’kmKM/ \nabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  });

  // 4) 인식
  const ret = await worker.recognize(processedImg);
  let text = ret.data.text;
  await worker.terminate();

  // 디버깅용 로그 (브라우저 콘솔에서 확인 가능)
  console.log('--- OCR RAW TEXT ---');
  console.log(text);
  console.log('--------------------');

  // 5) 데이터 추출 로직 (키워드 기반 + 라인 매칭)
  // 텍스트를 줄 단위로 나눕니다.
  // NRC는 보통 [값] [줄바꿈] [라벨] 순서로 되어 있습니다.
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let km = 0;
  let paceSec = 0;
  let timeSec = 0;

  // --- A. 거리 (Distance) 찾기 ---
  // 가장 큰 숫자 혹은 "Km", "Kilometers" 근처의 숫자
  for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // "숫자.숫자" 패턴 찾기 (예: 7.77)
      const distMatch = line.match(/(\d+\.\d{2})/);
      
      if (distMatch) {
          // 바로 아래 줄이나 같은 줄에 'km', 'Kilometers'가 있는지 확인
          const nextLine = lines[i+1] || "";
          const combined = (line + " " + nextLine).toLowerCase();
          
          if (combined.includes('km') || combined.includes('kilometers') || combined.includes('miles')) {
              km = parseFloat(distMatch[1]);
              break; // 거리를 찾으면 루프 종료
          }
      }
  }
  // 만약 못 찾았으면, 그냥 텍스트 전체에서 가장 먼저 나오는 "소수점 두자리 숫자"를 거리로 간주 (fallback)
  if (km === 0) {
      const fallback = text.match(/(\d+\.\d{2})/);
      if (fallback) km = parseFloat(fallback[1]);
  }


  // --- B. 페이스 (Pace) 찾기 ---
  // "Pace" 또는 "Avg" 라는 단어가 있는 줄의 '윗 줄' 혹은 '같은 줄'을 찾음
  for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('pace') || line.includes('avg')) {
          // 1. 같은 줄에서 숫자 찾기 (예: 4'55'' Avg. Pace)
          let val = parseToSeconds(lines[i]);
          
          // 2. 없으면 윗 줄에서 찾기 (NRC 레이아웃은 보통 값이 위에 있음)
          if (val === 0 && i > 0) {
              val = parseToSeconds(lines[i-1]);
          }
          
          if (val > 0) {
              paceSec = val;
              break;
          }
      }
  }
  // 키워드로 못 찾았으면 패턴(x'xx")으로 찾기
  if (paceSec === 0) {
      const paceMatch = text.match(/(\d+)['’](\d+)/);
      if (paceMatch) {
          paceSec = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
      }
  }


  // --- C. 시간 (Time) 찾기 ---
  // "Time" 이라는 단어가 있는 줄의 '윗 줄' 혹은 '같은 줄'
  for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      // 'time' 단어가 있고, 'pace' 단어는 없는 줄 (페이스랑 헷갈림 방지)
      if (line.includes('time') && !line.includes('pace')) {
           // 1. 같은 줄 검사
           let val = parseToSeconds(lines[i]);
           
           // 2. 윗 줄 검사
           if (val === 0 && i > 0) {
               val = parseToSeconds(lines[i-1]);
           }

           if (val > 0) {
               timeSec = val;
               break;
           }
      }
  }
  // 키워드로 못 찾았으면 패턴(h:mm:ss 또는 mm:ss)으로 찾기
  if (timeSec === 0) {
      // 페이스 패턴(')이 없고 콜론(:)이 있는 것
      // 전체 텍스트에서 찾되, 페이스로 인식된 값과 다른 값을 찾아야 함
      const potentialTimes = text.match(/(\d+):(\d{2})/g);
      if (potentialTimes) {
          for (let pt of potentialTimes) {
              const s = parseToSeconds(pt);
              // 페이스랑 값이 겹치지 않고, 너무 짧지 않은(예: 0:00) 값
              if (s !== paceSec && s > 0) {
                  // 만약 여러개라면 가장 큰 값(보통 총 시간이 페이스보다 긺)을 선택하거나 첫번째 선택
                  timeSec = s;
                  break; 
              }
          }
      }
  }
  
  // --- 보정 (Fallback Calculation) ---
  // 하나가 누락되었는데 나머지 둘이 있다면 수학적으로 계산해서 채워넣음
  if (timeSec === 0 && km > 0 && paceSec > 0) {
      timeSec = Math.round(km * paceSec);
  }
  if (paceSec === 0 && km > 0 && timeSec > 0) {
      paceSec = Math.round(timeSec / km);
  }

  return {
    km,
    paceMin: Math.floor(paceSec / 60),
    paceSec: paceSec % 60,
    timeH: Math.floor(timeSec / 3600),
    timeM: Math.floor((timeSec % 3600) / 60),
    timeS: timeSec % 60,
    runs: 0 // Monthly는 필요 시 추가
  };
}
