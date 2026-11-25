import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// 프로젝트 그룹: 업무 카드 여러 장을 묶어 이슈·회의·결정·불량·시리얼·파일을 한곳에서 함께 관리한다.
// 값 이름표는 서버 base44/shared/groupIssues.ts 와 같다.
export const SEVERITY = {
  HIGH: { label: '높음', cls: 'bg-destructive/10 text-destructive' },
  MID: { label: '중간', cls: 'bg-warning/15 text-warning-text' },
  LOW: { label: '낮음', cls: 'bg-muted text-muted-foreground' },
};
export const ISSUE_STATUS = {
  OPEN: { label: '미조치', cls: 'bg-destructive/10 text-destructive' },
  CHECK: { label: '확인 필요', cls: 'bg-warning/15 text-warning-text' },
  DOING: { label: '조치 중', cls: 'bg-primary/10 text-primary' },
  TEMP: { label: '임시 조치', cls: 'bg-warning/15 text-warning-text' },
  DONE: { label: '완료', cls: 'bg-success/15 text-success-text' },
};
export const ISSUE_SOURCE = { ASSEMBLY: '조립 문제점', WORK_INSTRUCTION: '작업지도서 검토', SPEC: '사양서 확인', MEETING: '회의', MANUAL: '직접 입력' };
export const CARD_STATUS = { TODO: '대기 중', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주 · 제작', DONE: '완료', CANCELLED: '취소' };
export const SEVERITY_ORDER = { HIGH: 0, MID: 1, LOW: 2 };

export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

export async function callGroup(action, body = {}) {
  try {
    return (await base44.functions.invoke('cardGroup', { action, ...body })).data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || '처리하지 못했습니다');
  }
}

export const groupKey = (id) => ['card-group', id];

// 이슈 거르기: 검색어는 문제점·부위·세부·업체·담당·번호에서 찾는다
export function filterIssues(issues, { q = '', status = 'OPEN_ALL', severity = 'all', vendor = 'all', source = 'all' } = {}) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return issues.filter((i) => {
    if (status === 'OPEN_ALL' ? i.status === 'DONE' : status !== 'all' && i.status !== status) return false;
    if (severity !== 'all' && i.severity !== severity) return false;
    if (vendor !== 'all' && (i.vendor || '') !== vendor) return false;
    if (source !== 'all' && (i.source || 'MANUAL') !== source) return false;
    if (!words.length) return true;
    const hay = [i.no, i.title, i.area, i.detail, i.vendor, i.assignee_name, i.cause, i.action_plan].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// 정렬: 안 끝난 것 → 중요도 → 번호
export function sortIssues(list) {
  return [...list].sort((a, b) => (a.status === 'DONE') - (b.status === 'DONE')
    || (SEVERITY_ORDER[a.severity] ?? 1) - (SEVERITY_ORDER[b.severity] ?? 1)
    || (Number(a.no) || 0) - (Number(b.no) || 0));
}

// 업체 거르기 목록 (칸에 적힌 그대로)
export function vendorList(issues) {
  const set = new Set();
  for (const i of issues) if (i.vendor) set.add(i.vendor);
  return [...set].sort();
}

// 그룹 화면 실시간 반영: 같은 그룹의 이슈나 묶인 카드의 회의·결정·불량·파일이 바뀌면 다시 불러온다 (여러 사람이 동시에 볼 때)
const LIVE = ['GroupIssue', 'CardGroup', 'MeetingLog', 'DecisionLog', 'DefectLog', 'CardAttachment', 'TaskCard'];
export function relevant(entity, event, group) {
  const ids = group?.card_ids || [];
  const d = event?.data;
  if (entity === 'GroupIssue') return !d || d.group_id === group.id;
  if (entity === 'CardGroup') return (event?.id || d?.id) === group.id;
  if (entity === 'TaskCard') return ids.includes(event?.id || d?.id);
  return !!d && ids.includes(d.card_id);
}
export function useGroupLive(group, onChange) {
  const qc = useQueryClient();
  const timer = useRef(null);
  const ref = useRef({ group, onChange });
  ref.current = { group, onChange };
  const id = group?.id;
  useEffect(() => {
    if (!id) return undefined;
    const bump = (entity, event) => {
      const { group: g, onChange: cb } = ref.current;
      if (!g || !relevant(entity, event, g)) return;
      cb?.(entity, event);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => qc.invalidateQueries({ queryKey: groupKey(id) }), 350);
    };
    const unsubs = LIVE.map((name) => {
      try { return base44.entities[name].subscribe((ev) => bump(name, ev)); } catch { return null; }
    });
    return () => { clearTimeout(timer.current); unsubs.forEach((u) => { try { u?.(); } catch { /* 이미 끊김 */ } }); };
  }, [id, qc]);
}

export async function uploadPhoto(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, name: file.name };
}
