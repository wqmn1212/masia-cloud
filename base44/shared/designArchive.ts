// 설계 자료실: 문의 첨부·스케치 시안·도면 파일·금형 검토·STEP 부품표·회로·워크벤치·시제품 파일을
// 한 줄 형식으로 모은다. 서버(designArchive)와 검산이 같이 쓴다. 파일은 ref(비공개 uri 또는 공개 url)로만 가리킨다.

export const ARCHIVE_KINDS = {
  inquiry: '문의 첨부',
  sketch: '스케치 시안',
  card_file: '카드 도면 파일',
  upload: '도면 업로드 (자동 보관)',
  mold: '금형 사전 검토',
  bom: 'STEP 부품표',
  circuit: '회로 시뮬레이터',
  workbench: '개발 워크벤치',
  concept: '시제품 컨셉',
  proto_file: '시제품 설계 파일',
};

// 도면·3D·회로 파일 확장자
export const DESIGN_EXT = /\.(step|stp|stl|igs|iges|dwg|dxf|x_t|x_b|3mf|obj|f3d|sldprt|sldasm|slddrw|prt|ipt|iam|catpart|catproduct|skp|3dm|glb|gltf|kicad_pcb|kicad_sch|sch|brd|gbr|zip)$/i;
const DOC_EXT = /\.(pdf|png|jpe?g|webp|gif|bmp|tiff?)$/i;
const DESIGN_WORD = /도면|설계|드로잉|drawing|dwg|cad|시안|스케치|sketch|렌더|render|회로|schematic|pcb|금형|mold|mould|3d|외형|치수|图纸|设计/i;

// 카드 첨부 중 도면으로 볼 파일: CAD·3D·회로 확장자, 또는 이름에 도면 낱말이 있는 PDF·이미지
export const isDesignFile = (name = '') => DESIGN_EXT.test(name) || (DOC_EXT.test(name) && DESIGN_WORD.test(name));

// 시제품 파일 분류 중 설계 자료
export const PROTO_DESIGN_CATEGORIES = ['DRAWING', 'CAD', 'MODEL3D', 'PCB', 'SCHEMATIC', 'MOLD_DRAWING', 'CODE', 'MFG', 'BOM_FILE'];

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const at = (r) => r?.updated_date || r?.created_date || '';
const file = (name, ref, size) => (ref ? { name: str(name, 200) || '파일', ref: String(ref), size: Number(size) || 0 } : null);
const files = (list) => list.filter(Boolean);
const row = (r) => ({ detail: '', who: '', files: [], link: '', meta: {}, ...r });

export function leadRows(lead) {
  const out = [];
  const who = [lead.company, lead.contact_name].map((x) => str(x, 80)).filter(Boolean).join(' · ');
  const attach = files((lead.attachments || []).map((a) => file(a.name, a.url, a.size)));
  const t = lead.sketch_trial;
  if (t && (t.status || (t.variants || []).length)) {
    const variants = (t.variants || []).filter((v) => v?.url);
    out.push(row({
      key: `sketch:${lead.id}`, kind: 'sketch', id: lead.id, tenant_id: lead.tenant_id, at: lead.submitted_at || at(lead), who,
      title: `${str(lead.detail, 60) || '스케치 시안 체험'}`,
      detail: [t.status === 'READY' ? `시안 ${variants.length}장` : t.status === 'FAILED' ? '시안 만들기 실패' : t.status === 'PENDING' ? '시안 만드는 중' : '',
        Number.isInteger(t.chosen) && variants[t.chosen] ? `고른 시안: ${str(variants[t.chosen].label, 30)}` : '', t.inquired_at ? '견적 문의함' : ''].filter(Boolean).join(' · '),
      files: [...attach, ...variants.map((v, i) => file(`시안 ${i + 1} ${str(v.label, 30)}.png`, v.url, 0))].filter(Boolean),
      link: `/leads?lead=${lead.id}`, meta: { status: lead.status || '', email: str(lead.email, 120), phone: str(lead.phone, 40) },
    }));
    return out;
  }
  if (attach.length) {
    out.push(row({
      key: `lead:${lead.id}`, kind: 'inquiry', id: lead.id, tenant_id: lead.tenant_id, at: lead.submitted_at || at(lead), who,
      title: str(lead.detail, 60) || '문의',
      detail: [lead.inquiry_type, lead.quantity ? `수량 ${str(lead.quantity, 30)}` : ''].filter(Boolean).join(' · '),
      files: attach, link: `/leads?lead=${lead.id}`, meta: { status: lead.status || '', email: str(lead.email, 120), phone: str(lead.phone, 40) },
    }));
  }
  return out;
}

