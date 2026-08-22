import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, FilePlus, Wand2, Download } from 'lucide-react';

const STATUS_LABELS = { DRAFT: '초안', REVIEW: '검토', SENT: '발송', SIGNED: '체결', CANCELLED: '취소' };

export default function ContractEditor({ form, onChange, quotations, onApplyQuotation, onSave, onReset, onGenerate, onExportPDF, isPending, isExporting, bodyRef }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">계약서 작성</p>
          <Button variant="ghost" size="sm" onClick={onReset}><FilePlus className="w-3.5 h-3.5 mr-1" />새 계약서</Button>
        </div>

        <div>
          <Label>기반 견적서</Label>
          <Select value={form.quotation_id || ''} onValueChange={onApplyQuotation}>
            <SelectTrigger><SelectValue placeholder="견적서 선택 (선택 사항)" /></SelectTrigger>
            <SelectContent>
              {quotations.map(q => (
                <SelectItem key={q.id} value={q.id}>
                  Q-{q.id.slice(-8).toUpperCase()} · {(q.quote_title || q.product_name || '무제')} · {q.client_name || '-'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            className="w-full mt-2"
            onClick={onGenerate}
            disabled={!form.quotation_id}
          >
            <Wand2 className="w-4 h-4 mr-2" />견적서로 표준 계약서 초안 생성
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>계약서 제목</Label>
            <Input value={form.contract_title} onChange={(e) => onChange('contract_title', e.target.value)} />
          </div>
          <div>
            <Label>고객사</Label>
            <Input value={form.client_name} onChange={(e) => onChange('client_name', e.target.value)} />
          </div>
          <div>
            <Label>계약 체결일</Label>
            <Input type="date" value={form.contract_date} onChange={(e) => onChange('contract_date', e.target.value)} />
          </div>
          <div>
            <Label>계약 금액 (USD)</Label>
            <Input type="number" value={form.amount_usd} onChange={(e) => onChange('amount_usd', e.target.value)} />
          </div>
          <div>
            <Label>상태</Label>
            <Select value={form.status} onValueChange={(v) => onChange('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>계약서 본문 / 특약 사항</Label>
          <Textarea
            ref={bodyRef}
            value={form.body}
            onChange={(e) => onChange('body', e.target.value)}
            rows={18}
            placeholder="오른쪽 조항 라이브러리에서 조항을 선택해 삽입하거나 직접 작성하세요."
            className="font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={onSave} disabled={isPending || !form.contract_title}>
            <Save className="w-4 h-4 mr-2" />계약서 저장
          </Button>
          <Button variant="outline" onClick={onExportPDF} disabled={isExporting || !form.body}>
            <Download className="w-4 h-4 mr-2" />PDF 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { STATUS_LABELS };