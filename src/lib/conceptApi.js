import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { newId } from '@/lib/prototypeApi';

export const conceptKey = (projectId) => ['proto-concepts', projectId];
export const useProtoConcepts = (projectId) => useQuery({
  queryKey: conceptKey(projectId),
  queryFn: () => base44.entities.ProtoConcept.filter({ project_id: projectId }, '-version_no', 30),
  enabled: !!projectId,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 참고 자료 제한 (서버 base44/shared/privateAttachments.ts 와 같은 기준)
export const MAX_UPLOADS = 5;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const fileToUpload = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve({ name: file.name, type: file.type, data: String(r.result).split(',')[1] || '' });
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

// AI 작업은 4분 넘게 걸리기도 한다. 화면 요청이 끊겨도 요청 번호로 저장된 결과를 6분간 찾는다
export const RECOVER_TRIES = 36;
export const RECOVER_INTERVAL_MS = 10000;

/**
 * 형상을 만든 뒤 렌더 이미지가 남아 있으면(preview.render_pending) 이어서 만든다.
 * 렌더가 실패해도 형상은 이미 저장돼 있으므로 그 컨셉과 오류를 함께 돌려준다.
 */
export async function renderIfPending(concept, onWaiting) {
  if (!concept?.preview?.render_pending) return { concept, error: null };
  try { return { concept: (await runConcept('render', { concept_id: concept.id }, onWaiting)).concept, error: null }; }
  catch (e) { return { concept: (await base44.entities.ProtoConcept.get(concept.id).catch(() => null)) || concept, error: e }; }
}

/** 컨셉 생성·검토 실행 (화면 요청이 끊기면 RECOVER_TRIES × RECOVER_INTERVAL_MS 동안 결과를 찾는다) */
export async function runConcept(action, params, onWaiting) {
  // 참고 자료는 파일 그대로 보내고 서버가 비공개 저장소에 올린다
  if (params?.uploads?.length) params = { ...params, uploads: await Promise.all(params.uploads.map(fileToUpload)) };
  const request_id = newId();
  try {
    return (await base44.functions.invoke('prototypeConcept', { action, ...params, request_id })).data;
  } catch (e) {
    const status = e?.response?.status;
    // 서버가 오류 내용을 돌려준 실패는 그대로 알린다. 응답이 끊긴 경우(시간 초과·연결 끊김)만 저장된 결과를 찾는다
    if ((status && status < 500) || (e?.response?.data?.error && status !== 504)) throw e;
    onWaiting?.();
    for (let i = 0; i < RECOVER_TRIES; i++) {
      await sleep(RECOVER_INTERVAL_MS);
      const found = await base44.entities.ProtoConcept.filter({ last_request_id: request_id }, '-updated_date', 1).catch(() => []);
      if (found[0]) return { concept: found[0], project_id: found[0].project_id, recovered: true };
    }
    throw e;
  }
}