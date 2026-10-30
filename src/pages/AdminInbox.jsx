import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardCheck, Columns3, FileCheck2, FileSignature, Landmark, Loader2, PackageX, RefreshCw, Wallet, Calculator, Factory, CalendarClock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { REMITTANCE_FOR_STAGE } from '@/components/files/documentTypes';
import { paymentQueue, overdueQueue, claimQueue, signatureQueue, inboxCounts, daysSince, OPEN_CLAIM } from '@/lib/adminInbox';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PayeeAccountsPanel from '@/components/payments/PayeeAccountsPanel';
import QuoteApprovalSection from '@/components/quotation/QuoteApprovalSection';

// 관리자 할 일: 대표·팀 관리자(service)와 마스터가 처리하거나 챙겨야 할 일을 한곳에 모은다. 처리는 각 화면에서 한다.
const STAGE = { DOWN_PAYMENT: ['선금', '首款'], INTERIM_PAYMENT: ['중도금', '中期款'], BALANCE_PAYMENT: ['잔금', '尾款'] };
const CLAIM = { SUBMITTED: ['접수', '受理'], REVIEWING: ['확인 중', '确认中'], FACTORY_CONFIRMED: ['공장 확인', '工厂确认'] };
const won = (n) => (n == null ? '' : `${Math.round(Number(n)).toLocaleString('ko-KR')}원`);
const cardLink = (id, tab) => `/task-board?card=${id}${tab ? `&tab=${tab}` : ''}`;

function useInbox() {
  const status = useQuery({ queryKey: ['admin-inbox', 'status'], queryFn: async () => (await base44.functions.invoke('assistantStatus', { topic: 'all' })).data });
  const accounts = useQuery({ queryKey: ['admin-inbox', 'accounts'], queryFn: () => base44.entities.FactoryAccount.filter({ status: 'PENDING' }, '-proposed_at', 50) });
  const payments = useQuery({
    queryKey: ['admin-inbox', 'payments'],
    queryFn: async () => {
      const stages = await base44.entities.PaymentStage.filter({ approval_status: 'PENDING' }, '-updated_date', 200);
      const receipts = (await Promise.all(Object.values(REMITTANCE_FOR_STAGE).map((t) => base44.entities.CardAttachment.filter({ document_type: t }, '-created_date', 300)))).flat();
      return { queue: paymentQueue(stages, receipts), overdue: overdueQueue(stages) };
    },
  });
  const claims = useQuery({ queryKey: ['admin-inbox', 'claims'], queryFn: async () => claimQueue(await base44.entities.QualityClaim.filter({}, '-submitted_at', 200)) });
  const cardIds = useMemo(() => [...new Set([...(payments.data?.queue || []), ...(payments.data?.overdue || []), ...(claims.data || [])].map((r) => r.card_id).filter(Boolean))], [payments.data, claims.data]);
  const cards = useQuery({
    queryKey: ['admin-inbox', 'cards', cardIds],
    enabled: cardIds.length > 0,
    queryFn: async () => Object.fromEntries((await Promise.all(cardIds.map((id) => base44.entities.TaskCard.get(id).catch(() => null)))).filter(Boolean).map((c) => [c.id, c])),
  });
  return { status, accounts, payments, claims, cards: cards.data || {} };
}

