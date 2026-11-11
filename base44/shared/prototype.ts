// 시제품 개발 공용 계산 (서버 prototypeAction 과 검산이 같이 쓴다)

export const FILE_CATEGORIES = ['DRAWING', 'PHOTO', 'REFERENCE', 'CAD', 'PCB', 'CODE', 'MFG', 'MODEL3D', 'SCHEMATIC', 'MOLD_DRAWING', 'BOM_FILE'];

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

// 시제품 파일 업로드 기준 (화면 src/lib/prototypeApi.js 와 같은 값).
// STEP·DWG·PCB 압축 파일은 10MB 를 자주 넘는다. 한 번에 한 파일씩 보내고 파일당 25MB 까지 받는다
// (회의 녹음 meetingAudioActions 도 같은 크기의 요청을 받는다). 더 큰 파일은 zip 으로 압축해 올린다.
export const PROTO_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const PROTO_UPLOADS_PER_CALL = 1;

/**
 * 화면이 보낸 업로드 요청(uploads)에서 파일 정보(분류·버전·메모)만 정리한다. 모양이 틀린 항목은 뺀다.
 * 파일 주소(uri)·id·올린 사람은 화면 값을 쓰지 않는다 — 서버가 직접 올린 뒤 protoFileRecord 로 채운다.
 */
export function cleanUploads(uploads: any[], { needCategory = true } = {}) {
  return (Array.isArray(uploads) ? uploads : []).slice(0, PROTO_UPLOADS_PER_CALL)
    .filter((u) => u && typeof u.name === 'string' && u.name.trim() && typeof u.data === 'string' && u.data && (!needCategory || FILE_CATEGORIES.includes(u.category)))
    .map((u) => ({
      upload: { name: str(u.name, 200), type: str(u.type, 100), data: u.data },
      category: needCategory ? u.category : null, version_no: Number(u.version_no) || null, note: str(u.note, 300),
    }));
}

/** 서버가 올린 파일(uploadPrivateFile 결과)로 저장할 파일 정보를 만든다 */
export function protoFileRecord(uploaded: { name: string, size: number, url: string }, meta: any, by: string, id = crypto.randomUUID()) {
  return {
    id, name: str(uploaded.name, 200), uri: uploaded.url, category: meta.category, size: uploaded.size || 0,
    version_no: meta.version_no || null, note: meta.note || '', uploaded_at: new Date().toISOString(), uploaded_by_name: str(by, 100),
  };
}

/** 시험 증거 파일 정보 (ProtoTest.evidence: id·name·uri·size) */
export const evidenceRecord = (uploaded: { name: string, size: number, url: string }, id = crypto.randomUUID()) =>
  ({ id, name: str(uploaded.name, 200), uri: uploaded.url, size: uploaded.size || 0 });
