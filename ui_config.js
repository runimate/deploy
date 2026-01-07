/* ui_config.js */

export const UI_CONFIG = {
  // 공통(전체 UI)
  global: {
    // D2/M2 데이터 간격 (Flex gap)
    colGap: 24, // ✅ Type 2 간격 (18 -> 24로 조정, 취향껏 변경 가능)
    
    // D1/M1 세로 스택 간격
    rowGap: 18, 
    rowGapResult: 18, 
  },

  // 폰트별 설정
  fonts: {
    // =========================
    // ANTON
    // =========================
    anton: {
      d1: {
        labelSize: 12,
        valueSize: 34,
        distanceValueSize: 34,
        labelToValueGap: 2, // ✅ 6 -> 2 (축소)
        stackGap: 18,
      },
      d2: {
        labelSize: 12,
        valueSize: 34,
        labelToValueGap: 2, // ✅ 6 -> 2
        colGap: 24,         // global 값 상속받거나 개별 지정
      },
      m1: {
        monthSize: 14,
        monthToDistanceGap: 8,
        distanceSize: 36,
        distanceToStatsGap: 14,
        labelSize: 10,
        valueSize: 24,
        labelToValueGap: 2, // ✅ 6 -> 2
        stackGap: 18,
      },
      m2: {
        monthSize: 14,
        monthToDistanceGap: 8,
        distanceSize: 36,
        distanceToRowGap: 14,
        labelSize: 12,
        valueSize: 34,
        labelToValueGap: 2, // ✅ 6 -> 2
        colGap: 24,
      },
    },

    // =========================
    // DOTS
    // =========================
    dots: {
      d1: { labelSize: 12, valueSize: 34, distanceValueSize: 34, labelToValueGap: 2, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 34, labelToValueGap: 2, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 2, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 12, valueSize: 34, labelToValueGap: 2, colGap: 24 },
    },

    // =========================
    // LCD
    // =========================
    lcd: {
      d1: { labelSize: 12, valueSize: 34, distanceValueSize: 34, labelToValueGap: 2, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 34, labelToValueGap: 2, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 2, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 12, valueSize: 34, labelToValueGap: 2, colGap: 24 },
    },

    // =========================
    // GOTHIC
    // =========================
    gothic: {
      d1: { labelSize: 10, valueSize: 34, distanceValueSize: 34, labelToValueGap: 2, stackGap: 18 },
      d2: { labelSize: 10, valueSize: 34, labelToValueGap: 2, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 2, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 10, valueSize: 34, labelToValueGap: 2, colGap: 24 },
    },

    // =========================
    // SPEED
    // =========================
    speed: {
      d1: { labelSize: 12, valueSize: 34, distanceValueSize: 34, labelToValueGap: 2, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 34, labelToValueGap: 2, colGap: 24 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 2, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 12, valueSize: 34, labelToValueGap: 2, colGap: 24 },
    },
  },
};

export function applyUIConfigToRoot({ font, recordType, layout }) {
  const f = UI_CONFIG.fonts[font] || UI_CONFIG.fonts.anton;

  const key =
    recordType === 'daily'
      ? (layout === 'type1' ? 'd1' : 'd2')
      : (layout === 'type1' ? 'm1' : 'm2');

  const preset = f[key];
  const root = document.documentElement;

  const set = (name, v) => root.style.setProperty(name, `${v}px`);

  const colGap = (preset.colGap != null) ? preset.colGap : UI_CONFIG.global.colGap;
  const stackGap = (preset.stackGap != null) ? preset.stackGap : UI_CONFIG.global.rowGap;

  set('--ui-col-gap', colGap);
  set('--ui-stack-gap', stackGap);

  if (preset.labelToValueGap != null) set('--ui-label-to-value-gap', preset.labelToValueGap);

  if (preset.labelSize != null) set('--ui-label-size', preset.labelSize);
  if (preset.valueSize != null) set('--ui-value-size', preset.valueSize);
  set('--ui-distance-value-size', preset.distanceValueSize ?? preset.valueSize ?? 34);

  if (key === 'm1' || key === 'm2') {
    if (preset.monthSize != null) set('--ui-month-size', preset.monthSize);
    if (preset.monthToDistanceGap != null) set('--ui-month-to-distance-gap', preset.monthToDistanceGap);
    if (preset.distanceSize != null) set('--ui-month-distance-size', preset.distanceSize);

    if (preset.distanceToStatsGap != null) set('--ui-distance-to-stats-gap', preset.distanceToStatsGap);
    if (preset.distanceToRowGap != null) set('--ui-distance-to-row-gap', preset.distanceToRowGap);

    if (key === 'm1') {
      set('--ui-m-label-size', preset.labelSize);
      set('--ui-m-value-size', preset.valueSize);
    }
  }
}
