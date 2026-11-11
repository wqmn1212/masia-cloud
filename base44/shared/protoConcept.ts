// 시제품 컨셉 공용: AI 응답 스키마와 저장 전 정리 (prototypeConcept 함수와 검산이 같이 쓴다)
import { koFix } from './protoSketch.ts';

export const SHAPES = ['box', 'rounded_box', 'cylinder', 'sphere', 'capsule', 'cone', 'torus'];
export const LAYERS = ['SHELL', 'INTERNAL', 'PCB', 'UI', 'OTHER'];
export const FINISHES = ['matte', 'gloss', 'metal', 'glass', 'rubber'];
const list = { type: 'array', items: { type: 'string' } };
const xyz = { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } };

export const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, summary: { type: 'string' },
    reference_kind: { type: 'string', enum: ['PHOTO', 'DRAWING', 'SKETCH', 'NONE'] },
    questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, why: { type: 'string' }, default_assumption: { type: 'string' } } } },
    assumptions: list,
  },
};

export const SCENE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' }, change_summary: { type: 'string' }, overall_mm: xyz,
    parts: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, ref_key: { type: 'string' }, role: { type: 'string' }, layer: { type: 'string', enum: LAYERS }, shape: { type: 'string', enum: SHAPES },
      size: xyz, position: xyz, rotation_deg: xyz, color: { type: 'string' }, finish: { type: 'string', enum: FINISHES }, material: { type: 'string' } } } },
    design_notes: list, assumptions: list, unverified: list,
  },
};

export const SCENE_RULES = `형상 규칙:
- 단위 mm. Y축이 위, 원점은 제품 바닥면의 중심. position 은 각 부품의 중심 좌표.
- size 는 회전 전 x(폭)·y(높이)·z(깊이). cylinder·cone·capsule 은 축이 Y (지름 = x·z, 길이 = y). torus 는 x = 바깥 지름, y = 단면 지름이며 XZ 평면에 눕는다. 눕히거나 기울이려면 rotation_deg 를 쓴다.
- layer: 외장 케이스·커버는 SHELL, 그 안의 모터·배터리·필터 등은 INTERNAL, 기판은 PCB, 버튼·화면·LED·커넥터는 UI.
- SHELL 은 내부 부품을 감싸는 크기로, INTERNAL·PCB 는 SHELL 안쪽 좌표에 겹치지 않게 둔다. UI 는 외장 표면에서 살짝 돌출시킨다.
- 부품은 8~30개. 제품의 실루엣이 한눈에 읽히도록 큰 형상부터 잡고 디테일(버튼·다리·그릴·손잡이)을 더한다.
- color 는 #RRGGBB, finish 는 matte·gloss·metal·glass·rubber 중 하나. material 은 예상 재질.
- 입력에 있는 치수는 그대로 쓰고, 없는 치수는 같은 종류 제품의 일반적인 값으로 정한 뒤 assumptions 에 적는다.
- 이 형상은 고객 미팅용 개념 시각화다. 실제 설계에서 확인해야 할 것은 unverified 에 적는다.
- 모든 문장은 한국어로 쓴다. 중국어 한자(约·左右 등)나 일본어를 섞지 않는다.`;

const str = (v: unknown, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');
export const strList = (v: unknown, max = 20, n = 400) => (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => koFix(x.slice(0, n)));
const n2 = (v: any, d: number, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x * 100) / 100)) : d; };
const pick = (v: any, allowed: string[], d: string) => (allowed.includes(v) ? v : d);

/** AI 장면을 저장 가능한 모양으로 정리. 부품 id 는 서버가 p1.. 로 붙인다 */
export function cleanScene(ai: any) {
  const parts = (Array.isArray(ai?.parts) ? ai.parts : []).filter((p: any) => p && p.size).slice(0, 40).map((p: any, i: number) => ({
    id: `p${i + 1}`, name: str(p.name, 80) || `부품 ${i + 1}`, ...(str(p.ref_key, 40) ? { ref_key: str(p.ref_key, 40).toLowerCase().replace(/[^a-z0-9_]+/g, '_') } : {}), role: str(p.role, 200), layer: pick(p.layer, LAYERS, 'OTHER'), shape: pick(p.shape, SHAPES, 'box'),
    size: { x: n2(p.size.x, 10, 0.1, 5000), y: n2(p.size.y, 10, 0.1, 5000), z: n2(p.size.z, n2(p.size.x, 10, 0.1, 5000), 0.1, 5000) },
    position: { x: n2(p.position?.x, 0, -5000, 5000), y: n2(p.position?.y, 0, -5000, 5000), z: n2(p.position?.z, 0, -5000, 5000) },
    rotation_deg: { x: n2(p.rotation_deg?.x, 0, -360, 360), y: n2(p.rotation_deg?.y, 0, -360, 360), z: n2(p.rotation_deg?.z, 0, -360, 360) },
    color: /^#[0-9a-fA-F]{6}$/.test(p.color || '') ? p.color : '#b9c2d0', finish: pick(p.finish, FINISHES, 'matte'), material: str(p.material, 60),
  }));
  const o = ai?.overall_mm;
  return {
    summary: koFix(str(ai?.summary, 1200)), change_summary: koFix(str(ai?.change_summary, 600)),
    overall_mm: o && Number(o.x) > 0 && Number(o.y) > 0 ? { x: n2(o.x, 0, 0, 5000), y: n2(o.y, 0, 0, 5000), z: n2(o.z, n2(o.x, 0, 0, 5000), 0, 5000) } : null,
    parts, design_notes: strList(ai?.design_notes), assumptions: strList(ai?.assumptions), unverified: strList(ai?.unverified),
  };
}