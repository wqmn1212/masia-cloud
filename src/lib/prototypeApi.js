import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const protoKeys = {
  list: ['proto-projects'],
  project: (id) => ['proto-project', id],
  versions: (id) => ['proto-versions', id],
  tests: (id) => ['proto-tests', id],
  reviews: (id) => ['proto-reviews', id],
  sims: (id) => ['proto-sims', id],
};

export const useProtoSims = (id) => useQuery({ queryKey: protoKeys.sims(id), queryFn: () => base44.entities.ProtoSimulation.filter({ project_id: id }, '-updated_date', 50), enabled: !!id });

/** 시뮬레이션 실행 — 화면 요청이 끊겨도 request_id 가 기록된 결과를 3분간 찾는다 */
export async function runSimulation(simId, onWaiting) {
  const request_id = newId();
  try {
    return (await base44.functions.invoke('prototypeSimulate', { action: 'run', sim_id: simId, request_id })).data;
  } catch (e) {
    const status = e?.response?.status;
    if (status && status < 500) throw e;
    onWaiting?.();
    for (let i = 0; i < 18; i++) {
      await sleep(10000);
      const sim = await base44.entities.ProtoSimulation.get(simId).catch(() => null);
      if (sim?.result?.request_id === request_id) return { sim, recovered: true };
    }
    throw e;
  }
}

export const useProtoReviews = (id) => useQuery({ queryKey: protoKeys.reviews(id), queryFn: () => base44.entities.ProtoDesignReview.filter({ project_id: id }, '-created_date', 50), enabled: !!id });

export const useProtoProject = (id) => useQuery({ queryKey: protoKeys.project(id), queryFn: () => base44.entities.ProtoProject.get(id), enabled: !!id });
export const useProtoVersions = (id) => useQuery({ queryKey: protoKeys.versions(id), queryFn: () => base44.entities.ProtoDesignVersion.filter({ project_id: id }, '-version_no', 50), enabled: !!id });
export const useProtoTests = (id) => useQuery({ queryKey: protoKeys.tests(id), queryFn: () => base44.entities.ProtoTest.filter({ project_id: id }, '-created_date', 100), enabled: !!id });

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
export const actorName = (user) => user?.full_name || user?.email || '';

// 업로드 파일은 서버가 비공개 저장소에 올리고 레코드에는 uri·메타데이터만 남긴다.
// 화면은 파일 내용(base64)만 보내고 저장소 주소는 다루지 않는다 (서버 base44/shared/prototype.ts 와 같은 기준)
export const PROTO_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const PROTO_FILE_MAX_LABEL = '25MB';

export const fileToUpload = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve({ name: file.name, type: file.type, data: String(r.result).split(',')[1] || '' });
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** 크기 초과 파일을 고른 즉시 알린다 (서버도 다시 확인한다) */
export function checkProtoFileSize(list) {
  const big = (list || []).filter((f) => f.size > PROTO_FILE_MAX_BYTES);
  if (big.length) throw new Error(`${PROTO_FILE_MAX_LABEL} 넘는 파일은 올릴 수 없습니다. zip 으로 압축해 올려 주세요: ${big.map((f) => f.name).join(', ')}`);
}

export async function signProtoFile(projectId, fileId, testId) {
  const res = await base44.functions.invoke('prototypeAction', { action: 'sign_file', project_id: projectId, file_id: fileId, test_id: testId });
  return res.data.url;
}

export async function openProtoFile(projectId, fileId, testId) {
  const win = window.open('', '_blank');
  const url = await signProtoFile(projectId, fileId, testId);
  if (win) win.location.href = url; else window.location.href = url;
}

export const errorText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';

export const protoAction = async (action, body) => (await base44.functions.invoke('prototypeAction', { action, ...body })).data;

// 파일 목록은 서버에서 최신 목록에 더하고 뺀다 (동시에 올려도 한쪽이 사라지지 않게). 요청이 커지지 않게 한 파일씩 보낸다
export async function addProtoFiles(projectId, files, meta = {}) {
  checkProtoFileSize(files);
  let out = null;
  for (const file of files) out = await protoAction('add_files', { project_id: projectId, uploads: [{ ...(await fileToUpload(file)), ...meta }] });
  return out;
}
export const removeProtoFile = (projectId, fileId) => protoAction('remove_file', { project_id: projectId, file_id: fileId });
// 시험 증거 파일 — 시험 기록이 저장된 뒤 서버가 올려 붙인다
export async function addTestEvidence(projectId, testId, files) {
  checkProtoFileSize(files);
  let out = null;
  for (const file of files) out = await protoAction('add_evidence', { project_id: projectId, test_id: testId, uploads: [await fileToUpload(file)] });
  return out;
}
export const removeTestEvidence = (projectId, testId, fileId) => protoAction('remove_evidence', { project_id: projectId, test_id: testId, file_id: fileId });
export const syncProtoRisk = (projectId) => protoAction('sync_risk', { project_id: projectId }).catch(() => null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** AI 설계 검토 실행 — 화면 요청이 먼저 끊겨도 request_id 로 만들어진 검토를 3분간 찾는다 */
export async function runReview(params, onWaiting) {
  const request_id = newId();
  try {
    return (await base44.functions.invoke('prototypeReview', { action: 'run', ...params, request_id })).data;
  } catch (e) {
    const status = e?.response?.status;
    if (status && status < 500) throw e;
    onWaiting?.();
    for (let i = 0; i < 18; i++) {
      await sleep(10000);
      const found = await base44.entities.ProtoDesignReview.filter({ project_id: params.project_id, request_id }, '-created_date', 1).catch(() => []);
      if (found[0]) return { review: found[0], recovered: true };
    }
    throw e;
  }
}

/**
 * AI 설계 초안 만들기. 오래 걸려 화면 쪽 요청이 먼저 끊겨도 서버는 초안을 끝까지 만들 수 있으므로,
 * 요청 번호(request_id)로 만들어진 버전을 3분 동안 찾아본다. 다시 눌러도 같은 번호면 새로 만들지 않는다.
 */
export async function runDraft(params, onWaiting) {
  const request_id = params.request_id || newId();
  try {
    return await protoAction('draft', { ...params, request_id });
  } catch (e) {
    const status = e?.response?.status;
    if (status && status < 500) throw e; // 400·403·404 같은 확실한 실패는 바로 알린다
    onWaiting?.();
    for (let i = 0; i < 18; i++) {
      await sleep(10000);
      const found = await base44.entities.ProtoDesignVersion.filter({ project_id: params.project_id, request_id }, '-created_date', 1).catch(() => []);
      if (found[0]) return { version: found[0], recovered: true };
    }
    throw e;
  }
}