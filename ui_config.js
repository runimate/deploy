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
    rowGapResult: 34, // px (result type1 큰 화면용)
  },

  // 폰트별 설정
  fonts: {
    // =========================
    // ANTON (네가 준 기준 반영)
    // 날짜 = inter 14
    // 거리 = anton 36
    // 라벨 = inter 10
    // 숫자 = anton 24
    //
    // ✅ 단, 요청 반영:
    // M2 하단(run/pace/time)은 D2와 동일 사이즈/간격 사용
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
        monthSize: 14, // Inter
        monthToDistanceGap: 8,
        distanceSize: 36, // Anton
        distanceToStatsGap: 14,
        labelSize: 10, // Inter
        valueSize: 24, // Anton
        labelToValueGap: 6,
        stackGap: 18,
      },
      m2: {
        // M2는 “D2 로직 동일” + 위에 month/distance
        monthSize: 14, // Inter
        monthToDistanceGap: 8,
        distanceSize: 36,
        distanceToRowGap: 14,

        // ✅ M2 하단은 D2 그대로
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

/**
 * state 기반으로 현재 UI 변수(:root CSS vars) 주입
 * - preview/result 모두 동일하게 맞추기 위해 root에 세팅
 */
export function applyUIConfigToRoot({ font, recordType, layout }) {
  const f = UI_CONFIG.fonts[font] || UI_CONFIG.fonts.anton;

  // daily: d1/d2, monthly: m1/m2
  const key =
    recordType === 'daily'
      ? (layout === 'type1' ? 'd1' : 'd2')
      : (layout === 'type1' ? 'm1' : 'm2');

  const preset = f[key];
  const root = document.documentElement;

  const set = (name, v) => root.style.setProperty(name, `${v}px`);

  // gap
  const colGap = (preset.colGap != null) ? preset.colGap : UI_CONFIG.global.colGap;
  const stackGap = (preset.stackGap != null) ? preset.stackGap : UI_CONFIG.global.rowGap;

  set('--ui-col-gap', colGap);
  set('--ui-stack-gap', stackGap);

  if (preset.labelToValueGap != null) set('--ui-label-to-value-gap', preset.labelToValueGap);

  // daily vars
  // ✅ monthly m2에서도 D2 값을 쓰기 위해 여기서도 세팅해준다.
  if (preset.labelSize != null) set('--ui-label-size', preset.labelSize);
  if (preset.valueSize != null) set('--ui-value-size', preset.valueSize);
  set('--ui-distance-value-size', preset.distanceValueSize ?? preset.valueSize ?? 34);

  // monthly vars
  if (key === 'm1' || key === 'm2') {
    if (preset.monthSize != null) set('--ui-month-size', preset.monthSize);
    if (preset.monthToDistanceGap != null) set('--ui-month-to-distance-gap', preset.monthToDistanceGap);
    if (preset.distanceSize != null) set('--ui-month-distance-size', preset.distanceSize);

    if (preset.distanceToStatsGap != null) set('--ui-distance-to-stats-gap', preset.distanceToStatsGap);
    if (preset.distanceToRowGap != null) set('--ui-distance-to-row-gap', preset.distanceToRowGap);

    // M1에서만 쓰는 전용(세로 스택) 변수는 유지
    if (key === 'm1') {
      set('--ui-m-label-size', preset.labelSize);
      set('--ui-m-value-size', preset.valueSize);
    }
  }
}
