// ui_config.js

/* [설정 가이드]
  - D1 (Daily Type 1): 세로 스택형 (라벨/값/간격 제어)
  - D2 (Daily Type 2): 가로 나열형 (컬럼 간격 제어 추가)
  - M1 (Monthly Type 1): 월/거리 강조 + 하단 세로 스택
  - M2 (Monthly Type 2): 월/거리 강조 + 하단 가로 나열
  - 모든 값은 픽셀(px) 단위의 숫자입니다.
*/

export const UI_CONFIG = {
  // 전역 기본값 (폰트별 설정이 없을 경우 사용)
  global: {
    colGap: 24,       // D2, M2 가로 간격
    rowGap: 18,       // D1 스택 간격
    rowGapResult: 18  // 결과 화면 스택 간격
  },

  fonts: {
    // 1. ANTON 폰트 설정
    anton: {
      d1: {
        labelSize: 12,        // 라벨 폰트 크기
        valueSize: 34,        // 숫자 폰트 크기
        distanceValueSize: 34,// 거리 숫자(Km)는 더 크게 하려면 수정
        labelToValueGap: 8,   // 라벨과 숫자 사이 간격
        stackGap: 18          // 항목(Distance/Pace/Time) 간의 간격
      },
      d2: {
        labelSize: 12,
        valueSize: 34,
        labelToValueGap: 8,
        colGap: 24            // 좌우 컬럼 간격
      },
      m1: {
        monthSize: 14,          // 상단 날짜 크기
        monthToDistanceGap: 8,  // 날짜와 거리 사이
        distanceSize: 36,       // 메인 거리 크기
        distanceToStatsGap: 14, // 거리와 하단 스탯 사이
        labelSize: 10,          // 하단 스탯 라벨
        valueSize: 24,          // 하단 스탯 값
        labelToValueGap: 8,
        stackGap: 18
      },
      m2: {
        monthSize: 14,
        monthToDistanceGap: 8,
        distanceSize: 36,
        distanceToStatsGap: 14,
        labelSize: 10,
        valueSize: 24,
        labelToValueGap: 8,
        colGap: 24
      }
    },

    // 2. DOTS 폰트 설정 (예시)
    dots: {
      d1: { labelSize: 12, valueSize: 32, distanceValueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 32, labelToValueGap: 4, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 34, distanceToStatsGap: 14, labelSize: 10, valueSize: 22, labelToValueGap: 4, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 34, distanceToStatsGap: 14, labelSize: 10, valueSize: 22, labelToValueGap: 4, colGap: 24 }
    },

    // 3. LCD 폰트 설정
    lcd: {
      d1: { labelSize: 12, valueSize: 32, distanceValueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 32, labelToValueGap: 4, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 34, distanceToStatsGap: 14, labelSize: 10, valueSize: 22, labelToValueGap: 4, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 34, distanceToStatsGap: 14, labelSize: 10, valueSize: 22, labelToValueGap: 4, colGap: 24 }
    },

    // 4. GOTHIC 폰트 설정
    gothic: {
      d1: { labelSize: 12, valueSize: 30, distanceValueSize: 30, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 30, labelToValueGap: 4, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 32, distanceToStatsGap: 14, labelSize: 10, valueSize: 20, labelToValueGap: 4, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 32, distanceToStatsGap: 14, labelSize: 10, valueSize: 20, labelToValueGap: 4, colGap: 24 }
    },

    // 5. SPEED 폰트 설정
    speed: {
      d1: { labelSize: 12, valueSize: 32, distanceValueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 32, labelToValueGap: 4, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 34, distanceToStatsGap: 14, labelSize: 10, valueSize: 22, labelToValueGap: 4, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 34, distanceToStatsGap: 14, labelSize: 10, valueSize: 22, labelToValueGap: 4, colGap: 24 }
    }
  }
};

// CSS 변수를 Root에 적용하는 함수
export function applyUIConfigToRoot(state) {
  const { font, recordType, layout } = state;
  
  // 1. 현재 폰트 설정 가져오기 (없으면 anton 기본)
  const fontConfig = UI_CONFIG.fonts[font] || UI_CONFIG.fonts.anton;
  
  // 2. 현재 모드 결정 (D1, D2, M1, M2)
  let modeKey = '';
  if (recordType === 'daily') {
    modeKey = (layout === 'type1') ? 'd1' : 'd2';
  } else {
    modeKey = (layout === 'type1') ? 'm1' : 'm2';
  }
  
  const config = fontConfig[modeKey];
  const root = document.documentElement;

  // 3. CSS 변수 주입 (px 단위)
  
  // 공통: 라벨 크기
  if (config.labelSize) root.style.setProperty('--ui-label-size', `${config.labelSize}px`);
  
  // 공통: 값(숫자) 크기
  if (config.valueSize) root.style.setProperty('--ui-value-size', `${config.valueSize}px`);
  
  // 공통: 라벨과 값 사이 간격
  if (config.labelToValueGap) root.style.setProperty('--ui-label-to-value-gap', `${config.labelToValueGap}px`);
  
  // D1, M1: 항목 간 세로 간격
  if (config.stackGap) root.style.setProperty('--ui-stack-gap', `${config.stackGap}px`);
  
  // D2, M2: 항목 간 가로 간격
  if (config.colGap) root.style.setProperty('--ui-col-gap', `${config.colGap}px`);

  // Monthly 전용 설정
  if (modeKey.startsWith('m')) {
    if (config.monthSize) root.style.setProperty('--ui-month-size', `${config.monthSize}px`);
    if (config.distanceSize) root.style.setProperty('--ui-distance-size', `${config.distanceSize}px`);
    if (config.monthToDistanceGap) root.style.setProperty('--ui-month-to-dist-gap', `${config.monthToDistanceGap}px`);
    if (config.distanceToStatsGap) root.style.setProperty('--ui-dist-to-stats-gap', `${config.distanceToStatsGap}px`);
  }
}
