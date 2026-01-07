import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

// 1. 이미지 전처리
// 배경 노이즈를 줄이고 글자를 선명하게 만듭니다.
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
      
      // 그레이스케일 + 대비(Contrast) 최적화
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        // 160보다 밝으면 흰색으로 날리고, 아니면 더 진하게 눌러줌 (글자 선명화)
        const contrast = gray > 160 ? 255 : Math.max(0, gray - 40);
        data[i] = data[i+1] = data[i+2] = contrast;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
  });
}

// 2. 시간/페이스 텍스트 -> 초(Seconds) 변환 헬퍼
function parseToSeconds(textStr) {
    if (!textStr) return 0;
    // 숫자, 콜론, 점, 따옴표만 남기고 나머지 제거
    const clean = textStr.replace(/[^\d:'"’\.]/g, '');
    
    // 패턴 1: 시:분:초 (예: 1:20:30)
    let match = clean.match(/(\d+):(\d+):(\d+)/);
    if (match) return parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]);

    // 패턴 2: 분:초 또는 분'초" (예: 5'30", 38:12)
    match = clean.match(/(\d+)[:'’](\d+)/);
    if (match) return parseInt(match[1])*60 + parseInt(match[2]);

    return 0;
}

// 3. 메인 추출 함수
export async function extractAll(imageDatas, options = {}) {
  // 1) 전처리 수행
  const processedImg = await preprocessImage(imageDatas);

  // 2) Tesseract 워커 생성
  const worker = await createWorker('eng');
  
  // 3) 화이트리스트 설정 (핵심!)
  // 한글, 영어 라벨은 아예 읽지 않도록 숫자와 기호만 허용합니다.
  // 이렇게 하면 "Avg Pace" 같은 글자는 무시되고 숫자 데이터만 남습니다.
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.:\'"’', 
  });

  // 4) 인식 실행 (텍스트 위치 정보인 lines를 활용)
  const ret = await worker.recognize(processedImg);
  const lines = ret.data.lines; 
  await worker.terminate();

  // --- [로직 핵심] 위치와 크기(Geometry)로 데이터 찾기 ---
  
  // 1단계: 유효한 "숫자 데이터" 라인만 필터링
  // bbox: {x0, y0, x1, y1} 좌표 정보를 가짐
  const dataLines = lines.filter(line => {
      const text = line.text.trim();
      // 숫자가 포함되어 있고 길이가 2 이상인 것만 (노이즈 제거)
      return /\d/.test(text) && text.length >= 2; 
  }).map(line => {
      const bbox = line.bbox; 
      return {
          text: line.text.trim(),
          y: bbox.y0,             // 상단 위치 (작을수록 위에 있음)
          x: bbox.x0,             // 좌측 위치 (작을수록 왼쪽에 있음)
          height: bbox.y1 - bbox.y0 // 글자 높이 (클수록 폰트가 큼)
      };
  });

  // 데이터가 없으면 0 리턴
  if (dataLines.length === 0) return { km:0, paceSec:0, timeSec:0 };

  // 2단계: "거리(Distance)" 찾기 
  // 규칙: 글자 크기(height)가 가장 큰 숫자가 무조건 거리입니다.
  // 내림차순 정렬
  dataLines.sort((a, b) => b.height - a.height);
  
  const distanceObj = dataLines[0]; // 가장 큰 놈
  // 텍스트에서 숫자만 추출 (7.77 -> 7.77)
  const distMatch = distanceObj.text.match(/(\d+\.?\d*)/);
  const km = distMatch ? parseFloat(distMatch[0]) : 0;


  // 3단계: 나머지 데이터(페이스, 시간) 찾기
  // 규칙: 거리 텍스트보다 "아래(Y가 더 큼)"에 있는 것들을 추립니다.
  let others = dataLines.filter(item => item !== distanceObj && item.y > distanceObj.y);

  // 정렬 규칙: 
  // 1. Y좌표(위->아래)가 우선.
  // 2. 만약 Y좌표가 비슷하다면(같은 줄이라면), X좌표(왼->오) 순서.
  others.sort((a, b) => {
      // Y좌표 차이가 20픽셀 이내면 같은 줄(Row)로 간주 -> 왼쪽부터 읽기
      if (Math.abs(a.y - b.y) < 20) {
          return a.x - b.x;
      }
      // 아니면 위에서부터 읽기
      return a.y - b.y;
  });

  // 정렬 결과:
  // others[0] -> 무조건 첫 번째 데이터 (Pace)
  // others[1] -> 무조건 두 번째 데이터 (Time)
  // others[2] -> (있다면) 칼로리 등 -> 무시
  
  let paceSec = 0;
  let timeSec = 0;

  if (others.length > 0) paceSec = parseToSeconds(others[0].text);
  if (others.length > 1) timeSec = parseToSeconds(others[1].text);

  // 4단계: 상호 보정 (누락된 값 채우기)
  // OCR이 페이스나 시간을 놓쳤을 때, 거리와 남은 하나로 역산
  if (timeSec === 0 && km > 0 && paceSec > 0) timeSec = Math.round(km * paceSec);
  if (paceSec === 0 && km > 0 && timeSec > 0) paceSec = Math.round(timeSec / km);

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
