// ui_config.js
// 디자인 레이아웃 및 폰트 크기/간격 설정 파일

export const UI_CONFIG = {
  fonts: {
    // 1. ANTON 폰트
    anton: {
      // Daily Type 1 (세로 스택)
      d1: {
        labelSize: 12,        // 라벨(DISTANCE 등) 크기
        valueSize: 34,        // 데이터 숫자 크기
        labelToValueGap: 0,   // 라벨과 숫자 사이 간격 (상하)
        stackGap: 18          // 데이터 덩어리들 간의 간격 (상하)
      },
      // Daily Type 2 (가로 나열)
      d2: {
        labelSize: 12,
        valueSize: 28,
        labelToValueGap: 8,
        colGap: 20            // 데이터 덩어리들 간의 간격 (좌우)
      },
      // Monthly Type 1 (상단 강조 + 하단 세로 스택)
      m1: {
        monthSize: 14,        // 상단 월/년도 폰트 크기
        distanceSize: 48,     // 메인 거리 데이터 크기
        monthToDistGap: 0,    // 월/년도와 거리 사이 간격
        distToStatsGap: 20,   // 거리와 하단 스탯 그룹 사이 간격
        statsLabelSize: 12,   // 하단 스탯 라벨 크기
        statsValueSize: 24,   // 하단 스탯 숫자 크기
        statsLvGap: 4,        // 하단 스탯 라벨-숫자 상하 간격
        statsStackGap: 14     // 하단 스탯 아이템 간의 상하 간격
      },
      // Monthly Type 2 (상단 강조 + 하단 가로 나열)
      m2: {
        monthSize: 14,
        distanceSize: 52,
        monthToDistGap: 0,
        distToStatsGap: 10,
        statsLabelSize: 12,
        statsValueSize: 10,
        statsLvGap: 4,
        statsColGap: 30       // 하단 스탯 아이템 간의 좌우 간격
      }
    },

    // 2. DOTS 폰트
    dots: {
      d1: { labelSize: 12, valueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 24, labelToValueGap: 0, colGap: 18 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 10, statsValueSize: 22, statsLvGap: 4, statsStackGap: 14 },
      m2: { monthSize: 20, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 10, statsLabelSize: 10, statsValueSize: 16, statsLvGap: 0, statsColGap: 18 }
    },

    // 3. LCD 폰트
    lcd: {
      d1: { labelSize: 12, valueSize: 38, labelToValueGap: 4, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 32, labelToValueGap: 4, colGap: 24 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 10, statsValueSize: 22, statsLvGap: 4, statsStackGap: 14 },
      m2: { monthSize: 18, distanceSize: 52, monthToDistGap: 8, distToStatsGap: 0, statsLabelSize: 10, statsValueSize: 18, statsLvGap: -4, statsColGap: 30 }
    },

    // 4. GOTHIC 폰트
    gothic: {
      d1: { labelSize: 12, valueSize: 24, labelToValueGap: 4, stackGap: 25 },
      d2: { labelSize: 9, valueSize: 18, labelToValueGap: 0, colGap: 20 },
      m1: { monthSize: 14, distanceSize: 36, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 10, statsValueSize: 20, statsLvGap: 4, statsStackGap: 14 },
      m2: { monthSize: 14, distanceSize: 36, monthToDistGap: 8, distToStatsGap: 6, statsLabelSize: 2, statsValueSize: 5, statsLvGap: 0, statsColGap: 24 }
    },

    // 5. SPEED 폰트
    speed: {
      d1: { labelSize: 12, valueSize: 28, labelToValueGap: 4, stackGap: 22 },
      d2: { labelSize: 12, valueSize: 24, labelToValueGap: 4, colGap: 18 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 10, statsValueSize: 22, statsLvGap: 4, statsStackGap: 14 },
      m2: { monthSize: 16, distanceSize: 52, monthToDistGap: 8, distToStatsGap: -10, statsLabelSize: 10, statsValueSize: 10, statsLvGap: -5, statsColGap: 24 }
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

  // [CSS 변수 매핑]
  if (recordType === 'daily') {
    // D1 & D2 공통
    set('--ui-label-size', config.labelSize);
    set('--ui-value-size', config.valueSize);
    set('--ui-lv-gap', config.labelToValueGap);
    // 개별
    if (layout === 'type1') set('--ui-stack-gap', config.stackGap);
    else set('--ui-col-gap', config.colGap);
  } else {
    // M1 & M2 공통
    set('--ui-month-size', config.monthSize);
    set('--ui-dist-size', config.distanceSize);
    set('--ui-md-gap', config.monthToDistGap);
    set('--ui-ds-gap', config.distToStatsGap);
    set('--ui-stats-label-size', config.statsLabelSize);
    set('--ui-stats-value-size', config.statsValueSize);
    set('--ui-stats-lv-gap', config.statsLvGap);
    // 개별
    if (layout === 'type1') set('--ui-stats-stack-gap', config.statsStackGap);
    else set('--ui-stats-col-gap', config.statsColGap);
  }
}
