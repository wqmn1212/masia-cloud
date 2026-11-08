import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const protoKeys = {
  list: ['proto-projects'],
  project: (id) => ['proto-project', id],
  versions: (id) => ['proto-versions', id],
  tests: (id) => ['proto-tests', id],
};

export const useProtoProject = (id) => useQuery({ queryKey: protoKeys.project(id), queryFn: () => base44.entities.ProtoProject.get(id), enabled: !!id });
export const useProtoVersions = (id) => useQuery({ queryKey: protoKeys.versions(id), queryFn: () => base44.entities.ProtoDesignVersion.filter({ project_id: id }, '-version_no', 50), enabled: !!id });
export const useProtoTests = (id) => useQuery({ queryKey: protoKeys.tests(id), queryFn: () => base44.entities.ProtoTest.filter({ project_id: id }, '-created_date', 100), enabled: !!id });

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
export const actorName = (user) => user?.full_name || user?.email || '';

// 업로드 파일은 비공개 저장소에 두고 레코드에는 uri·메타데이터만 남긴다
export async function uploadProtoFile(file, user, extra = {}) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return { id: newId(), name: file.name, uri: file_uri, size: file.size, uploaded_at: new Date().toISOString(), uploaded_by_name: actorName(user), ...extra };
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

// 파일 목록은 서버에서 최신 목록에 더하고 뺀다 (동시에 올려도 한쪽이 사라지지 않게)
export const addProtoFiles = (projectId, files) => protoAction('add_files', { project_id: projectId, files });
export const removeProtoFile = (projectId, fileId) => protoAction('remove_file', { project_id: projectId, file_id: fileId });
export const syncProtoRisk = (projectId) => protoAction('sync_risk', { project_id: projectId }).catch(() => null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
