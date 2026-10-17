import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake, Plus, RotateCw, Loader2, FileSpreadsheet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import AgreementDialog from '@/components/agreements/AgreementDialog';
import { AGREEMENT_STATUS, INVOICE_STATUS, daysLeft, endDateOf, kstMonth, money } from '@/lib/agreements';
import { downloadCsv, fileDate } from '@/lib/csv';

const LIVE = ['DRAFT', 'ACTIVE', 'SUSPENDED'];

function Tile({ label, value, note }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

// 월 계약 관리 (대표·팀 관리자): 계약 목록 · 만료 임박 · 이번 달 청구 · 월간 리포트
export default function Agreements() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('live');
  const [dialog, setDialog] = useState(null); // { agreement, tab }
  const [renewing, setRenewing] = useState(null);
  const month = kstMonth();

  const { data: agreements = [], isLoading } = useQuery({ queryKey: ['agreements'], queryFn: () => base44.entities.ServiceAgreement.list('-start_date', 300) });
  const { data: companies = [] } = useQuery({ queryKey: ['client-companies'], queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name', 500) });
  const { data: team = [] } = useQuery({
    queryKey: ['agreement-team', user?.tenant_id],
    queryFn: async () => (await base44.entities.User.filter({ tenant_id: user.tenant_id })).filter((u) => ['service', 'sub'].includes(u.account_tier) && u.is_active !== false),
    enabled: !!user?.tenant_id,
  });
  const { data: monthInvoices = [] } = useQuery({ queryKey: ['agreement-invoices-all', month], queryFn: () => base44.entities.ServiceInvoice.filter({ billing_month: month }, '-created_date', 500) });
  const ids = agreements.map((a) => a.id);
  const { data: linkedCards = [] } = useQuery({
    queryKey: ['agreement-card-counts', ids.join(',')],
    queryFn: () => base44.entities.TaskCard.filter({ agreement_id: { $in: ids } }, '-created_date', 1000),
    enabled: ids.length > 0,
  });

  const names = useMemo(() => new Map(team.map((u) => [u.id, u.full_name || u.email])), [team]);
  const active = agreements.filter((a) => a.status === 'ACTIVE');
  const expiring = active.filter((a) => { const d = daysLeft(a.end_date); return d != null && d >= 0 && d <= 30; });
  const revenue = active.filter((a) => (a.currency || 'KRW') === 'KRW').reduce((s, a) => s + (Number(a.monthly_fee) || 0), 0);
  const invoiceOf = (a) => monthInvoices.find((i) => i.agreement_id === a.id);
  const unbilled = active.filter((a) => !invoiceOf(a) || invoiceOf(a).status === 'PENDING');
  const rows = agreements.filter((a) => filter === 'all' || LIVE.includes(a.status)).sort((a, b) => (a.end_date || '9').localeCompare(b.end_date || '9'));

  const renew = async (a) => {
    if (!window.confirm(`${a.company_name} 계약을 같은 조건으로 갱신할까요?\n새 계약(작성 중)을 ${a.end_date} 다음 날부터 ${a.term_months || 3}개월로 만들고, 지금 계약은 '갱신됨'으로 바꿉니다.`)) return;
    setRenewing(a.id);
    try {
      const next = new Date(Date.parse(`${a.end_date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      const term = a.term_months || 3;
      const created = await base44.entities.ServiceAgreement.create({
        company_id: a.company_id, company_name: a.company_name, title: a.title, start_date: next, term_months: term, end_date: endDateOf(next, term),
        monthly_fee: a.monthly_fee ?? null, currency: a.currency || 'KRW', factory_rebate_percent: a.factory_rebate_percent ?? 10,
        assigned_user_ids: a.assigned_user_ids || [], status: 'DRAFT', renewal_of: a.id, note: a.note || '',
      });
      await base44.entities.ServiceAgreement.update(a.id, { status: 'RENEWED' });
      await qc.invalidateQueries({ queryKey: ['agreements'] });
      setDialog({ agreement: created });
      toast({ title: '갱신 계약을 만들었습니다', description: '내용을 확인하고 상태를 진행 중으로 바꿔 주세요.' });
    } catch (e) {
      toast({ title: '갱신하지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setRenewing(null);
    }
  };

  // 대표 보고용 계약 목록 (내부 전용: 월 계약료·페이백 포함)
  const exportCsv = () => downloadCsv(`AEGIS_Agreements_${fileDate()}`,
    ['고객사', '계약명', '계약 번호', '시작일', '종료일', '남은 일수', '상태', '월 계약료', '통화', '페이백 %', '진행 중 프로젝트', `${Number(month.slice(5))}월 청구`, '담당'],
    agreements.map((a) => [a.company_name, a.title, a.agreement_no, a.start_date, a.end_date, a.status === 'ACTIVE' ? daysLeft(a.end_date) : '', (AGREEMENT_STATUS[a.status] || {}).label || a.status,
      a.monthly_fee ?? '', a.currency || 'KRW', a.factory_rebate_percent ?? '', linkedCards.filter((c) => c.agreement_id === a.id && !['DONE', 'CANCELLED'].includes(c.status)).length,
      invoiceOf(a) ? (INVOICE_STATUS[invoiceOf(a).status] || {}).label : '', (a.assigned_user_ids || []).map((id) => names.get(id)).filter(Boolean).join(', ')]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Handshake className="h-5 w-5 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">월 계약 관리</h1>
          <p className="text-xs text-muted-foreground">프로젝트별 월 계약의 기간·청구·월간 리포트를 관리합니다. 월 계약료와 페이백 비율은 대표·팀 관리자에게만 보입니다.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!agreements.length} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" />엑셀로 내보내기</Button>
        <Button onClick={() => setDialog({ agreement: null })} className="gap-1.5"><Plus className="h-4 w-4" />새 계약</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="진행 중인 계약" value={`${active.length}건`} />
        <Tile label="월 계약 매출 (진행 중 합계)" value={money(revenue)} note="KRW 계약만, VAT 별도" />
        <Tile label="30일 안에 만료" value={`${expiring.length}건`} note={expiring.length ? '갱신 여부를 확인하세요' : ''} />
        <Tile label={`${Number(month.slice(5))}월 청구 미발행`} value={`${unbilled.length}건`} />
      </div>

      <div className="flex gap-1.5" role="group" aria-label="계약 필터">
        {[['live', '진행·작성 중'], ['all', '전체']].map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === k ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">아직 월 계약이 없습니다. &lsquo;새 계약&rsquo;으로 첫 계약을 등록하세요.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 font-medium">고객사 · 계약</th><th className="px-3 py-2 font-medium">기간</th><th className="px-3 py-2 font-medium">상태</th><th className="px-3 py-2 text-right font-medium">월 계약료</th><th className="px-3 py-2 text-right font-medium">프로젝트</th><th className="px-3 py-2 font-medium">{Number(month.slice(5))}월 청구</th><th className="px-3 py-2 font-medium">담당</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((a) => {
                const d = daysLeft(a.end_date);
                const st = AGREEMENT_STATUS[a.status] || AGREEMENT_STATUS.DRAFT;
                const inv = invoiceOf(a);
                const projects = linkedCards.filter((c) => c.agreement_id === a.id && !['DONE', 'CANCELLED'].includes(c.status)).length;
                const canRenew = a.status === 'ENDED' || (a.status === 'ACTIVE' && d != null && d <= 30);
                return (
                  <tr key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDialog({ agreement: a })}>
                    <td className="px-3 py-2.5"><p className="font-medium">{a.company_name || '-'}</p><p className="text-xs text-muted-foreground">{[a.title, a.agreement_no].filter(Boolean).join(' · ') || '계약명 없음'}</p></td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">
                      {a.start_date} ~ {a.end_date}
                      {a.status === 'ACTIVE' && d != null && <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${d <= 7 ? 'bg-destructive/15 text-destructive' : d <= 30 ? 'bg-chart-3/15 text-chart-3' : 'bg-muted text-muted-foreground'}`}>{d >= 0 ? `D-${d}` : '기간 지남'}</span>}
                    </td>
                    <td className="px-3 py-2.5"><Badge className={`${st.cls} border-0`}>{st.label}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(a.monthly_fee, a.currency)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{projects}건</td>
                    <td className="px-3 py-2.5">{a.status === 'ACTIVE' ? <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); setDialog({ agreement: a, tab: 'invoices' }); }}>{inv ? (INVOICE_STATUS[inv.status] || INVOICE_STATUS.PENDING).label : '기록 없음'}</button> : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-xs">{(a.assigned_user_ids || []).map((id) => names.get(id)).filter(Boolean).join(', ') || '-'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setDialog({ agreement: a, tab: 'reports' }); }}>리포트</Button>
                        {canRenew && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={renewing === a.id} onClick={(e) => { e.stopPropagation(); renew(a); }}><RotateCw className="h-3 w-3" />갱신</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AgreementDialog open={!!dialog} agreement={dialog?.agreement || null} initialTab={dialog?.tab} companies={companies} team={team}
        onClose={() => setDialog(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['agreements'] })} />
    </div>
  );
}
