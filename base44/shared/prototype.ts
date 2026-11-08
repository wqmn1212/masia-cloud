// 시제품 개발 공용 계산 (서버 prototypeAction 과 검산이 같이 쓴다)

export const FILE_CATEGORIES = ['DRAWING', 'PHOTO', 'REFERENCE', 'CAD', 'PCB', 'CODE', 'MFG', 'MODEL3D'];

/** 미해결 위험 = 현재 설계(없으면 최신)의 높음·보통 위험 + 불합격 시험 */
export function openRiskCount(version: any, tests: any[]) {
  const risks = (version?.risks || []).filter((r: any) => r.severity !== 'LOW').length;
  return risks + (tests || []).filter((t) => t.status === 'FAIL').length;
}

export const nextVersionNo = (versions: any[]) => Math.max(0, ...(versions || []).map((v) => Number(v.version_no) || 0)) + 1;

/**
 * 같은 번호가 동시에 만들어졌을 때: 먼저 만든 버전이 번호를 갖고, 늦게 만든 쪽은 끝 번호 다음으로 옮긴다.
 * 돌려줌: 바꿀 번호 (그대로면 null)
 */
export function versionNoFix(mine: any, all: any[]) {
  const same = (all || []).filter((v) => v.version_no === mine.version_no);
  if (same.length < 2) return null;
  const first = [...same].sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')) || String(a.id).localeCompare(String(b.id)))[0];
  return first.id === mine.id ? null : nextVersionNo(all);
}

const str = (v: unknown, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');

/** 화면에서 올린 파일 정보를 저장 가능한 모양으로 정리. 모양이 틀린 항목은 뺀다 */
export function cleanFiles(files: any[]) {
  return (Array.isArray(files) ? files : []).slice(0, 20)
    .filter((f) => f && typeof f.id === 'string' && f.id && typeof f.uri === 'string' && f.uri && typeof f.name === 'string' && FILE_CATEGORIES.includes(f.category))
    .map((f) => ({
      id: str(f.id, 80), name: str(f.name, 200), uri: str(f.uri, 500), category: f.category,
      size: Number(f.size) || 0, version_no: Number(f.version_no) || null, note: str(f.note, 300),
      uploaded_at: str(f.uploaded_at, 40) || new Date().toISOString(), uploaded_by_name: str(f.uploaded_by_name, 100),
    }));
}