function Section({ id, icon: Icon, title, desc, count, loading, error, children, empty }) {
  return (
    <Card id={id} className="scroll-mt-20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="text-body font-semibold">{title}</h2>{!loading && !error && <Badge variant={count ? 'default' : 'secondary'} className="text-micro">{count}</Badge>}</div>
          <p className="mt-0.5 text-label text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="mt-3">
        {loading ? <p className="flex items-center gap-2 py-3 text-label text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</p>
          : error ? <p className="py-3 text-label text-destructive">{error}</p>
            : count ? <ul className="divide-y">{children}</ul>
              : <p className="flex items-center gap-1.5 py-3 text-label text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />{empty}</p>}
      </div>
    </Card>
  );
}

function Row({ title, meta, badge, warn, to, action }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-body font-medium">{title}{badge}</div>
        {meta && <p className="mt-0.5 text-label text-muted-foreground">{meta}</p>}
        {warn && <p className="mt-0.5 flex items-center gap-1 text-label text-warning-text"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{warn}</p>}
      </div>
      {to && <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-label"><Link to={to}>{action}<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>}
    </li>
  );
}

export default function AdminInbox() {
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const L = (pair) => (zh ? pair[1] : pair[0]);
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });
  const { status, accounts, payments, claims, cards } = useInbox();
  const quotes = useQuery({
    queryKey: ['admin-inbox', 'quotes'],
    enabled: ['master', 'service'].includes(user?.account_tier),
    queryFn: async () => (await base44.functions.invoke('quoteApproval', { action: 'queue' })).data,
  });
  const quoteCount = (quotes.data?.review?.length || 0) + (quotes.data?.unsent?.length || 0);
  const s = status.data || {};
  const sigs = signatureQueue(s.signatures);
  const comparisons = s.comparisons?.awaiting_confirm || [];
  const costs = { cards: s.costs?.cards_to_confirm || [], shipments: s.costs?.shipments_missing_actual || [] };
  const paymentRows = payments.data?.queue || [];
  const overdueRows = payments.data?.overdue || [];
  const counts = inboxCounts({ accounts: accounts.data || [], payments: paymentRows, overdue: overdueRows, comparisons, signatures: sigs, costs, claims: claims.data || [] });
  const canVerify = user?.account_tier === 'master';
  const statusErr = status.isError ? L(['현황을 불러오지 못했습니다.', '无法加载现状。']) : null;
  const tiles = [
    ['quotes', FileCheck2, ['견적 승인', '报价审批']], ['accounts', Landmark, ['공장 계좌', '工厂账户']], ['payments', Wallet, ['입금 확인', '确认到账']], ['overdue', AlarmClock, ['결제 기한 지남', '付款逾期']], ['comparisons', Columns3, ['고객 선택', '客户选择']],
    ['signatures', FileSignature, ['전자서명', '电子签名']], ['costs', Calculator, ['도착 원가', '到岸成本']], ['claims', PackageX, ['불량 신고', '不良投诉']],
  ];
  const cardTitle = (id) => cards[id]?.title || L(['(카드)', '(卡片)']);
  const ago = (d) => (d == null ? '' : d === 0 ? L(['오늘', '今天']) : L([`${d}일 전`, `${d} 天前`]));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ClipboardCheck className="h-6 w-6 text-primary" />{L(['관리자 할 일', '管理员待办'])}</h1>
          <p className="mt-1 text-body text-muted-foreground">{L(['확인·승인이 필요한 일과 늦어지고 있는 일을 모았습니다. 처리는 각 줄의 화면에서 합니다.', '汇总需要确认、审批以及进度延迟的事项。请在各行对应的页面中处理。'])}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-label" onClick={() => qc.invalidateQueries({ queryKey: ['admin-inbox'] })}><RefreshCw className="h-3.5 w-3.5" />{L(['새로 고침', '刷新'])}</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map(([key, Icon, label]) => (
          <a key={key} href={`#inbox-${key}`} className="rounded-xl border bg-card p-3 transition-colors hover:border-primary">
            <p className="flex items-center gap-1.5 text-label text-muted-foreground"><Icon className="h-3.5 w-3.5" />{L(label)}</p>
            <p className={`mt-1 text-title font-bold tabular-nums ${(key === 'quotes' ? quoteCount : counts[key]) ? 'text-foreground' : 'text-muted-foreground'}`}>{key === 'quotes' ? quoteCount : counts[key]}</p>
          </a>
        ))}
      </div>

      {['master', 'service'].includes(user?.account_tier) && (
        <QuoteApprovalSection data={quotes.data} loading={quotes.isLoading} error={quotes.isError && L(['견적 승인 목록을 불러오지 못했습니다.', '无法加载报价审批列表。'])} />
      )}

      <Section id="inbox-accounts" icon={Landmark} title={L(['공장 지급 계좌 확인', '核实工厂收款账户'])} count={counts.accounts} loading={accounts.isLoading} error={accounts.isError && L(['불러오지 못했습니다.', '加载失败。'])}
        desc={canVerify ? L(['공장에 직접 전화·영상으로 확인한 뒤 확인된 계좌로 지정하세요. 확인 전에는 송금하지 않습니다.', '请直接通过电话或视频与工厂核实后，再指定为已核实账户。核实前不得付款。']) : L(['계좌 확인은 마스터 계정만 할 수 있습니다. 확인될 때까지 이 공장에 송금하지 마세요.', '只有 master 账号可以核实账户。核实前请勿向该工厂付款。'])}
        empty={L(['확인을 기다리는 계좌가 없습니다.', '没有待核实的账户。'])}>
        {(accounts.data || []).map((a) => (
          <Row key={a.id} title={a.factory_name || L(['공장', '工厂'])}
            badge={a.change_reason ? <Badge variant="outline" className="border-warning/40 text-micro text-warning-text">{L(['변경 요청', '变更申请'])}</Badge> : <Badge variant="outline" className="text-micro">{L(['새 계좌', '新账户'])}</Badge>}
            meta={`${a.beneficiary_name || ''} · ${a.bank_name || ''}${a.currency ? ` · ${a.currency}` : ''} · ${L(['요청', '申请'])} ${a.proposed_by_name || ''} ${ago(daysSince(a.proposed_at))}`}
            warn={a.change_reason ? `${L(['변경 사유', '变更原因'])}: ${a.change_reason}` : null}
            to={a.factory_id ? `/factories/${a.factory_id}/dashboard` : '/factories'} action={canVerify ? L(['확인하기', '去核实']) : L(['공장 보기', '查看工厂'])} />
        ))}
      </Section>

      <Section id="inbox-payments" icon={Wallet} title={L(['입금 확인 대기', '待确认到账'])} count={counts.payments} loading={payments.isLoading} error={payments.isError && L(['불러오지 못했습니다.', '加载失败。'])}
        desc={L(['입금일이 적혔거나, 송금확인증이 올라왔거나, 고객이 "송금했어요"를 누른 결제 단계입니다. 통장 입금을 확인한 뒤 카드 정산 탭에서 입금 확인을 누르세요.', '已填写到账日期、已上传汇款凭证或客户点了“已汇款”的付款阶段。核对银行到账后，在卡片结算页点击确认到账。'])}
        empty={L(['확인할 입금이 없습니다.', '没有需要确认的到账。'])}>
        {paymentRows.map((p) => (
          <Row key={p.id} title={`${cardTitle(p.card_id)} · ${L(STAGE[p.stage_type] || ['결제', '付款'])} ${p.percentage ?? ''}%`}
            badge={p.reported ? <Badge className="border-0 bg-primary/10 text-micro text-primary">{L(['고객 송금 알림', '客户已告知汇款'])}</Badge> : null}
            meta={[p.amount ? `${p.currency || ''} ${Number(p.amount).toLocaleString('ko-KR')}` : '', p.paid_date ? `${L(['입금일', '到账日'])} ${p.paid_date}` : '', p.reported ? `${L(['고객이 적은 송금일', '客户填写的汇款日'])} ${p.client_reported_paid_date || ''}${p.client_reported_by_name ? ` (${p.client_reported_by_name})` : ''}` : '', p.has_receipt ? L(['송금확인증 있음', '有汇款凭证']) : ''].filter(Boolean).join(' · ')}
            warn={!p.has_receipt && REMITTANCE_FOR_STAGE[p.stage_type] ? L(['송금확인증이 없습니다. 고객에게 요청하거나 통장 내역으로 확인하세요.', '没有汇款凭证。请向客户索取，或以银行流水核对。']) : null}
            to={cardLink(p.card_id, 'settlement')} action={L(['입금 확인', '确认到账'])} />
        ))}
      </Section>

      <Section id="inbox-overdue" icon={AlarmClock} title={L(['결제 기한 지남', '付款逾期'])} count={counts.overdue} loading={payments.isLoading} error={payments.isError && L(['불러오지 못했습니다.', '加载失败。'])}
        desc={L(['결제 요청을 보냈는데 기한이 지나도록 고객이 송금했다고 알리지 않은 단계입니다. 고객에게 연락하거나 기한을 고쳐 다시 보내세요.', '已发送付款请求但超过期限客户仍未告知汇款的阶段。请联系客户，或修改期限后重新发送。'])}
        empty={L(['기한이 지난 결제 요청이 없습니다.', '没有逾期的付款请求。'])}>
        {overdueRows.map((p) => (
          <Row key={p.id} title={`${cardTitle(p.card_id)} · ${L(STAGE[p.stage_type] || ['결제', '付款'])} ${p.percentage ?? ''}%`}
            badge={<Badge variant="outline" className="border-warning/40 text-micro text-warning-text">{L([`${-p.left}일 지남`, `逾期 ${-p.left} 天`])}</Badge>}
            meta={[p.amount ? `${p.currency || ''} ${Number(p.amount).toLocaleString('ko-KR')}` : '', `${L(['기한', '期限'])} ${p.due_date}`, p.requested_by_name ? `${L(['요청', '请求'])} ${p.requested_by_name}` : ''].filter(Boolean).join(' · ')}
            to={cardLink(p.card_id, 'settlement')} action={L(['결제 요청 보기', '查看付款请求'])} />
        ))}
      </Section>

      <Section id="inbox-comparisons" icon={Columns3} title={L(['고객이 고른 견적 비교표 (확정 전)', '客户已选择的比价表（待确认）'])} count={counts.comparisons} loading={status.isLoading} error={statusErr}
        desc={L(['고객이 "이 안으로 진행"을 누른 비교표입니다. 확정해야 견적·공장 지정·계약서로 이어집니다.', '客户已点击“按此方案进行”的比价表。确认后才会进入报价、指定工厂和合同流程。'])}
        empty={L(['확정을 기다리는 비교표가 없습니다.', '没有待确认的比价表。'])}>
        {comparisons.map((c) => (
          <Row key={c.card_id} title={c.card_title} badge={<Badge className="border-0 bg-primary/10 text-micro text-primary">{c.client_choice}</Badge>}
            meta={`${c.client_name || ''}${c.published_date ? ` · ${L(['공개', '公开'])} ${c.published_date}` : ''}`} warn={c.client_note ? `${L(['고객 메모', '客户备注'])}: ${c.client_note}` : null}
            to={cardLink(c.card_id, 'quotation')} action={L(['확정하기', '去确认'])} />
        ))}
      </Section>

      <Section id="inbox-signatures" icon={FileSignature} title={L(['전자서명 챙길 일', '电子签名待处理'])} count={counts.signatures} loading={status.isLoading} error={statusErr}
        desc={L(['고객이 수정을 요청했거나, 기한이 지났거나, 기한이 3일 안으로 남은 서명 요청입니다.', '客户要求修改、已超过期限或距期限不足 3 天的签名请求。'])}
        empty={L(['챙길 서명 요청이 없습니다.', '没有需要处理的签名请求。'])}>
        {sigs.map((r) => (
          <Row key={`${r.kind}-${r.contract_id}`} title={r.title}
            badge={<Badge variant="outline" className={`text-micro ${r.kind === 'DUE_SOON' ? '' : 'border-warning/40 text-warning-text'}`}>{r.kind === 'DECLINED' ? L(['수정 요청', '要求修改']) : r.kind === 'EXPIRED' ? L(['기한 지남', '已过期']) : r.left === 0 ? L(['오늘 기한', '今天截止']) : L([`기한 ${r.left}일 남음`, `剩 ${r.left} 天`])}</Badge>}
            meta={`${r.document_no || ''} v${r.version || 1} · ${r.signer || ''}${r.kind === 'DUE_SOON' ? ` · ${r.signer_viewed ? L(['열람함', '已阅读']) : L(['열람 전', '未阅读'])}` : ''}${r.due_date ? ` · ${L(['기한', '期限'])} ${r.due_date}` : ''}`}
            warn={r.decline_reason ? `${L(['고객 요청', '客户意见'])}: ${r.decline_reason}` : null}
            to={`/contracts?contract=${r.contract_id}`} action={r.kind === 'DUE_SOON' ? L(['다시 알리기', '再次提醒']) : L(['고쳐서 다시 보내기', '修改后重发'])} />
        ))}
      </Section>

      <Section id="inbox-costs" icon={Calculator} title={L(['도착 원가 확정·도착 비용 입력', '确认到岸成本 · 填写到岸费用'])} count={counts.costs} loading={status.isLoading} error={statusErr}
        desc={L(['선적이 모두 도착했는데 원가를 확정하지 않은 카드와, 도착했지만 실제 도착 비용이 비어 있는 선적입니다.', '所有发货已到港但尚未确认成本的卡片，以及已到港但实际到岸费用为空的发货。'])}
        empty={L(['확정할 원가가 없습니다.', '没有需要确认的成本。'])}>
        {costs.cards.map((c) => (
          <Row key={`c-${c.card_id}`} title={c.card_title} badge={<Badge variant="outline" className="text-micro">{L(['원가 확정', '确认成本'])}</Badge>}
            meta={c.client_name} warn={c.actual_missing ? L(['실제 도착 비용이 빠진 선적이 있어 예상액으로 채워집니다.', '有发货缺少实际到岸费用，将以预估金额填入。']) : null}
            to={cardLink(c.card_id, 'settlement')} action={L(['원가 확정하기', '去确认成本'])} />
        ))}
        {costs.shipments.map((sh) => (
          <Row key={`s-${sh.shipment_id}`} title={`${sh.card_title} · ${sh.label}`} badge={<Badge variant="outline" className="text-micro">{L(['도착 비용', '到岸费用'])}</Badge>}
            meta={`${sh.tracking_no ? `B/L ${sh.tracking_no} · ` : ''}${sh.estimate_ex_vat != null ? `${L(['예상', '预估'])} ${won(sh.estimate_ex_vat)}` : ''}`}
            to="/assistant" action={L(['정산서로 기록', '用结算单记录'])} />
        ))}
      </Section>

      <Section id="inbox-claims" icon={PackageX} title={L(['처리 중인 불량 신고', '处理中的不良投诉'])} count={counts.claims} loading={claims.isLoading} error={claims.isError && L(['불러오지 못했습니다.', '加载失败。'])}
        desc={L(['고객이 포털 검수 탭에서 신고한 불량과, 다음 주문에 아직 반영하지 않은 보상 약속입니다. 공장 회신 3영업일이 지난 건, 접수 후 2일 넘게 그대로인 건이 위에 옵니다.', '客户在门户检验页提交的不良投诉，以及尚未在下次订单中兑现的补偿承诺。工厂超过 3 个工作日未回复、受理后超过 2 天仍未处理的排在前面。'])}
        empty={L(['처리 중인 불량 신고가 없습니다.', '没有处理中的不良投诉。'])}>
        {(claims.data || []).map((c) => (
          <Row key={c.id} title={`${cardTitle(c.card_id)} · ${c.title}`}
            badge={<Badge variant="outline" className={`text-micro ${c.stale || c.factory_overdue ? 'border-warning/40 text-warning-text' : ''}`}>{c.promise && !OPEN_CLAIM.includes(c.status) ? L(['보상 미반영', '补偿未兑现']) : L(CLAIM[c.status])}</Badge>}
            meta={`${c.submitted_by_name || ''}${c.age != null ? ` · ${ago(c.age)} ${L(['접수', '受理'])}` : ''}${c.defect_qty != null ? ` · ${L(['불량', '不良'])} ${c.defect_qty}${c.received_qty ? `/${c.received_qty}` : ''}` : ''}${c.wait ? ` · ${L(['공장 회신 대기', '等待工厂回复'])} ${c.wait.business}${L(['영업일', '个工作日'])}` : ''}`}
            warn={c.factory_overdue ? L(['공장 회신 기한(3영업일)이 지났습니다. 공장에 독촉하고 회신을 기록하세요.', '已超过工厂回复期限（3 个工作日），请催促工厂并记录回复。']) : c.stale ? L(['접수 후 2일 넘게 확인하지 않았습니다.', '受理后超过 2 天未确认。']) : c.promise && !OPEN_CLAIM.includes(c.status) ? L(['약속한 보상을 다음 주문에 반영했는지 기록하세요.', '请记录承诺的补偿是否已在下次订单中兑现。']) : null}
            to={cardLink(c.card_id, 'tasks')} action={L(['처리하기', '去处理'])} />
        ))}
      </Section>

      <FactoryAndReorderSections L={L} cardTitle={cardTitle} />

      {user && <PayeeAccountsPanel user={user} />}
    </div>
  );
}

