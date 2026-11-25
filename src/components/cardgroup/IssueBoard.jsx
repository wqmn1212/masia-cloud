import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, ImageIcon, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { SEVERITY, ISSUE_STATUS, ISSUE_SOURCE, callGroup, filterIssues, sortIssues, vendorList, groupKey, kstToday } from '@/lib/cardGroup';
import IssueDialog from './IssueDialog';
import ImportIssuesDialog from './ImportIssuesDialog';

const STATUS_TABS = [['OPEN_ALL', '미완료'], ['all', '전체'], ...Object.entries(ISSUE_STATUS).map(([k, v]) => [k, v.label])];

// 이슈 보드: 거르기·찾기, 상태·중요도는 목록에서 바로 바꾸고, 줄을 누르면 사진·이력이 있는 상세가 열린다
export default function IssueBoard({ group, issues, cards, canDelete }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ q: '', status: 'OPEN_ALL', severity: 'all', vendor: 'all', source: 'all' });
  const [open, setOpen] = useState(null); // issue | {} (새 이슈)
  const [importing, setImporting] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const list = useMemo(() => sortIssues(filterIssues(issues, f)), [issues, f]);
  const vendors = useMemo(() => vendorList(issues), [issues]);
  const sources = useMemo(() => [...new Set(issues.map((i) => i.source || 'MANUAL'))], [issues]);
  const cardTitle = Object.fromEntries(cards.map((c) => [c.id, c.title]));
  const today = kstToday();
  const counts = useMemo(() => Object.fromEntries(STATUS_TABS.map(([k]) => [k, filterIssues(issues, { ...f, status: k }).length])), [issues, f]);

  const refresh = () => qc.invalidateQueries({ queryKey: groupKey(group.id) });
  const quick = async (issue, fields) => {
    qc.setQueryData(groupKey(group.id), (d) => d && ({ ...d, issues: d.issues.map((i) => (i.id === issue.id ? { ...i, ...fields } : i)) }));
    try { await callGroup('issue_save', { group_id: group.id, issue_id: issue.id, fields }); } catch (e) { toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }); }
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-8" value={f.q} placeholder="문제점·부위·업체·담당·번호로 찾기" onChange={(e) => set('q', e.target.value)} /></div>
        <select aria-label="중요도" className="h-9 rounded-md border bg-background px-2 text-label" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
          <option value="all">모든 중요도</option>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {vendors.length > 0 && (
          <select aria-label="업체" className="h-9 max-w-[200px] rounded-md border bg-background px-2 text-label" value={f.vendor} onChange={(e) => set('vendor', e.target.value)}>
            <option value="all">모든 업체</option>{vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
        {sources.length > 1 && (
          <select aria-label="출처" className="h-9 rounded-md border bg-background px-2 text-label" value={f.source} onChange={(e) => set('source', e.target.value)}>
            <option value="all">모든 출처</option>{sources.map((s) => <option key={s} value={s}>{ISSUE_SOURCE[s] || s}</option>)}
          </select>
        )}
        <Button variant="outline" size="sm" className="h-9" onClick={() => setImporting(true)}><FileSpreadsheet className="mr-1 h-4 w-4" />엑셀 가져오기</Button>
        <Button size="sm" className="h-9" onClick={() => setOpen({})}><Plus className="mr-1 h-4 w-4" />이슈 추가</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => set('status', k)} className={`rounded-full border px-3 py-1 text-label ${f.status === k ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {l} <span className="opacity-70">{counts[k]}</span>
          </button>
        ))}
      </div>

      {!issues.length && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-body font-medium">아직 이슈가 없습니다</p>
          <p className="mt-1 text-caption text-muted-foreground">조립 문제점 관리표 같은 엑셀을 가져오거나, 이슈를 직접 추가하세요.</p>
        </div>
      )}
      {issues.length > 0 && !list.length && <p className="py-6 text-center text-body text-muted-foreground">조건에 맞는 이슈가 없습니다</p>}

      <div className="divide-y rounded-xl border bg-card">
        {list.map((i) => {
          const overdue = i.status !== 'DONE' && i.due_date && i.due_date < today;
          return (
            <div key={i.id} className="flex gap-3 p-3 hover:bg-muted/40">
              <button type="button" onClick={() => setOpen(i)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted" aria-label={`#${i.no} 사진`}>
                {i.photos?.[0] ? <img src={i.photos[0].url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto mt-5 h-5 w-5 text-muted-foreground/60" />}
                {i.photos?.length > 1 && <span className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-micro">+{i.photos.length - 1}</span>}
              </button>
              <button type="button" onClick={() => setOpen(i)} className="min-w-0 flex-1 text-left">
                <p className="text-caption text-muted-foreground">#{i.no}{i.area ? ` · ${i.area}` : ''}{i.vendor ? ` · ${i.vendor}` : ''}{i.card_id && cardTitle[i.card_id] ? ` · ${cardTitle[i.card_id]}` : ''}</p>
                <p className={`text-body font-medium ${i.status === 'DONE' ? 'text-muted-foreground line-through' : ''}`}>{i.title}</p>
                {i.detail && <p className="line-clamp-1 text-caption text-muted-foreground">{i.detail}</p>}
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {i.assignee_name ? `담당 ${i.assignee_name}` : '담당 없음'}
                  {i.due_date && <span className={overdue ? 'font-semibold text-destructive' : ''}> · 목표 {i.due_date}{overdue ? ' (지남)' : ''}</span>}
                  {i.updated_by_name && <span> · 마지막 수정 {i.updated_by_name}</span>}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <select aria-label={`#${i.no} 상태`} className={`h-7 rounded-md border-0 px-1.5 text-micro font-semibold ${ISSUE_STATUS[i.status]?.cls}`} value={i.status} onChange={(e) => quick(i, { status: e.target.value })}>
                  {Object.entries(ISSUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select aria-label={`#${i.no} 중요도`} className={`h-7 rounded-md border-0 px-1.5 text-micro font-semibold ${SEVERITY[i.severity]?.cls}`} value={i.severity} onChange={(e) => quick(i, { severity: e.target.value })}>
                  {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      {open && <IssueDialog issue={open.id ? open : null} group={group} cards={cards} canDelete={canDelete} onClose={() => setOpen(null)} onSaved={refresh} />}
      {importing && <ImportIssuesDialog group={group} cards={cards} onClose={() => setImporting(false)} onDone={refresh} />}
    </div>
  );
}
