import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, FileText, Pencil, Radio, Archive, ArchiveRestore } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CARD_STATUS, ISSUE_STATUS, callGroup, groupKey, useGroupLive, kstToday } from '@/lib/cardGroup';
import IssueBoard from '@/components/cardgroup/IssueBoard';
import GroupEditDialog from '@/components/cardgroup/GroupEditDialog';

const TABS = [['overview', '개요'], ['issues', '이슈'], ['records', '회의·결정'], ['quality', '불량·시리얼'], ['files', '파일']];
const SERIAL_COLS = [['total', '등록'], ['READY', '출하 대기'], ['SHIPPED', '출하됨'], ['REWORK', '수리 중'], ['FAILED', '불량'], ['SCRAPPED', '폐기'], ['PENDING', '생산 전']];
const cardLink = (id, tab) => `/task-board?card=${id}${tab ? `&tab=${tab}` : ''}`;

function Tile({ label, value, tone = '', sub }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-caption text-muted-foreground">{sub}</p>}
    </div>
  );
}

// 프로젝트 그룹 상세: 묶인 카드들의 이슈·회의·결정·불량·시리얼·파일을 한 화면에서, 여러 사람이 실시간으로
export default function CardGroupDetail() {
  const { groupId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview';
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pulse, setPulse] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data, isLoading, error } = useQuery({ queryKey: groupKey(groupId), queryFn: () => callGroup('overview', { group_id: groupId }), retry: false });
  const { data: serials, isFetching: serialsLoading } = useQuery({ queryKey: ['card-group-serials', groupId], queryFn: () => callGroup('serials', { group_id: groupId }), enabled: tab === 'quality', staleTime: 60000 });
  const group = data?.group;
  useGroupLive(group, (entity) => setPulse({ entity, at: Date.now() }));
  useEffect(() => { if (!pulse) return undefined; const t = setTimeout(() => setPulse(null), 2500); return () => clearTimeout(t); }, [pulse]);

  const cards = data?.cards || [];
  const cardTitle = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c.title])), [cards]);
  const issues = data?.issues || [];
  const s = data?.summary;
  const canDelete = ['master', 'service'].includes(user?.account_tier);
  const today = kstToday();
  const setTab = (k) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', k); return n; }, { replace: true });
  const archive = async (status) => { await base44.entities.CardGroup.update(group.id, { status, updated_by_name: user?.full_name || '' }); qc.invalidateQueries({ queryKey: groupKey(groupId) }); };

  if (isLoading) return <p className="py-20 text-center text-body text-muted-foreground">그룹을 불러오는 중…</p>;
  if (error || !group) return <div className="py-20 text-center"><p className="text-body">{error?.message || '그룹을 찾을 수 없습니다'}</p><Link to="/groups" className="mt-2 inline-block text-label text-primary">그룹 목록으로</Link></div>;

  const touched = (i) => String(i.updated_date || i.history?.at(-1)?.at || '');
  const recentIssues = [...issues].sort((a, b) => touched(b).localeCompare(touched(a))).slice(0, 6);
  const records = [
    ...(data.meetings || []).map((m) => ({ ...m, kind: 'meeting' })),
    ...(data.decisions || []).map((d) => ({ ...d, kind: 'decision' })),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const vendorsOpen = Object.entries(s?.by_vendor_open || {}).filter(([v]) => v).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const filesByCard = cards.map((c) => ({ card: c, files: (data.files || []).filter((f) => f.card_id === c.id) })).filter((x) => x.files.length);

  return (
    <div className="space-y-5">
      <div>
        <Link to="/groups" className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />프로젝트 그룹</Link>
        <div className="mt-1 flex flex-wrap items-start gap-2">
          <div className="min-w-[min(100%,280px)] flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{group.name}{group.status === 'ARCHIVED' && <span className="ml-2 align-middle text-label font-normal text-muted-foreground">보관됨</span>}</h1>
            <p className="text-body text-muted-foreground">{group.client_name || '고객사 없음'} · 카드 {cards.length}장{group.description ? ` · ${group.description}` : ''}</p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption ${pulse ? 'bg-success/15 text-success-text' : 'bg-muted text-muted-foreground'}`} title="다른 사람이 고친 내용이 바로 반영됩니다">
            <Radio className="h-3.5 w-3.5" />{pulse ? '방금 반영됨' : '실시간'}
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" />카드·정보 고치기</Button>
          {canDelete && (group.status === 'ARCHIVED'
            ? <Button variant="ghost" size="sm" onClick={() => archive('ACTIVE')}><ArchiveRestore className="mr-1 h-4 w-4" />다시 열기</Button>
            : <Button variant="ghost" size="sm" onClick={() => archive('ARCHIVED')}><Archive className="mr-1 h-4 w-4" />보관</Button>)}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body ${tab === k ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}{k === 'issues' && s?.open ? <span className="ml-1 rounded-full bg-warning/15 px-1.5 text-micro text-warning-text">{s.open}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="미완료 이슈" value={s?.open ?? 0} sub={`전체 ${s?.total ?? 0} · 완료 ${s?.done ?? 0}`} />
            <Tile label="높음 · 미완료" value={s?.high_open ?? 0} tone={s?.high_open ? 'text-destructive' : ''} />
            <Tile label="목표일 지남" value={s?.overdue ?? 0} tone={s?.overdue ? 'text-destructive' : ''} />
            <Tile label="카드 진행" value={`${cards.filter((c) => c.status === 'DONE').length}/${cards.filter((c) => c.status !== 'CANCELLED').length}`} sub="완료 / 진행 대상" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border bg-card">
              <p className="border-b px-4 py-2.5 text-label font-semibold">묶인 카드</p>
              {!cards.length && <p className="p-4 text-caption text-muted-foreground">묶인 카드가 없습니다. '카드·정보 고치기'에서 카드를 고르세요.</p>}
              <ul className="divide-y">
                {cards.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-4 py-2">
                    <Link to={cardLink(c.id)} className="min-w-0 flex-1 truncate text-body hover:text-primary">{c.title}{group.main_card_id === c.id && <span className="ml-1.5 rounded bg-primary/10 px-1.5 text-micro text-primary">대표</span>}</Link>
                    <span className="shrink-0 text-caption text-muted-foreground">{CARD_STATUS[c.status] || c.status}{c.due_date ? ` · ${c.due_date}` : ''}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border bg-card">
              <div className="flex items-center border-b px-4 py-2.5"><p className="text-label font-semibold">최근 바뀐 이슈</p><button type="button" className="ml-auto text-caption text-primary" onClick={() => setTab('issues')}>이슈 보드</button></div>
              {!recentIssues.length && <p className="p-4 text-caption text-muted-foreground">이슈가 없습니다. 이슈 탭에서 엑셀을 가져오거나 직접 추가하세요.</p>}
              <ul className="divide-y">
                {recentIssues.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-4 py-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold ${ISSUE_STATUS[i.status]?.cls}`}>{ISSUE_STATUS[i.status]?.label}</span>
                    <span className="min-w-0 flex-1 truncate text-body">#{i.no} {i.title}</span>
                    <span className="shrink-0 text-caption text-muted-foreground">{i.updated_by_name}</span>
                  </li>
                ))}
              </ul>
            </section>
            {vendorsOpen.length > 0 && (
              <section className="rounded-xl border bg-card p-4">
                <p className="text-label font-semibold">업체별 미완료 이슈</p>
                <ul className="mt-2 space-y-1.5">
                  {vendorsOpen.map(([v, n]) => (
                    <li key={v} className="flex items-center gap-2 text-label">
                      <span className="min-w-0 flex-1 truncate">{v}</span>
                      <span className="h-2 rounded-full bg-primary/70" style={{ width: `${Math.max(8, (n / vendorsOpen[0][1]) * 120)}px` }} />
                      <span className="w-6 text-right tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-xl border bg-card">
              <div className="flex items-center border-b px-4 py-2.5"><p className="text-label font-semibold">최근 회의·결정</p><button type="button" className="ml-auto text-caption text-primary" onClick={() => setTab('records')}>모두 보기</button></div>
              {!records.length && <p className="p-4 text-caption text-muted-foreground">묶인 카드에 회의록·결정 기록이 없습니다.</p>}
              <ul className="divide-y">
                {records.slice(0, 5).map((r) => (
                  <li key={`${r.kind}-${r.id}`} className="px-4 py-2">
                    <p className="text-caption text-muted-foreground">{r.date} · {r.kind === 'meeting' ? '회의' : '결정'} · {cardTitle[r.card_id] || ''}</p>
                    <p className="truncate text-body">{r.kind === 'meeting' ? r.title : `${r.topic}: ${r.decision}`}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {tab === 'issues' && <IssueBoard group={group} issues={issues} cards={cards} canDelete={canDelete} />}

      {tab === 'records' && (
        <div className="space-y-3">
          <p className="text-caption text-muted-foreground">묶인 카드 {cards.length}장의 회의록과 결정 기록을 날짜순으로 모았습니다. 고치려면 해당 카드에서 여세요.</p>
          {!records.length && <p className="py-6 text-center text-body text-muted-foreground">기록이 없습니다</p>}
          {records.map((r) => (
            <article key={`${r.kind}-${r.id}`} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${r.kind === 'meeting' ? 'bg-primary/10 text-primary' : 'bg-success/15 text-success-text'}`}>{r.kind === 'meeting' ? '회의' : '결정'}</span>
                <span>{r.date}</span>
                <Link to={cardLink(r.card_id)} className="inline-flex items-center gap-0.5 hover:text-primary">{cardTitle[r.card_id] || '카드'}<ArrowUpRight className="h-3 w-3" /></Link>
              </div>
              {r.kind === 'meeting' ? (
                <>
                  <p className="mt-1 text-body font-semibold">{r.title}</p>
                  {r.decisions && <p className="mt-1 whitespace-pre-line text-label"><b>결정</b> {r.decisions}</p>}
                  {r.next_steps && <p className="mt-1 line-clamp-4 whitespace-pre-line text-label text-muted-foreground"><b>다음 할 일</b> {r.next_steps}</p>}
                </>
              ) : (
                <>
                  <p className="mt-1 text-body font-semibold">{r.topic}</p>
                  <p className="text-label">{r.decision}{r.by ? <span className="text-muted-foreground"> · {r.by}</span> : null}</p>
                </>
              )}
            </article>
          ))}
        </div>
      )}

      {tab === 'quality' && (
        <div className="space-y-5">
          <section className="rounded-xl border bg-card">
            <p className="border-b px-4 py-2.5 text-label font-semibold">카드별 양산 시리얼</p>
            {serialsLoading && !serials && <p className="p-4 text-caption text-muted-foreground">시리얼을 세는 중…</p>}
            {serials && !serials.cards.length && <p className="p-4 text-caption text-muted-foreground">묶인 카드에 등록된 시리얼이 없습니다. 카드의 양산 탭에서 검사 성적서를 올리면 등록됩니다.</p>}
            {serials?.cards.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-label">
                  <thead className="bg-muted text-left text-caption"><tr><th className="p-2 pl-4">카드</th>{SERIAL_COLS.map(([, l]) => <th key={l} className="p-2 text-right">{l}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {serials.cards.map((c) => (
                      <tr key={c.card_id}>
                        <td className="p-2 pl-4"><Link to={cardLink(c.card_id, 'quality%23card-production')} className="hover:text-primary">{cardTitle[c.card_id] || c.card_id}</Link></td>
                        {SERIAL_COLS.map(([k]) => <td key={k} className="p-2 text-right tabular-nums">{(c[k] || 0).toLocaleString()}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="rounded-xl border bg-card">
            <p className="border-b px-4 py-2.5 text-label font-semibold">불량 기록 <span className="font-normal text-muted-foreground">· {(data.defects || []).reduce((n, d) => n + (d.qty || 0), 0).toLocaleString()}건</span></p>
            {!data.defects?.length && <p className="p-4 text-caption text-muted-foreground">불량 기록이 없습니다.</p>}
            <ul className="divide-y">
              {(data.defects || []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-label">
                  <span className="text-caption text-muted-foreground">{d.date}</span>
                  <span className="min-w-0 flex-1">{d.stage ? `${d.stage} · ` : ''}{d.defect_type}{d.serial_range ? <span className="text-muted-foreground"> · {d.serial_range}</span> : null}</span>
                  <span className="tabular-nums font-semibold">{d.qty}건</span>
                  <span className="text-caption text-muted-foreground">{cardTitle[d.card_id]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-4">
          <p className="text-caption text-muted-foreground">묶인 카드에 올린 파일입니다 (대체된 옛 판은 뺐습니다). 파일 올리기·고객 공개는 해당 카드의 파일 탭에서 합니다.</p>
          {!filesByCard.length && <p className="py-6 text-center text-body text-muted-foreground">파일이 없습니다</p>}
          {filesByCard.map(({ card, files }) => (
            <section key={card.id} className="rounded-xl border bg-card">
              <div className="flex items-center border-b px-4 py-2.5">
                <p className="text-label font-semibold">{card.title} <span className="font-normal text-muted-foreground">· {files.length}개</span></p>
                <Link to={cardLink(card.id, 'files')} className="ml-auto inline-flex items-center gap-0.5 text-caption text-primary">파일 탭<ArrowUpRight className="h-3 w-3" /></Link>
              </div>
              <ul className="divide-y">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-4 py-2 text-label">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-primary">{f.name}</a>
                    {f.folder && <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">{f.folder}</span>}
                    {f.client_visible && <span className="shrink-0 rounded bg-primary/10 px-1.5 text-micro text-primary">고객 공개</span>}
                    <span className="shrink-0 text-caption text-muted-foreground">{String(f.date).slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && <GroupEditDialog open group={group} user={user} onClose={() => setEditing(false)} onSaved={() => qc.invalidateQueries({ queryKey: groupKey(groupId) })} />}
      <p className="text-caption text-muted-foreground">오늘 {today} · 이 화면을 연 사람 모두에게 이슈·회의·결정·불량·파일 변경이 바로 반영됩니다.</p>
    </div>
  );
}