// 공장 업로드 링크 제출 확인 대기와 고객 재주문 시점 (4단계). 위쪽 숫자 칸에는 넣지 않고 참고 목록으로 둔다
function FactoryAndReorderSections({ L, cardTitle }) {
  const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const until = new Date(Date.now() + (9 + 14 * 24) * 3600000).toISOString().slice(0, 10);
  const factory = useQuery({ queryKey: ['admin-inbox', 'factory-requests'], queryFn: async () => (await base44.entities.FactoryRequest.filter({ status: 'OPEN' }, '-last_submitted_at', 100)).filter((r) => (r.items || []).some((i) => i.status === 'SUBMITTED')) });
  const plans = useQuery({
    queryKey: ['admin-inbox', 'reorder-plans'],
    queryFn: async () => {
      const rows = (await base44.entities.ProductPlan.filter({}, 'order_by', 200)).filter((p) => p.order_by && p.order_by <= until);
      const names = {};
      for (const id of [...new Set(rows.map((p) => p.company_id))]) names[id] = (await base44.entities.Company.get(id).catch(() => null))?.company_name || '';
      return rows.map((p) => ({ ...p, company_name: names[p.company_id] }));
    },
  });
  const factoryRows = factory.data || [];
  const planRows = plans.data || [];
  return (
    <>
      <Section id="inbox-factory" icon={Factory} title={L(['공장 제출 확인 대기', '工厂提交待确认'])} count={factoryRows.length} loading={factory.isLoading} error={factory.isError && L(['불러오지 못했습니다.', '加载失败。'])}
        desc={L(['공장이 업로드 링크로 올린 사진·서류·답 중 아직 채택하거나 재요청하지 않은 것입니다. 카드 업무 탭의 공장 업로드 링크에서 처리합니다.', '工厂通过上传链接提交、尚未确认或要求重新提交的照片、文件和回答。请在卡片任务页的工厂上传链接中处理。'])}
        empty={L(['확인할 공장 제출이 없습니다.', '没有待确认的工厂提交。'])}>
        {factoryRows.map((r) => (
          <Row key={r.id} title={`${cardTitle(r.card_id)} · ${r.factory_name || L(['공장', '工厂'])}`}
            badge={<Badge className="border-0 bg-primary/10 text-micro text-primary">{L([`확인 대기 ${(r.items || []).filter((i) => i.status === 'SUBMITTED').length}건`, `待确认 ${(r.items || []).filter((i) => i.status === 'SUBMITTED').length} 项`])}</Badge>}
            meta={`${L(['마지막 제출', '最近提交'])} ${String(r.last_submitted_at || '').slice(0, 10)} · ${r.created_by_name || ''}`}
            to={cardLink(r.card_id, 'tasks')} action={L(['확인하기', '去确认'])} />
        ))}
      </Section>
      <Section id="inbox-reorder" icon={CalendarClock} title={L(['고객 재주문 시점 (2주 이내)', '客户返单时机（2周内）'])} count={planRows.length} loading={plans.isLoading} error={plans.isError && L(['불러오지 못했습니다.', '加载失败。'])}
        desc={L(['고객이 상품 원가에 적은 재고·월 사용량으로 계산한 주문 권장일이 2주 안이거나 지난 상품입니다. 재주문 영업과 공장 생산 일정을 미리 잡는 근거로 쓰세요.', '根据客户在产品成本中填写的库存和月用量计算，建议下单日在2周内或已过的产品。可作为返单销售和提前安排工厂生产的依据。'])}
        empty={L(['2주 안에 주문 시점이 오는 고객 상품이 없습니다.', '2周内没有到下单时机的客户产品。'])}>
        {planRows.map((p) => (
          <Row key={p.id} title={`${p.company_name || L(['고객사', '客户'])} · ${p.product_name || L(['상품', '产品'])}`}
            badge={<Badge variant="outline" className={`text-micro ${p.order_by < kstToday ? 'border-warning/40 text-warning-text' : ''}`}>{p.order_by < kstToday ? L(['권장일 지남', '已过建议日']) : L(['주문 권장', '建议下单'])} {p.order_by}</Badge>}
            meta={[p.runout ? `${L(['예상 소진', '预计用完'])} ${p.runout}` : '', p.recommended_qty ? `${L(['권장 발주량', '建议数量'])} ${Number(p.recommended_qty).toLocaleString('ko-KR')}${p.unit_label || ''}` : '', p.lead_days ? `${L(['발주→도착 평균', '下单→到货平均'])} ${p.lead_days}${L(['일', '天'])}` : ''].filter(Boolean).join(' · ')}
            to={cardLink(p.product_key, 'overview')} action={L(['카드 보기', '查看卡片'])} />
        ))}
      </Section>
    </>
  );
}
