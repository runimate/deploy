// ui.config.js
// RUNIMATE UI tuning values (per font / per layout)
// You can tweak numbers here without touching index.html / styles.css.

export const UI_CONFIG = {
  common: {
    labelFamily: 'Inter',
    labelWeight: 600,
  },

  fonts: {
    // ✅ 기준(사용자 제공)
    anton: {
      d1: {
        labelSize: 10,
        distValueSize: 36,
        otherValueSize: 24,
        labelValueGap: 6,
        groupGapY: 14,
      },
      d2: {
        labelSize: 10,
        valueSize: 24,
        labelValueGap: 6,
        groupGapX: 18,
      },
      m1: {
        dateSize: 14,
        dateGap: 10,
        distSize: 36,
        distGap: 14,
        labelSize: 10,
        valueSize: 24,
        labelValueGap: 6,
        groupGapY: 14,
      },
      m2: {
        dateSize: 14,
        dateGap: 10,
        distSize: 36,
        distGap: 14,
        // stats block uses d2-style 3 columns
        labelSize: 10,
        valueSize: 24,
        labelValueGap: 6,
        groupGapX: 18,
      },
    },

    // 아래 폰트들은 안전값(anton과 동일 출발) — 필요하면 폰트별로 따로 튜닝
    dots: null,
    lcd: null,
    gothic: null,
    speed: null,
  },
};

// fill null fonts with anton baseline (so everything works immediately)
['dots','lcd','gothic','speed'].forEach((k)=>{
  if (!UI_CONFIG.fonts[k]) UI_CONFIG.fonts[k] = JSON.parse(JSON.stringify(UI_CONFIG.fonts.anton));
});
