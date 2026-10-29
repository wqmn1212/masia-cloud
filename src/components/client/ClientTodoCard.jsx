import React from 'react';
import { ClipboardCheck, CalendarClock, ChevronRight } from 'lucide-react';
import useClientOverview from '@/lib/useClientOverview';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { shortDate, dday, money, kstToday } from './clientFormat';

const STAGE = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
// 결재할 결정이 있는 카드 탭
const KIND_TAB = { comparison_choice: 'quotation', quote_accept: 'quotation', qc_decision: 'qc', spec_decision: 'qc', file_review: 'files' };
const daysLeft = (ymd) => (ymd ? Math.round((Date.parse(ymd) - Date.parse(kstToday())) / 86400000) : null);

function Row({ onClick, children }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
        {children}
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

// 고객 대시보드 맨 위: 고객이 직접 해야 할 일(사내 결재, 계약서 서명, 결제, 기준서·출고 판단, 디자인 확인, 도착지 비용 확인, 견적 비교표)과 앞으로 2주 일정.
export default function ClientTodoCard({ onOpen, onSign }) {
  const { data } = useClientOverview();
  const payments = data?.payment_pending || [];
  const specs = data?.spec_pending || [];
  const qc = data?.qc_pending || [];
  const destCosts = data?.dest_cost_pending || [];
  const comparisons = data?.comparison_pending || [];
  const signatures = data?.signature_pending || [];
  const upcoming = data?.upcoming || [];
  const reviews = data?.file_review_pending || [];
  // 내가 결재할 것 + 내가 요청했다가 반려·무효가 된 것
  const toApprove = (data?.approvals || []).filter((a) => a.can_approve);
  const returned = (data?.approvals || []).filter((a) => a.mine && ['REJECTED', 'STALE'].includes(a.status));
  const count = toApprove.length + returned.length + payments.length + specs.length + qc.length + destCosts.length + comparisons.length + signatures.length + reviews.length;

  return (
    <Card className="grid gap-5 p-5 xl:grid-cols-2">
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4 text-primary" />고객님이 확인하실 일
          {count > 0 && <Badge className="border-0 bg-destructive/15 text-destructive">{count}</Badge>}
        </h2>
        {count === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">지금 확인하실 일은 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {toApprove.map((a) => (
              <Row key={a.approval_id} onClick={() => onOpen(a.card_id, KIND_TAB[a.kind] || 'overview')}>
                <Badge className="shrink-0 border-0 bg-primary text-[10px] text-primary-foreground">결재 요청</Badge>
                <span className="min-w-[96px] flex-1 truncate">{a.card_title}</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">{a.target_label} · {a.requested_by_name}</span>
              </Row>
            ))}
            {returned.map((a) => (
              <Row key={a.approval_id} onClick={() => onOpen(a.card_id, KIND_TAB[a.kind] || 'overview')}>
                <Badge className="shrink-0 border-0 bg-destructive/15 text-[10px] text-destructive">{a.status === 'REJECTED' ? '결재 반려' : '결재 무효'}</Badge>
                <span className="min-w-[96px] flex-1 truncate">{a.card_title}</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">{a.reason}</span>
              </Row>
            ))}
            {signatures.map((r) => (
              <Row key={r.request_id} onClick={() => onSign?.(r.request_id)}>
                <Badge className="shrink-0 border-0 bg-primary/10 text-[10px] text-primary">계약서 서명</Badge>
                <span className="min-w-0 truncate">{r.document_title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">기한 {shortDate(new Date(Date.parse(r.due_at) + 9 * 3600000).toISOString().slice(0, 10))}</span>
              </Row>
            ))}
            {payments.map((p) => {
              const left = daysLeft(p.due_date);
              return (
                <Row key={p.stage_id} onClick={() => onOpen(p.card_id, 'settlement')}>
                  <Badge className="shrink-0 border-0 bg-primary/10 text-[10px] text-primary">{STAGE[p.stage_type] || '대금'} 결제</Badge>
                  <span className="min-w-[96px] flex-1 truncate">{p.card_title}</span>
                  <span className={`min-w-0 truncate text-xs tabular-nums ${left != null && left <= 3 ? 'font-medium text-warning-text' : 'text-muted-foreground'}`}>{[money(p.amount, p.currency), p.due_date ? `기한 ${shortDate(p.due_date)}${left != null && left <= 3 ? ` · ${dday(left)}` : ''}` : ''].filter(Boolean).join(' · ')}</span>
                </Row>
              );
            })}
            {comparisons.map((c) => (
              <Row key={c.comparison_id} onClick={() => onOpen(c.card_id, 'quotation')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">견적 비교표 확인</Badge>
                <span className="min-w-0 truncate">{c.card_title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.options}개 안</span>
              </Row>
            ))}
            {specs.map((s) => (
              <Row key={s.spec_id} onClick={() => onOpen(s.card_id, 'qc')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">기준서 승인 대기</Badge>
                <span className="min-w-0 truncate">{s.card_title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">품질 기준서 v{s.version}</span>
              </Row>
            ))}
            {reviews.map((r) => (
              <Row key={r.review_id} onClick={() => onOpen(r.card_id, 'files')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">디자인 확인</Badge>
                <span className="min-w-[96px] flex-1 truncate">{r.card_title}</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">{r.file_name}{r.due_date ? ` · 기한 ${shortDate(r.due_date)}` : ''}</span>
              </Row>
            ))}
            {destCosts.map((d) => (
              <Row key={d.shipment_id} onClick={() => onOpen(d.card_id, 'overview')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">도착지 비용 확인</Badge>
                <span className="min-w-0 truncate">{d.card_title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.label} · 약 {d.amount.toLocaleString('ko-KR')}원</span>
              </Row>
            ))}
            {qc.map((q) => (
              <Row key={q.report_id} onClick={() => onOpen(q.card_id, 'qc')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">{q.decision === 'ON_HOLD' ? '보류 중' : q.inspection_type === 'SAMPLE' ? '샘플 승인 대기' : '출고 승인 대기'}</Badge>
                <span className="min-w-0 truncate">{q.card_title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{q.inspection_type === 'SAMPLE' ? '샘플 검수' : '출고 전 검수'}</span>
              </Row>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-primary" />앞으로 2주 일정</h2>
        {upcoming.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">2주 안에 예정된 단계가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {upcoming.map((u) => (
              <Row key={u.id} onClick={() => onOpen(u.card_id, 'overview')}>
                <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-primary">{shortDate(u.planned_date)}</span>
                <span className="min-w-0 truncate">{u.label}</span>
                <span className="min-w-0 shrink truncate text-xs text-muted-foreground">{u.card_title}</span>
              </Row>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
