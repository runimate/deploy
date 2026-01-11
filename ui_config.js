// ============================================================
// [UI CONFIGURATION] 스타일 정밀 제어 컨트롤러
// ============================================================

export const UI_CONFIG = {
    // 1. [공통 설정] D2와 M2가 공유하는 간격
    global: {
        sharedColGap: 24, // D2, M2 데이터 사이의 좌우 간격 (px)
    },

    // 2. [폰트별 설정] (anton, dots, lcd, gothic, speed)
    // 각 폰트마다 D1, D2, M1, M2 스타일을 따로 지정할 수 있습니다.
    fonts: {
        // --- ANTON 폰트 설정 ---
        anton: {
            // [D1] Daily Type 1 (수직)
            d1: {
                labelSize: 12,      // 라벨 크기
                valueSize: 38,      // 숫자 크기
                labelGap: 10,       // 라벨-숫자 사이 간격
                stackGap: 16        // 줄 간격
            },
            // [D2] Daily Type 2 (가로 3단)
            d2: {
                labelSize: 12,
                valueSize: 34,      // 숫자 크기 (D2, M2 하단 통일됨)
                labelGap: 4         // 라벨이 숫자 위에 오므로 상하 간격
            },
            // [M1] Monthly Type 1 (세로형)
            m1: {
                monthSize: 14,      // "DECEMBER 2025" 크기
                monthGap: 8,        // 월 - 거리 사이 간격
                distSize: 50,       // 메인 거리 숫자 크기
                distGap: 20,        // 거리 - 하단 스탯 사이 간격
                
                labelSize: 12,      // 하단 스탯 라벨
                valueSize: 24,      // 하단 스탯 숫자
                labelGap: 8,
                stackGap: 10
            },
            // [M2] Monthly Type 2 (가로형)
            m2: {
                monthSize: 14,
                monthGap: 8,
                distSize: 42,
                distGap: 24,        // 거리 - 하단 그리드 사이 간격
                
                labelSize: 12,
                valueSize: 34,      // D2 숫자와 크기 동일하게 설정 추천
                labelGap: 4
            }
        },

        // --- DOTS 폰트 설정 (예시) ---
        dots: {
            d1: { labelSize: 12, valueSize: 32, labelGap: 8, stackGap: 18 },
            d2: { labelSize: 12, valueSize: 28, labelGap: 6 },
            m1: { monthSize: 14, monthGap: 10, distSize: 40, distGap: 15, labelSize: 10, valueSize: 20, labelGap: 6, stackGap: 12 },
            m2: { monthSize: 14, monthGap: 10, distSize: 36, distGap: 20, labelSize: 10, valueSize: 28, labelGap: 6 }
        },

        // 나머지 폰트들 (기본값으로 안톤 복사해서 쓰거나 조정 가능)
        lcd: { /* ...anton과 동일 구조... */ },
        gothic: { /* ... */ },
        speed: { /* ... */ }
    }
};

// [SYSTEM] 설정을 CSS 변수로 변환하여 주입하는 함수
export function applyLayoutConfig(state) {
    const root = document.documentElement;
    const fontKey = state.font || 'anton';
    
    // 폰트 설정 가져오기 (없으면 anton 기본값)
    const fontConfig = UI_CONFIG.fonts[fontKey] || UI_CONFIG.fonts.anton;
    
    // 현재 레이아웃 타입 감지 (D1, D2, M1, M2)
    let typeKey = '';
    if (state.recordType === 'daily') {
        typeKey = (state.layout === 'type1') ? 'd1' : 'd2';
    } else {
        typeKey = (state.layout === 'type1') ? 'm1' : 'm2';
    }

    const conf = fontConfig[typeKey] || fontConfig.d1; // 안전장치

    // 1. 공통 변수 적용 (D2, M2 간격 통일)
    root.style.setProperty('--shared-col-gap', `${UI_CONFIG.global.sharedColGap}px`);

    // 2. 타입별 변수 적용
    if (typeKey === 'd1') {
        root.style.setProperty('--sz-label', `${conf.labelSize}px`);
        root.style.setProperty('--sz-value', `${conf.valueSize}px`);
        root.style.setProperty('--d1-label-gap', `${conf.labelGap}px`);
        root.style.setProperty('--d1-stack-gap', `${conf.stackGap}px`);
    } 
    else if (typeKey === 'd2') {
        root.style.setProperty('--sz-label', `${conf.labelSize}px`);
        root.style.setProperty('--sz-value', `${conf.valueSize}px`);
        root.style.setProperty('--d2-label-gap', `${conf.labelGap}px`);
    }
    else if (typeKey === 'm1') {
        root.style.setProperty('--sz-month', `${conf.monthSize}px`);
        root.style.setProperty('--m1-month-gap', `${conf.monthGap}px`);
        root.style.setProperty('--sz-dist', `${conf.distSize}px`);
        root.style.setProperty('--m1-dist-gap', `${conf.distGap}px`);
        
        root.style.setProperty('--sz-label', `${conf.labelSize}px`);
        root.style.setProperty('--sz-value', `${conf.valueSize}px`);
        root.style.setProperty('--m1-label-gap', `${conf.labelGap}px`);
        root.style.setProperty('--m1-stack-gap', `${conf.stackGap}px`);
    }
    else if (typeKey === 'm2') {
        root.style.setProperty('--sz-month', `${conf.monthSize}px`);
        root.style.setProperty('--m2-month-gap', `${conf.monthGap}px`);
        root.style.setProperty('--sz-dist', `${conf.distSize}px`);
        root.style.setProperty('--m2-dist-gap', `${conf.distGap}px`);
        
        root.style.setProperty('--sz-label', `${conf.labelSize}px`);
        root.style.setProperty('--sz-value', `${conf.valueSize}px`);
        root.style.setProperty('--m2-label-gap', `${conf.labelGap}px`);
    }
}
