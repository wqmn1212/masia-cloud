// 시제품 개발 내용 중 고객에게 공개하는 것: 설계 변경(ECO) 승인 요청, 명판·사용설명서 초안 확인, 3D·동작 시뮬레이션 보기와 위치 의견.
// 직원이 공개한 내용은 ProtoProject.client_share, 고객의 결정·의견은 ProtoProject.client_review 에 따로 둔다.
// (설계 데이터 dev 는 직원 화면이 통째로 자동 저장하므로 고객 기록을 섞지 않는다)

export const DOCS: Record<string, { ko: string; cn: string }> = {
  nameplate: { ko: '명판·라벨 문구', cn: '铭牌·标签文字' },
  manual: { ko: '사용설명서 초안', cn: '使用说明书草稿' },
};
export const ECO_DECISIONS = ['APPROVED', 'REJECTED'];
export const DOC_DECISIONS = ['APPROVED', 'CHANGES'];

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
const plain = (v: unknown) => { try { return v == null ? undefined : JSON.parse(JSON.stringify(v)); } catch { return undefined; } };

/** 시뮬레이션에 필요한 설계 값만 남긴다 (부품 번호·원가·견적·기록·확정본은 빼고) */
export function modelSnapshot(input: any) {
  const dev = input?.dev || {};
  const features = (Array.isArray(dev.features) ? dev.features : []).slice(0, 60).map((f: any) => ({
    id: str(f.id, 60), kind: str(f.kind, 30), name: str(f.name, 80), part_id: f.part_id ? str(f.part_id, 80) : null,
    power_w: num(f.power_w), cct: plain(f.cct), face: f.face ? str(f.face, 20) : undefined, watch: plain(f.watch),
    pin: num(f.pin), pins: plain(f.pins),
  }));
  const parts = (Array.isArray(input?.parts) ? input.parts : []).slice(0, 400).map(plain).filter(Boolean);
  const out = {
    dev: {
      device_name: str(dev.device_name, 60), supply_v: num(dev.supply_v), mcu: str(dev.mcu, 30), features,
      rules: plain(Array.isArray(dev.rules) ? dev.rules.slice(0, 200) : undefined), power: plain(dev.power), sim_params: plain(dev.sim_params),
      pivot: plain(dev.pivot), lid_part_id: dev.lid_part_id ? str(dev.lid_part_id, 80) : null,
    },
    parts,
    render_url: /^https:\/\//.test(String(input?.render_url || '')) ? String(input.render_url).slice(0, 1000) : '',
    // 고객 시연 화면의 '제품' 칸: 이름과 크기(mm)만
    title: str(input?.title, 120),
    overall_mm: input?.overall_mm ? { x: num(input.overall_mm.x), y: num(input.overall_mm.y), z: num(input.overall_mm.z) } : undefined,
  };
  if (JSON.stringify(out).length > 900_000) throw new Error('3D 모형이 너무 커서 공개할 수 없습니다');
  return out;
}

/** 고객이 결정할 것이 남았는지 (카드 탭 표시용) */
export function pendingForClient(share: any, review: any) {
  const n = { eco: 0, doc: 0 };
  for (const e of share?.ecos || []) if (!review?.ecos?.[e.no] && !e.withdrawn) n.eco += 1;
  for (const k of Object.keys(DOCS)) {
    const d = share?.docs?.[k];
    if (d && !(review?.docs?.[k] || []).some((x: any) => x.version === d.version)) n.doc += 1;
  }
  return n;
}

/** 고객에게 내보낼 모양 (직원 이름·내부 메모 없이) */
export function clientView(p: any) {
  const share = p.client_share || {};
  const review = p.client_review || {};
  return {
    id: p.id, title: p.title, stage: p.stage,
    model: share.model?.on ? { at: share.model.at, dev: share.model.dev, parts: share.model.parts, render_url: share.model.render_url || '', title: share.model.title || '', overall_mm: share.model.overall_mm } : null,
    docs: Object.fromEntries(Object.keys(DOCS).filter((k) => share.docs?.[k]).map((k) => [k, { version: share.docs[k].version, text: share.docs[k].text, at: share.docs[k].at, decisions: review.docs?.[k] || [] }])),
    ecos: (share.ecos || []).filter((e: any) => !e.withdrawn).map((e: any) => ({ no: e.no, reason: e.reason, changes: e.changes || [], impact: e.impact || [], from_version: e.from_version, at: e.at, decision: review.ecos?.[e.no] || null })),
    comments: (review.comments || []).slice(-200),
    pending: pendingForClient(share, review),
  };
}

export const hasShare = (p: any) => !!(p?.client_share && (p.client_share.model?.on || Object.keys(p.client_share.docs || {}).length || (p.client_share.ecos || []).some((e: any) => !e.withdrawn)));
