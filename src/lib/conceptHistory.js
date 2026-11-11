import { base44 } from '@/api/base44Client';
import { newId } from '@/lib/prototypeApi';

// 컨셉 버전 히스토리: 버전 사이의 형상 차이를 계산하고, 그 버전의 3D 도면 파일(STL)을 비공개로 보관한다
export const hasModel = (c) => (c?.preview?.parts?.length || 0) > 0;
export const conceptFiles = (c) => c?.preview?.files || [];

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const near = (a, b, tol = 0.05) => Math.abs(n(a) - n(b)) <= tol;
const round = (v) => Math.round(n(v) * 10) / 10;
const vec = (v) => `${round(v?.x)}×${round(v?.y)}×${round(v?.z)}`;
const sameVec = (a, b, tol) => near(a?.x, b?.x, tol) && near(a?.y, b?.y, tol) && near(a?.z, b?.z, tol);

function partChanges(a, b) {
  const out = [];
  if (!sameVec(a.size, b.size)) out.push(`크기 ${vec(a.size)} → ${vec(b.size)} mm`);
  if (!sameVec(a.position, b.position, 0.1)) out.push('위치 이동');
  if (!sameVec(a.rotation_deg, b.rotation_deg, 0.5)) out.push('회전');
  if ((a.shape || 'box') !== (b.shape || 'box')) out.push(`형상 ${a.shape || 'box'} → ${b.shape || 'box'}`);
  if ((a.color || '') !== (b.color || '')) out.push('색상 변경');
  if ((a.material || '') !== (b.material || '')) out.push(`재료 ${a.material || '-'} → ${b.material || '-'}`);
  if ((a.name || '') !== (b.name || '')) out.push(`이름 ${a.name} → ${b.name}`);
  return out;
}

/** 두 버전의 전체 크기·부품 목록을 비교한 결과 */
export function diffConcepts(base, target) {
  const before = base?.preview?.parts || [];
  const after = target?.preview?.parts || [];
  const used = before.map(() => false);
  const matchOf = (p) => {
    let i = before.findIndex((x, k) => !used[k] && x.name && x.name === p.name);
    if (i < 0) i = before.findIndex((x, k) => !used[k] && x.id === p.id);
    if (i >= 0) used[i] = true;
    return i;
  };
  const parts = [];
  after.forEach((p) => {
    const i = matchOf(p);
    if (i < 0) { parts.push({ key: p.id || p.name, name: p.name, layer: p.layer, status: 'added', changes: [] }); return; }
    const changes = partChanges(before[i], p);
    if (changes.length) parts.push({ key: p.id || p.name, name: p.name, layer: p.layer, status: 'changed', changes });
  });
  before.forEach((p, i) => { if (!used[i]) parts.push({ key: p.id || p.name, name: p.name, layer: p.layer, status: 'removed', changes: [] }); });

  const labels = { x: '가로 (X)', y: '높이 (Y)', z: '깊이 (Z)' };
  const s1 = ['x', 'y', 'z'].map((k) => n(base?.preview?.overall_mm?.[k]));
  const s2 = ['x', 'y', 'z'].map((k) => n(target?.preview?.overall_mm?.[k]));
  const dims = ['x', 'y', 'z'].map((k, i) => ({ key: k, label: labels[k], from: round(s1[i]), to: round(s2[i]), changed: !near(s1[i], s2[i], 0.1) }));

  return {
    dims,
    parts,
    counts: { before: before.length, after: after.length },
    summaryFrom: base?.preview?.summary || '',
    summaryTo: target?.preview?.summary || '',
    summaryChanged: (base?.preview?.summary || '') !== (target?.preview?.summary || ''),
    assumptions: (target?.preview?.assumptions || []).filter((a) => !(base?.preview?.assumptions || []).includes(a)),
  };
}

const safeName = (c) => `${c.title || 'concept'} - v${c.version_no}`.replace(/[\\/:*?"<>|]+/g, '_').trim();

/** 그 버전의 3D 형상을 STL 도면 파일로 만들어 비공개로 보관하고 목록에 남긴다 */
export async function saveConceptModelFile(concept) {
  const [{ buildConceptGroup, disposeGroup }, { STLExporter }] = await Promise.all([
    import('@/lib/conceptScene'),
    import('three/addons/exporters/STLExporter.js'),
  ]);
  const built = buildConceptGroup(concept.preview?.parts || []);
  built.group.updateMatrixWorld(true);
  const buffer = new STLExporter().parse(built.group, { binary: true });
  disposeGroup(built.group);
  const file = new File([buffer], `${safeName(concept)}.stl`, { type: 'model/stl' });
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  const meta = { id: newId(), name: file.name, uri: file_uri, size: file.size, kind: 'STL', version_no: concept.version_no, uploaded_at: new Date().toISOString() };
  const files = [meta, ...(concept.preview?.files || [])];
  await base44.entities.ProtoConcept.update(concept.id, { preview: { ...concept.preview, files } });
  return meta;
}

export async function openConceptFile(file) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: file.uri, expires_in: 300 });
  window.open(signed_url, '_blank', 'noopener');
}