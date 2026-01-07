/* =========================================================
  RUNIMATE — UI CONFIG (preview/result layout tuning)
  - 목적: 폰트별/레이아웃별 사이즈 & 간격을 여기서만 조절
  - 원칙: “데이터 들어와도 폰트/간격이 변하지 않게” 고정 px 기반
  - preview/result는 동일 변수를 공유 (원하면 분리 가능)
========================================================= */

export const UI_CONFIG = {
  // 공통(전체 UI)
  global: {
    // D2/M2 3등분 간격 (기본)
    colGap: 18, // px
    // D1/M1 세로 스택 간격 (기본)
    rowGap: 18, // px (preview)
    // ✅ [수정] 결과 화면도 프리뷰와 똑같이 18px로 통일
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
        labelToValueGap: 6,
        stackGap: 18,
      },
      d2: {
        labelSize: 12,
        valueSize: 34,
        labelToValueGap: 6,
        colGap: 18,
      },
      m1: {
        monthSize: 14,
        monthToDistanceGap: 8,
        distanceSize: 36,
        distanceToStatsGap: 14,
        labelSize: 10,
        valueSize: 24,
        labelToValueGap: 6,
        stackGap: 18,
      },
      m2: {
        monthSize: 14,
        monthToDistanceGap: 8,
        distanceSize: 36,
        distanceToRowGap: 14,
        labelSize: 12,
        valueSize: 34,
        labelToValueGap: 6,
        colGap: 18,
      },
    },

    // =========================
    // DOTS
    // =========================
    dots: {
      d1: { labelSize: 12, valueSize: 34, distanceValueSize: 34, labelToValueGap: 6, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 34, labelToValueGap: 0, colGap: 18 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 6, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 12, valueSize: 34, labelToValueGap: 6, colGap: 18 },
    },

    // =========================
    // LCD
    // =========================
    lcd: {
      d1: { labelSize: 12, valueSize: 34, distanceValueSize: 34, labelToValueGap: 6, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 34, labelToValueGap: 0, colGap: 18 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 6, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 12, valueSize: 34, labelToValueGap: 6, colGap: 18 },
    },

    // =========================
    // GOTHIC
    // =========================
    gothic: {
      d1: { labelSize: 10, valueSize: 34, distanceValueSize: 34, labelToValueGap: 6, stackGap: 18 },
      d2: { labelSize: 10, valueSize: 34, labelToValueGap: 0, colGap: 18 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 6, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 10, valueSize: 34, labelToValueGap: 6, colGap: 18 },
    },

    // =========================
    // SPEED
    // =========================
    speed: {
      d1: { labelSize: 12, valueSize: 34, distanceValueSize: 34, labelToValueGap: 6, stackGap: 18 },
      d2: { labelSize: 12, valueSize: 34, labelToValueGap: 0, colGap: 18 },
      m1: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToStatsGap: 14, labelSize: 10, valueSize: 24, labelToValueGap: 6, stackGap: 18 },
      m2: { monthSize: 14, monthToDistanceGap: 8, distanceSize: 36, distanceToRowGap: 14, labelSize: 12, valueSize: 34, labelToValueGap: 6, colGap: 18 },
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
