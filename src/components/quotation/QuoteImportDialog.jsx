import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const KIND = { xlsx: '엑셀', csv: 'CSV', docx: '워드', pdf: 'PDF', image: '사진' };
const LEVEL = {
  error: { icon: XCircle, cls: 'text-destructive' },
  warn: { icon: AlertTriangle, cls: 'text-warning-text' },
  info: { icon: Info, cls: 'text-muted-foreground' },
};
const n = (v) => (v == null ? '-' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 2 }));

// 공장 견적서를 읽은 결과 확인: 검산(합계·단가×수량), 합계 포함 항목과 선택 사양, 사양표·조건. 적용해야 견적 화면에 채워진다.
export default function QuoteImportDialog({ result, onClose, onApply }) {
  if (!result) return null;
  const { form, checks = [], summary = {} } = result;
  const errors = checks.filter((c) => c.level === 'error').length;
  const cur = summary.currency || 'CNY';
  const items = form.quote_options || [];
  const totalOk = summary.stated_total != null && Math.abs(summary.included_total - summary.stated_total) <= Math.max(0.01, summary.stated_total * 0.005);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">견적서 읽기 결과 확인</DialogTitle>
          <DialogDescription className="text-label">{result.file_name} · {KIND[result.kind] || result.kind} · 공장 원가 그대로 채웁니다 (마진·수수료는 적용 뒤 입력)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg p-3 text-label ${totalOk ? 'bg-primary/5' : errors ? 'bg-destructive/5' : 'bg-muted/50'}`}>
            {totalOk ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-warning-text" />}
            <span>포함 항목 합 <b className="tabular-nums">{n(summary.included_total)} {cur}</b></span>
            <span className="text-muted-foreground">견적서 합계 {summary.stated_total != null ? `${n(summary.stated_total)} ${cur}` : '없음'}</span>
            {summary.optional > 0 && <span className="text-muted-foreground">선택 사양 {summary.optional}개 (합계 미포함 {n(summary.optional_total)} {cur})</span>}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-caption">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr><th className="px-2 py-1.5 text-left">품목</th><th className="px-2 py-1.5 text-left">사양</th><th className="px-2 py-1.5 text-right">수량</th><th className="px-2 py-1.5 text-right">단가</th><th className="px-2 py-1.5 text-right">금액</th></tr>
              </thead>
              <tbody className="divide-y">
                {items.map((o, i) => (
                  <tr key={i} className={o.optional ? 'bg-muted/30 text-muted-foreground' : ''}>
                    <td className="px-2 py-1.5 align-top"><span className="font-medium text-foreground">{o.option_name}</span>{o.optional && <Badge variant="outline" className="ml-1 text-micro">선택 사양</Badge>}{o.option_name_cn && <span className="block text-micro text-muted-foreground">{o.option_name_cn}</span>}</td>
                    <td className="whitespace-pre-line px-2 py-1.5 align-top">{o.specification}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right align-top tabular-nums">{n(o.quantity)}{o.unit_label}</td>
                    <td className="px-2 py-1.5 text-right align-top tabular-nums">{n(o.unit_price)}</td>
                    <td className="px-2 py-1.5 text-right align-top tabular-nums">{n(o.unit_price * o.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {checks.length > 0 && (
            <ul className="space-y-1">
              {checks.map((c, i) => { const L = LEVEL[c.level] || LEVEL.info; return <li key={i} className={`flex items-start gap-1.5 text-caption ${L.cls}`}><L.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.text}</li>; })}
            </ul>
          )}

          <div className="grid gap-3 text-caption sm:grid-cols-2">
            <div className="space-y-1">
              <p className="font-semibold text-label">기본 정보</p>
              <p>공장 {form.factory_name || '-'}{form.factory_quote_date ? ` · ${form.factory_quote_date}` : ''}</p>
              <p>제품 {form.product_name || '-'}{form.model_name ? ` · ${form.model_name}` : ''}</p>
              <p>납기 {form.lead_time_business_days ? `선금 후 ${form.lead_time_business_days}영업일` : form.shipping_days ? `${form.shipping_days}일` : '-'} · 유효기간 {form.validity_days}일</p>
              <p>결제 {form.payment_terms_pending ? '계약 시 확정' : '견적 화면에서 입력'}</p>
              {form.spec_table?.length > 0 && <p>주요 사양 {form.spec_table.length}개</p>}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-label">비고 (고객 견적서)</p>
              <p className="whitespace-pre-line text-muted-foreground">{form.remarks || '-'}</p>
              {form.internal_notes && <><p className="pt-1 font-semibold text-label">내부 메모</p><p className="whitespace-pre-line text-muted-foreground">{form.internal_notes}</p></>}
            </div>
          </div>
        </div>

        <DialogFooter className="items-center gap-2">
          {errors > 0 && <span className="mr-auto text-caption text-destructive">확인할 것 {errors}건 — 적용 뒤 견적 화면에서 고칠 수 있습니다</span>}
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={() => onApply(result)}>견적에 채우기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