export function cardFileRows(attachments, cards = {}) {
  const groups = new Map();
  for (const a of attachments) {
    if (!a?.file_url || !isDesignFile(a.file_name || '')) continue;
    const k = `${a.card_id || 'none'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  return [...groups.entries()].map(([cardId, list]) => {
    const card = cards[cardId] || {};
    const latest = list.reduce((m, a) => (at(a) > at(m) ? a : m), list[0]);
    return row({
      key: `card:${cardId}`, kind: 'card_file', id: cardId, tenant_id: latest.tenant_id, at: at(latest),
      who: str(card.client_name, 80) || [...new Set(list.map((a) => str(a.uploader_name, 60)).filter(Boolean))].join(', '),
      title: str(card.title, 80) || '카드 미지정',
      detail: `도면 파일 ${list.length}개${list.some((a) => a.uploader_role === 'CLIENT') ? ' · 고객이 올린 파일 포함' : ''}`,
      files: files(list.map((a) => file(a.file_name, a.file_url, 0))),
      link: cardId !== 'none' ? `/task-board?card=${cardId}` : '',
    });
  });
}

export function uploadRows(uploads) {
  return uploads.map((u) => row({
    key: `upload:${u.id}`, kind: 'upload', id: u.id, tenant_id: u.tenant_id, at: at(u),
    who: [str(u.uploaded_by_name, 60), u.account_tier === 'client' ? '고객' : ''].filter(Boolean).join(' · '),
    title: str(u.part_name, 80) || str(u.file_name, 80),
    detail: [u.source === 'mold_review' ? '금형 사전 검토에 올린 파일' : str(u.source, 40), u.summary?.weight_g ? `${u.summary.weight_g} g` : '',
      u.summary?.high_count != null ? `높음 ${u.summary.high_count} · 주의 ${u.summary.caution_count || 0}` : ''].filter(Boolean).join(' · '),
    files: files([file(u.file_name, u.file_uri, u.size)]),
    meta: { client: u.account_tier === 'client' },
  }));
}

export function moldRows(reviews) {
  return reviews.map((m) => row({
    key: `mold:${m.id}`, kind: 'mold', id: m.id, tenant_id: m.tenant_id, at: at(m), who: str(m.created_by_name, 60),
    title: str(m.part_name, 80) || str(m.source_file_name, 80) || '금형 검토',
    detail: [str(m.material, 40), m.summary?.weight_g ? `${m.summary.weight_g} g` : '', `높음 ${m.high_count || 0} · 주의 ${m.caution_count || 0}`].filter(Boolean).join(' · '),
    files: files([file(m.source_file_name || '원본 파일', m.source_file_uri, 0), file('검토 캡처.png', m.snapshot_url, 0)]),
    link: m.card_id ? `/task-board?card=${m.card_id}` : '',
  }));
}

export function bomRows(items) {
  const sets = new Map();
  for (const b of items) {
    const k = b.bom_set_id || `${b.card_id}:${b.source_file_name}`;
    if (!sets.has(k)) sets.set(k, []);
    sets.get(k).push(b);
  }
  return [...sets.entries()].map(([k, list]) => {
    const f = list[0];
    return row({
      key: `bom:${k}`, kind: 'bom', id: k, tenant_id: f.tenant_id, at: list.reduce((m, b) => (at(b) > m ? at(b) : m), ''),
      title: str(f.source_file_name, 80) || 'STEP 부품표', detail: `부품 ${list.length}개${f.revision_label ? ` · ${str(f.revision_label, 30)}` : ''}`,
      files: files([file(f.source_file_name, f.source_file_url, 0)]), link: f.card_id ? `/task-board?card=${f.card_id}` : '',
    });
  });
}

export function circuitRows(designs) {
  return designs.map((c) => row({
    key: `circuit:${c.id}`, kind: 'circuit', id: c.id, tenant_id: c.tenant_id, at: at(c), who: str(c.updated_by_name || c.created_by_name, 60),
    title: str(c.title, 80) || '회로', detail: [`부품 ${c.part_count || 0}개`, c.project_title ? `시제품 ${str(c.project_title, 40)}` : '', c.autosaved ? '자동 저장' : ''].filter(Boolean).join(' · '),
    link: `/circuit-lab?id=${c.id}`,
  }));
}

export function projectRows(project) {
  const out = [];
  const dev = project.dev;
  if (dev && ((dev.features || []).length || dev.cad || dev.rules || dev.power)) {
    const changed = Object.keys(dev.sim_params || {}).length;
    out.push(row({
      key: `workbench:${project.id}`, kind: 'workbench', id: project.id, tenant_id: project.tenant_id, at: dev.updated_at || at(project), who: str(dev.updated_by_name, 60),
      title: str(project.title, 80) || '시제품',
      detail: [`기능 ${(dev.features || []).length}개`, dev.mcu ? String(dev.mcu).toUpperCase() : '', dev.supply_v ? `${dev.supply_v} V` : '',
        Array.isArray(dev.rules) ? `동작 규칙 ${dev.rules.length}개` : '', changed ? `시뮬레이션 부품 값 ${changed}개 수정` : ''].filter(Boolean).join(' · '),
      link: `/prototypes/${project.id}/develop`,
    }));
  }
  const pf = (project.files || []).filter((f) => f?.uri && (PROTO_DESIGN_CATEGORIES.includes(f.category) || DESIGN_EXT.test(f.name || '')));
  if (pf.length) {
    out.push(row({
      key: `proto_file:${project.id}`, kind: 'proto_file', id: project.id, tenant_id: project.tenant_id,
      at: pf.reduce((m, f) => (String(f.uploaded_at || '') > m ? String(f.uploaded_at) : m), ''), who: str(pf[pf.length - 1].uploaded_by_name, 60),
      title: str(project.title, 80) || '시제품', detail: `설계 파일 ${pf.length}개`,
      files: files(pf.map((f) => file(f.name, f.uri, f.size))), link: `/prototypes/${project.id}`,
    }));
  }
  return out;
}

export function conceptRows(concepts) {
  return concepts.map((c) => row({
    key: `concept:${c.id}`, kind: 'concept', id: c.id, tenant_id: c.tenant_id, at: at(c),
    title: str(c.title, 80) || '컨셉', detail: [`${c.version_no || 1}번째 버전`, str(c.status, 20)].filter(Boolean).join(' · '),
    link: c.project_id ? `/prototypes/${c.project_id}` : '',
  }));
}

// 목록 거르기·정렬·종류별 개수
export function filterArchive(rows, { kind = '', q = '', tenantNames = {} } = {}) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const named = rows.map((r) => ({ ...r, tenant_name: tenantNames[r.tenant_id] || '' }));
  const hit = (r) => !words.length || words.every((w) => [r.title, r.detail, r.who, r.tenant_name, ...r.files.map((f) => f.name)].join(' ').toLowerCase().includes(w));
  const searched = named.filter(hit);
  const counts = {};
  for (const r of searched) counts[r.kind] = (counts[r.kind] || 0) + 1;
  const items = searched.filter((r) => !kind || r.kind === kind).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { items, counts, total: searched.length };
}

export const refsOf = (rows) => new Set(rows.flatMap((r) => r.files.map((f) => f.ref)));
export const isPublicRef = (ref) => /^https?:\/\//i.test(String(ref || ''));
