import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, FilePlus, Wand2, Download, Send, Lock, AlertTriangle, ShieldPlus } from 'lucide-react';
import { CONTRACT_TYPES, hasEsignClause } from '@/lib/esignContracts';

const STATUS_LABELS = { DRAFT: '초안', REVIEW: '검토', SENT: '서명 대기', SIGNED: '체결', CANCELLED: '취소' };
// 직원이 고를 수 있는 상태. 서명 대기·체결은 전자서명 기록으로만 바뀐다 (종이 계약은 '종이 계약 체결'로)
const MANUAL_STATUS = ['DRAFT', 'REVIEW', 'CANCELLED'];
const NONE = '__none__';

export default function ContractEditor({
  form, onChange, quotations, companies = [], cards = [], agreements = [], onApplyQuotation, onSave, onReset, onGenerate, onExportPDF,
  onInsertEsign, onRequestSign, onOfflineSigned, isPending, isExporting, bodyRef,
}) {
  const locked = ['SENT', 'SIGNED'].includes(form.status);
  const tripartite = form.contract_type === 'TRIPARTITE';
  const clientCards = cards.filter((c) => !form.client_id || c.client_id === form.client_id);
  const clientAgreements = agreements.filter((a) => !form.client_id || a.company_id === form.client_id);
  const esignOk = hasEsignClause(form.body);
  const canRequest = !!form.id && !locked && !tripartite && form.status !== 'CANCELLED' && !!form.client_id;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">계약서 작성</p>
          <Button variant="ghost" size="sm" onClick={onReset}><FilePlus className="w-3.5 h-3.5 mr-1" />새 계약서</Button>
        </div>
        {locked && (
          <p className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs"><Lock className="h-3.5 w-3.5" />{form.status === 'SENT' ? '서명 대기 중에는 본문을 고칠 수 없습니다. 고치려면 아래 전자서명에서 회수한 뒤 새 버전으로 보내세요.' : '체결된 계약서입니다. 바꿔야 하면 변경 계약서를 새로 만드세요.'}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>계약 종류</Label>
            <Select value={form.contract_type || 'SUPPLY'} onValueChange={(v) => onChange('contract_type', v)} disabled={locked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CONTRACT_TYPES).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>고객사 (서명자를 고를 때 씀)</Label>
            <Select value={form.client_id || NONE} onValueChange={(v) => onChange('client_id', v === NONE ? '' : v)} disabled={locked}>
              <SelectTrigger><SelectValue placeholder="고객사 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>선택 안 함</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.contract_type === 'SERVICE' ? (
            <div className="md:col-span-2">
              <Label>월 구독 계약</Label>
              <Select value={form.service_agreement_id || NONE} onValueChange={(v) => onChange('service_agreement_id', v === NONE ? '' : v)} disabled={locked}>
                <SelectTrigger><SelectValue placeholder="구독 계약 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>선택 안 함</SelectItem>
                  {clientAgreements.map((a) => <SelectItem key={a.id} value={a.id}>{a.agreement_no || ''} {a.title || ''} · {a.start_date}~{a.end_date}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div>
                <Label>기반 견적서</Label>
                <Select value={form.quotation_id || ''} onValueChange={onApplyQuotation} disabled={locked}>
                  <SelectTrigger><SelectValue placeholder="견적서 선택 (선택 사항)" /></SelectTrigger>
                  <SelectContent>
                    {quotations.map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        Q-{q.id.slice(-8).toUpperCase()} · {(q.quote_title || q.product_name || '무제')} · {q.client_name || '-'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>프로젝트 카드</Label>
                <Select value={form.card_id || NONE} onValueChange={(v) => onChange('card_id', v === NONE ? '' : v)} disabled={locked}>
                  <SelectTrigger><SelectValue placeholder="카드 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택 안 함</SelectItem>
                    {clientCards.slice(0, 200).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        {tripartite && <p className="flex items-start gap-1.5 text-xs text-chart-3"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />공장이 당사자인 3자 계약은 전자서명 2단계부터 지원합니다. 지금은 PDF 로 내려받아 진행해 주세요.</p>}
        <Button variant="secondary" className="w-full" onClick={onGenerate} disabled={locked || (form.contract_type === 'SERVICE' ? !form.service_agreement_id : !form.quotation_id)}>
          <Wand2 className="w-4 h-4 mr-2" />{form.contract_type === 'SERVICE' ? '구독 계약으로 계약서 초안 생성' : form.contract_type === 'TRIPARTITE' ? '견적서로 3자 계약서 초안 생성' : '견적서로 공급 계약서 초안 생성'}
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>계약서 제목</Label>
            <Input value={form.contract_title} disabled={locked} onChange={(e) => onChange('contract_title', e.target.value)} />
          </div>
          <div>
            <Label>고객사명 (문서 표기)</Label>
            <Input value={form.client_name} disabled={locked} onChange={(e) => onChange('client_name', e.target.value)} />
          </div>
          <div>
            <Label>계약 체결일</Label>
            <Input type="date" value={form.contract_date} disabled={locked} onChange={(e) => onChange('contract_date', e.target.value)} />
          </div>
          <div>
            <Label>계약 금액 (USD)</Label>
            <Input type="number" value={form.amount_usd} disabled={locked} onChange={(e) => onChange('amount_usd', e.target.value)} />
          </div>
          <div>
            <Label>상태</Label>
            {locked ? (
              <Input value={STATUS_LABELS[form.status]} disabled />
            ) : (
              <Select value={form.status} onValueChange={(v) => onChange('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_STATUS.map((k) => <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label>계약서 본문 / 특약 사항</Label>
            {!locked && !tripartite && (esignOk
              ? <span className="text-[11px] text-muted-foreground">전자서명 조항 있음</span>
              : <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-chart-3" onClick={onInsertEsign} disabled={!form.body}><ShieldPlus className="h-3 w-3" />전자서명 조항 넣기</Button>)}
          </div>
          <Textarea
            ref={bodyRef}
            value={form.body}
            onChange={(e) => onChange('body', e.target.value)}
            readOnly={locked}
            rows={18}
            placeholder="오른쪽 조항 라이브러리에서 조항을 선택해 삽입하거나 직접 작성하세요."
            className="font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={onSave} disabled={isPending || !form.contract_title || locked}>
            <Save className="w-4 h-4 mr-2" />계약서 저장
          </Button>
          <Button variant="outline" onClick={onExportPDF} disabled={isExporting || !form.body}>
            <Download className="w-4 h-4 mr-2" />PDF 저장
          </Button>
          {!tripartite && (
            <Button variant="default" onClick={onRequestSign} disabled={!canRequest} title={!form.id ? '먼저 저장하세요' : !form.client_id ? '고객사를 연결하세요' : ''}>
              <Send className="w-4 h-4 mr-2" />서명 요청
            </Button>
          )}
        </div>
        {!locked && form.id && form.status !== 'CANCELLED' && (
          <button type="button" className="text-[11px] text-muted-foreground underline" onClick={onOfflineSigned}>종이로 서명받은 계약서 (스캔본 올리고 체결로 표시)</button>
        )}
      </CardContent>
    </Card>
  );
}

export { STATUS_LABELS };
