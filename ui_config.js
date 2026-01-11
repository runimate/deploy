// ui_config.js
// 디자인 레이아웃 및 폰트 크기/간격 설정 파일

export const UI_CONFIG = {
  fonts: {
    // 1. ANTON 폰트
    anton: {
      // Daily Type 1 (세로 스택)
      d1: {
        labelSize: 13,        
        valueSize: 34,        
        labelToValueGap: 8,   
        stackGap: 20          
      },
      // Daily Type 2 (가로 나열)
      d2: {
        labelSize: 12,
        valueSize: 28,
        labelToValueGap: 10,
        colGap: 30           
      },
      // Monthly Type 1 (상단 강조 + 하단 세로 스택)
      m1: {
        monthSize: 16,        
        distanceSize: 44,     
        monthToDistGap: 8,    
        distToStatsGap: 10,   
        statsLabelSize: 12,   
        statsValueSize: 24,   
        statsLvGap: 10,        
        statsStackGap: 14     
      },
      // Monthly Type 2 (상단 강조 + 하단 가로 나열)
      m2: {
        monthSize: 18,
        distanceSize: 48,
        monthToDistGap: 6,
        distToStatsGap: 10,
        statsLabelSize: 14,
        statsValueSize: 28,
        statsLvGap: 6,
        statsColGap: 34       
      }
    },

    // 2. DOTS 폰트
    dots: {
      d1: { labelSize: 14, valueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 24, labelToValueGap: 4, colGap: 18 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 0, statsLabelSize: 14, statsValueSize: 24, statsLvGap: 10, statsStackGap: 14 },
      m2: { monthSize: 18, distanceSize: 42, monthToDistGap: 6, distToStatsGap: 5, statsLabelSize: 16, statsValueSize: 24, statsLvGap: 4, statsColGap: 28 }
    },

    // 3. LCD 폰트
    lcd: {
      d1: { labelSize: 15, valueSize: 38, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 32, labelToValueGap: 4, colGap: 28 },
      m1: { monthSize: 14, distanceSize: 46, monthToDistGap: 8, distToStatsGap: 0, statsLabelSize: 14, statsValueSize: 24, statsLvGap: 10, statsStackGap: 14 },
      m2: { monthSize: 18, distanceSize: 52, monthToDistGap: 6, distToStatsGap: 0, statsLabelSize: 16, statsValueSize: 30, statsLvGap: 2, statsColGap: 34 }
    },

    // 4. GOTHIC 폰트
    gothic: {
      d1: { labelSize: 12, valueSize: 28, labelToValueGap: 6, stackGap: 24 },
      d2: { labelSize: 10, valueSize: 18, labelToValueGap: 4, colGap: 26 },
      m1: { monthSize: 14, distanceSize: 34, monthToDistGap: 8, distToStatsGap: 0, statsLabelSize: 10, statsValueSize: 20, statsLvGap: 10, statsStackGap: 14 },
      m2: { monthSize: 14, distanceSize: 36, monthToDistGap: 8, distToStatsGap: 6, statsLabelSize: 10, statsValueSize: 22, statsLvGap: 6, statsColGap: 32 }
    },

    // 5. SPEED 폰트
    speed: {
      d1: { labelSize: 12, valueSize: 32, labelToValueGap: 4, stackGap: 22 },
      d2: { labelSize: 12, valueSize: 24, labelToValueGap: 4, colGap: 24 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 0, statsLabelSize: 10, statsValueSize: 22, statsLvGap: 8, statsStackGap: 14 },
      m2: { monthSize: 18, distanceSize: 46, monthToDistGap: 4, distToStatsGap: 0, statsLabelSize: 12, statsValueSize: 26, statsLvGap: 4, statsColGap: 28 }
    }
  }
};

// 설정을 Root CSS 변수로 주입하는 함수
export function applyUIConfigToRoot(state) {
  const { font, recordType, layout } = state;
  const fontConfig = UI_CONFIG.fonts[font] || UI_CONFIG.fonts.anton;
  
  // 현재 모드 키 생성 (d1, d2, m1, m2)
  let modeKey = '';
  if (recordType === 'daily') {
    modeKey = (layout === 'type1') ? 'd1' : 'd2';
  } else {
    modeKey = (layout === 'type1') ? 'm1' : 'm2';
  }
  
  const config = fontConfig[modeKey];
  if (!config) return;

  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, `${v}px`);

  // [CSS 변수 매핑 - 중요: HTML의 CSS 변수명과 일치시켜야 함]
  if (recordType === 'daily') {
    // D1 & D2 공통
    set('--ui-label-size', config.labelSize);
    set('--ui-value-size', config.valueSize);
    set('--ui-label-to-value-gap', config.labelToValueGap);
    // 개별
    if (layout === 'type1') set('--ui-stack-gap', config.stackGap);
    else set('--ui-col-gap', config.colGap);
  } else {
    // Monthly 공통 (상단)
    set('--ui-month-size', config.monthSize);
    set('--ui-distance-size', config.distanceSize); // 변수명 일치시킴
    set('--ui-month-to-dist-gap', config.monthToDistGap);
    set('--ui-dist-to-stats-gap', config.distToStatsGap);

    // Monthly 공통 (하단 스탯 - 기존 CSS 변수 재활용하여 적용)
    set('--ui-label-size', config.statsLabelSize); // --ui-stats-label-size 대신 --ui-label-size 사용
    set('--ui-value-size', config.statsValueSize);
    set('--ui-label-to-value-gap', config.statsLvGap);

    // 개별 (하단 레이아웃)
    if (layout === 'type1') set('--ui-stack-gap', config.statsStackGap); // --ui-stats-stack-gap 대신 --ui-stack-gap 사용
    else set('--ui-col-gap', config.statsColGap);
  }
}
