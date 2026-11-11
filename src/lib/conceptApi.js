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

/** 컨셉 생성·검토 실행 — AI 가 오래 걸려 화면 요청이 끊겨도 요청 번호로 저장된 결과를 3분간 찾는다 */
export async function runConcept(action, params, onWaiting) {
  const request_id = newId();
  try {
    return (await base44.functions.invoke('prototypeConcept', { action, ...params, request_id })).data;
  } catch (e) {
    const status = e?.response?.status;
    if (status && status < 500) throw e;
    onWaiting?.();
    for (let i = 0; i < 18; i++) {
      await sleep(10000);
      const found = await base44.entities.ProtoConcept.filter({ last_request_id: request_id }, '-updated_date', 1).catch(() => []);
      if (found[0]) return { concept: found[0], project_id: found[0].project_id, recovered: true };
    }
    throw e;
  }
}