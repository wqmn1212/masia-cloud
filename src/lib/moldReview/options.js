// 금형 사전 검토 형상 계산 조건 기본값 (화면과 엔진이 같이 쓴다. 엔진 코드를 화면 번들에 끌어오지 않도록 따로 둔다)
export const DEFAULT_ANALYSIS_OPTIONS = {
  pull: 'auto', // 'auto' | 'x' | 'y' | 'z' (고정측 방향 자동) | 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-'
  cosmetic: 'cavity', // 외관면: 'cavity'(고정측) | 'core'(가동측) | 'both'(양면 외관 → 게이트는 파팅면만)
  sinkRatio: 1.25, // 기본 살 두께의 몇 배부터 두꺼움(수축 위험)으로 볼지
  plSmoothDeg: 25, // 파팅라인 양쪽 면이 이 각도보다 덜 꺾이면 곡면 위 파팅(자국이 보일 위험)
  maxTris: 320000, // 긴 간선을 나눌 때 삼각형 수 상한
};

/** STEP 을 금형 검토용으로 변환할 때의 정밀도 (mm). BOM 추출(0.1)보다 촘촘하게 */
export const MOLD_REVIEW_DEFLECTION_MM = 0.05;
