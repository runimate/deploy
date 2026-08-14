// ui_config.js
// 디자인 레이아웃 및 폰트 크기/간격 설정 파일

export const UI_CONFIG = {
  fonts: {
    // =================================================================
    // 1. ANTON 폰트 (기존)
    // =================================================================
    anton: {
      // [Daily Type 1 - 세로 스택]
      d1_l: { labelSize: 13, valueSize: 34, labelToValueGap: 7, stackGap: 20 },
      d1_c: { labelSize: 13, valueSize: 34, labelToValueGap: 7, stackGap: 20 },
      // [Daily Type 2 - 가로 나열]
      d2_l: { labelSize: 12, valueSize: 28, labelToValueGap: 10, colGap: 35 },
      d2_c: { labelSize: 12, valueSize: 28, labelToValueGap: 10, colGap: 35 },
      // [Monthly]
      m1: { monthSize: 16, distanceSize: 44, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 12, statsValueSize: 26, statsLvGap: -20, statsStackGap: 20 },
      m2: { monthSize: 18, distanceSize: 48, monthToDistGap: 6, distToStatsGap: 24, statsLabelSize: 14, statsValueSize: 28, statsLvGap: 6, statsColGap: 34 }
    },

    // ... (기존 DOTS, LCD, GOTHIC, SPEED 코드는 그대로 유지) ...
    dots: {
      d1_l: { labelSize: 14, valueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d1_c: { labelSize: 14, valueSize: 32, labelToValueGap: 4, stackGap: 18 },
      d2_l: { labelSize: 12, valueSize: 24, labelToValueGap: 6, colGap: 24 },
      d2_c: { labelSize: 12, valueSize: 24, labelToValueGap: 6, colGap: 24 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 12, statsValueSize: 26, statsLvGap: -5, statsStackGap: 18 },
      m2: { monthSize: 18, distanceSize: 42, monthToDistGap: 6, distToStatsGap: 16, statsLabelSize: 12, statsValueSize: 24, statsLvGap: 4, statsColGap: 28 }
    },

    lcd: {
      d1_l: { labelSize: 15, valueSize: 38, labelToValueGap: 4, stackGap: 18 },
      d1_c: { labelSize: 15, valueSize: 38, labelToValueGap: 4, stackGap: 18 },
      d2_l: { labelSize: 13, valueSize: 32, labelToValueGap: 4, colGap: 30 },
      d2_c: { labelSize: 13, valueSize: 32, labelToValueGap: 4, colGap: 30 },
      m1: { monthSize: 18, distanceSize: 46, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 14, statsValueSize: 30, statsLvGap: -15, statsStackGap: 18 },
      m2: { monthSize: 18, distanceSize: 52, monthToDistGap: 6, distToStatsGap: 16, statsLabelSize: 16, statsValueSize: 30, statsLvGap: 2, statsColGap: 34 }
    },

    gothic: {
      d1_l: { labelSize: 12, valueSize: 28, labelToValueGap: 6, stackGap: 24 },
      d1_c: { labelSize: 12, valueSize: 28, labelToValueGap: 6, stackGap: 24 },
      d2_l: { labelSize: 10, valueSize: 18, labelToValueGap: 5, colGap: 28 },
      d2_c: { labelSize: 10, valueSize: 18, labelToValueGap: 5, colGap: 28 },
      m1: { monthSize: 14, distanceSize: 34, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 10, statsValueSize: 20, statsLvGap: -10, statsStackGap: 22 },
      m2: { monthSize: 14, distanceSize: 36, monthToDistGap: 8, distToStatsGap: 16, statsLabelSize: 10, statsValueSize: 22, statsLvGap: 6, statsColGap: 32 }
    },

    speed: {
      d1_l: { labelSize: 12, valueSize: 32, labelToValueGap: 4, stackGap: 22 },
      d1_c: { labelSize: 12, valueSize: 32, labelToValueGap: 4, stackGap: 22 },
      d2_l: { labelSize: 11, valueSize: 24, labelToValueGap: 6, colGap: 26 },
      d2_c: { labelSize: 11, valueSize: 24, labelToValueGap: 6, colGap: 26 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 12, statsValueSize: 26, statsLvGap: -10, statsStackGap: 18 },
      m2: { monthSize: 18, distanceSize: 46, monthToDistGap: 4, distToStatsGap: 16, statsLabelSize: 12, statsValueSize: 26, statsLvGap: 4, statsColGap: 28 }
    },

    // =================================================================
    // 2. EX 폰트 (신규 - Monthly 모드에서 EX 선택 시 사용되는 수치.
    //    Daily 모드는 index.html의 전용 .ex-card 레이아웃을 사용하며
    //    이 값을 참조하지 않음)
    // =================================================================
    ex: {
      d1_l: { labelSize: 12, valueSize: 32, labelToValueGap: 4, stackGap: 22 },
      d1_c: { labelSize: 12, valueSize: 32, labelToValueGap: 4, stackGap: 22 },
      d2_l: { labelSize: 11, valueSize: 24, labelToValueGap: 6, colGap: 26 },
      d2_c: { labelSize: 11, valueSize: 24, labelToValueGap: 6, colGap: 26 },
      m1: { monthSize: 14, distanceSize: 38, monthToDistGap: 8, distToStatsGap: 20, statsLabelSize: 12, statsValueSize: 26, statsLvGap: -10, statsStackGap: 18 },
      m2: { monthSize: 18, distanceSize: 46, monthToDistGap: 4, distToStatsGap: 16, statsLabelSize: 12, statsValueSize: 26, statsLvGap: 4, statsColGap: 28 }
    }
  }
};

export function applyUIConfigToRoot(state) {
  const { font, recordType, layout, align } = state;
  const fontConfig = UI_CONFIG.fonts[font] || UI_CONFIG.fonts.anton;

  let modeKey = '';
  if (recordType === 'daily') {
    const suffix = (align === 'center') ? '_c' : '_l';
    modeKey = (layout === 'type1') ? `d1${suffix}` : `d2${suffix}`;
  } else {
    modeKey = (layout === 'type1') ? 'm1' : 'm2';
  }

  const config = fontConfig[modeKey];
  if (!config) return;

  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, `${v}px`);

  if (recordType === 'daily') {
    set('--ui-label-size', config.labelSize);
    set('--ui-value-size', config.valueSize);
    set('--ui-label-to-value-gap', config.labelToValueGap);

    if (layout === 'type1') {
        set('--ui-stack-gap', config.stackGap);
    } else {
        set('--ui-col-gap', config.colGap);
    }
  } else {
    set('--ui-month-size', config.monthSize);
    set('--ui-distance-size', config.distanceSize);
    set('--ui-month-to-dist-gap', config.monthToDistGap);
    set('--ui-dist-to-stats-gap', config.distToStatsGap);
    set('--ui-label-size', config.statsLabelSize);
    set('--ui-value-size', config.statsValueSize);
    set('--ui-label-to-value-gap', config.statsLvGap);
    if (layout === 'type1') {
        set('--ui-stack-gap', config.statsStackGap);
    } else {
        set('--ui-col-gap', config.statsColGap);
    }
  }
}
