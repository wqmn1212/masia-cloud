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

// 미해결 위험 = 현재 설계의 높음·보통 위험 + 불합격 시험
export function openRiskCount(currentVersion, tests) {
  const risks = (currentVersion?.risks || []).filter((r) => r.severity !== 'LOW').length;
  return risks + tests.filter((t) => t.status === 'FAIL').length;
}