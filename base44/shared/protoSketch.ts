// 시제품 컨셉: 스케치 정리 단계 (prototypeConcept 함수와 검산이 같이 쓴다)
//
// 아이디어 스케치는 원근이 섞이고 비율이 부정확해 바로 측정하면 3D 가 틀어진다.
// 1) 스케치를 읽어 형태 설명과 시안 방향 3개를 정하고, 2) 정면 시안 3장을 만들어 고객이 하나를 고르게 한다.
// 3) 앱이 스케치와 시안의 정면 비율(폭/높이)을 비교해 많이 다르면 경고한다.
// 4) 고른 시안을 기준으로 같은 제품의 측면 이미지를 만들고, 정면·측면 두 장을 3D 측정의 기준으로 쓴다.

export const SKETCH_VARIANTS = 3;
export const SKETCH_DIFF_WARN = 0.1; // 스케치 대비 정면 비율 차이 10% 넘으면 경고

export const SKETCH_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    shape: { type: 'string' },
    parts: { type: 'array', items: { type: 'string' } },
    variants: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, style: { type: 'string' } } } },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

export const sketchPlanPrompt = (ctx: string) => `You are an industrial designer turning a rough product sketch into clean reference images for a 3D concept model.
Read the attached sketch(es) and the product context.

[Product context]
${ctx}

Return:
- shape: English, 80-160 words. The product's silhouette and proportions exactly as drawn (e.g. "about twice as tall as wide"), every visible part and where it sits (front/back/side/top, on the body or on the base). Describe only what the sketch shows or the context states. No colors or materials here.
- parts: short English names of the visible parts.
- variants: exactly ${SKETCH_VARIANTS} styling directions that keep the shape identical and only change colors, materials and finish. label is a short Korean name (e.g. "화이트 무광", "우드 포인트"); style is one English sentence.
- notes: Korean, what was unclear in the sketch (e.g. hidden back side, uncertain depth).`;

const BASE = 'Clean studio product photograph on a plain light gray seamless background, soft even lighting, the whole product centered and fully visible with generous margin. No text, no logos, no dimension lines, no people, no props, no hands.';

export const frontPrompt = (shape: string, style: string) => `${BASE} Pure orthographic straight-on FRONT view: camera level with the product center, no perspective tilt, no three-quarter angle. Keep the shape and proportions exactly as in the attached sketch: ${shape.slice(0, 1400)} Styling: ${style.slice(0, 300)}`;

// 정사각에 가까운 제품은 측면 대신 뒷면을 그리는 일이 많아, 앞(버튼 쪽)이 왼쪽을 보고 앞·뒷면은 보이지 않게 못 박는다
export const sidePrompt = (shape: string, style: string, retry = false) => `${BASE} The exact same product as in the first reference image (same proportions, colors, materials and details), turned 90 degrees so we see its RIGHT SIDE face in a pure orthographic side view: camera level with the product center. The FRONT face (the face that carries the main button or display in the reference) now points to the LEFT edge of the image and is seen only edge-on; the BACK face (ports, cables) points to the RIGHT edge and is also seen only edge-on. Do not show the front face or the back face toward the camera, and do not show any button or port facing the viewer.${retry ? ' IMPORTANT: a previous attempt showed the back or front instead of the side. Show only the plain side face; any front button may appear only as a tiny bump on the left silhouette edge.' : ''} Shape reference: ${shape.slice(0, 1200)} Styling: ${style.slice(0, 300)}`;

/** 측면 이미지가 정말 측면인지: 분석 결과(cleanVision)의 두 번째 이미지에 원근이 강하지 않은 SIDE 시점이 있어야 한다 */
export const isSideView = (vision: any, index = 1) => (vision?.images?.[index]?.views || []).some((v: any) => v.view === 'SIDE' && v.perspective !== 'HIGH');

/** 분석 결과(cleanVision)에서 이미지별 정면 비율(폭/높이). 원근이 강하거나 정면 시점이 없으면 null */
export function frontRatios(vision: any) {
  return (vision?.images || []).map((img: any) => {
    const v = (img.views || []).find((x: any) => (x.view === 'FRONT' || x.view === 'BACK') && x.perspective !== 'HIGH');
    if (!v || !img.w || !img.h) return { ratio: null, view: (img.views || [])[0]?.view || null, kind: img.kind };
    const [x0, y0, x1, y1] = v.box;
    return { ratio: Math.round((((x1 - x0) * img.w) / ((y1 - y0) * img.h)) * 100) / 100, view: v.view, kind: img.kind };
  });
}

/**
 * 스케치와 시안 비교. srcCount 장의 스케치 뒤에 시안이 이어지는 순서.
 * 스케치 정면 비율이 없으면(비스듬한 스케치) 비교하지 않고 그 사실을 알린다.
 */
export function compareSketch(vision: any, srcCount: number) {
  const r = frontRatios(vision);
  const src = r.slice(0, srcCount).find((x: any) => x.ratio != null) || null;
  const variants = r.slice(srcCount).map((x: any) => {
    if (!src || x.ratio == null) return { ratio: x.ratio, diff_pct: null, warn: false };
    const diff = Math.abs(x.ratio / src.ratio - 1);
    return { ratio: x.ratio, diff_pct: Math.round(diff * 100), warn: diff > SKETCH_DIFF_WARN };
  });
  return {
    sketch_ratio: src ? src.ratio : null,
    sketch_note: src ? '' : '스케치가 정면으로 그려지지 않아(비스듬함) 비율을 비교하지 못했습니다. 시안의 비율을 눈으로 확인해 주세요.',
    variants,
  };
}

// AI 문장에 섞여 나오는 중국어 표기를 한국어로 (예: 约300mm → 약 300mm)
export const koFix = (s: string) => (typeof s === 'string' ? s.replace(/约\s*/g, '약 ').replace(/左右/g, '정도') : s);
