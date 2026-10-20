// 파일 승인본: 공장에는 승인본만 보내고, 새 승인본이 나오면 이전 것은 '사용 안 함'이 된다.
export const isCurrentApproved = (f) => !!f.factory_approved && !f.superseded_by_id;

// 승인본으로 지정할 때 바꿀 값들. replaced = 이 파일이 대체하는 이전 승인본 (없으면 새 문서, 1판)
export function approvalPatches(file, replaced, by) {
  const now = new Date().toISOString();
  const patches = [{ id: file.id, factory_approved: true, revision: replaced ? (Number(replaced.revision) || 1) + 1 : 1, approved_at: now, approved_by_name: by, supersedes_id: replaced?.id || '', superseded_by_id: '', superseded_at: '' }];
  if (replaced) patches.push({ id: replaced.id, superseded_by_id: file.id, superseded_at: now });
  return patches;
}
