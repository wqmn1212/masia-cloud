import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, FileText, Trash2, ExternalLink, Pencil, Download, X } from 'lucide-react';
import DropZone from '@/components/ui/drop-zone';
import { generateQuotationPDF } from '@/lib/generateQuotationPDF';
import QuoteOptionsEditor, { optionToUSD } from '@/components/quotation/QuoteOptionsEditor';
import SettlementFields from '@/components/quotation/SettlementFields';
import { INCOTERMS_2020, LEGACY_INCOTERMS } from '@/lib/incoterms';
import LogisticsEstimator from '@/components/quotation/LogisticsEstimator';
import { calcCbm } from '@/lib/logisticsEstimator';
import QuotationHistoryButton from '@/components/quotation/QuotationHistoryButton';
import ManualExchangeRates from '@/components/quotation/ManualExchangeRates';
import CurrencyPanel from '@/components/quotation/CurrencyPanel';
import { calculateQuote, fromUSD, isUsdQuote } from '@/components/quotation/quoteCurrency';

const STATUS_META = {
  DRAFT:    { label: '초안',     color: 'bg-muted text-muted-foreground' },
  REVIEW:   { label: '검토 중',  color: 'bg-chart-3/15 text-chart-3' },
  APPROVED: { label: '승인됨',   color: 'bg-accent/15 text-accent' },
  SENT:     { label: '발송됨',   color: 'bg-chart-4/15 text-chart-4' },
  ACCEPTED: { label: '수주 완료', color: 'bg-primary/15 text-primary' },
  REJECTED: { label: '거절됨',   color: 'bg-destructive/15 text-destructive' },
};

const emptyForm = {
  factory_name: '',
  incoterms: 'EXW',
  settlement_route: 'CLIENT_TO_AEGIS',
  quote_issuer: 'AEGIS',
  quote_title: '',
  product_name: '',
  model_name: '',
  quote_options: [],
  final_currency: 'USD',
  factory_total_cost: '',
  factory_cost_currency: 'CNY',
  logistics_cost: '',
  logistics_cost_currency: 'CNY',
  masir_fee_type: 'PERCENT',
  masir_fee_value: '',
  exchange_rate_date: '',
  exchange_rate_usd: '',
  exchange_rate_usd_cny: '',
  exchange_rate_krw: '',
  remarks: '',
  advance_payment_percent: '30',
  balance_payment_percent: '70',
  shipping_days: '',
  product_image_url: '',
  status: 'DRAFT',
  raw_file_url: '',
  cargo_length_cm: '',
  cargo_width_cm: '',
  cargo_height_cm: '',
  cargo_weight_kg: '',
  cargo_quantity: 1,
  shipping_mode: 'SEA_LCL',
  shipping_term: 'FOB',
  logistics_estimated_usd: '',
  logistics_estimate_lines: [],
};

export default function QuotationTab({ card, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, factory_name: card.factory_name || '', client_name: card.client_name || '' });
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canEditIssuer = ['master', 'service', 'sub'].includes(user?.account_tier);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations-by-card', card.id],
    queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, factory_name: card.factory_name || '', client_name: card.client_name || '' });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Quotation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations-by-card', card.id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      resetForm();
      toast({ title: '견적 등록 완료 — 견적관리에서도 확인하세요' });
    },
    onError: (err) => toast({ title: '견적 등록 실패', description: err?.message || '다시 시도해주세요', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Quotation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations-by-card', card.id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['card-quotations-publish', card.id] });
      resetForm();
      toast({ title: '견적 수정 완료' });
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['quotations-by-card', card.id] });
      toast({ title: '견적 수정 실패', description: err?.response?.data?.error || err?.message || '다시 시도해주세요', variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Quotation.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations-by-card', card.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quotation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations-by-card', card.id] }),
  });

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, raw_file_url: file_url }));
    setUploading(false);

    // AI 파싱 — 견적 항목(옵션명/사양/수량/단가/통화)까지 자동 추출
    setParsing(true);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let result = null;
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      // 엑셀: 백엔드에서 시트 내용을 텍스트로 변환 후 AI 추출 (정확도 높음)
      const res = await base44.functions.invoke('parseQuotationExcel', { file_url });
      result = res.data?.data || null;
    } else {
      // PDF/이미지: 비전 AI로 직접 추출
      result = await base44.integrations.Core.InvokeLLM({
        prompt: '첨부된 견적서에서 공장/발행처 회사명, 제품명, 모델명, 인코텀즈, 물류비, 그리고 모든 개별 견적 항목(품목명 원문 그대로, 사양/규격, 수량, 단가 숫자, 통화 — ¥/元/RMB는 CNY, $는 USD, ₩는 KRW)을 추출하세요. 합계/총계 행은 항목에 포함하지 마세요. 실제 파일에 있는 내용만 추출하세요.',
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            factory_name: { type: 'string' },
            product_name: { type: 'string' },
            model_name: { type: 'string' },
            incoterms: { type: 'string' },
            logistics_cost: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  option_name: { type: 'string' },
                  specification: { type: 'string' },
                  quantity: { type: 'number' },
                  unit_price: { type: 'number' },
                  currency: { type: 'string', enum: ['USD', 'CNY', 'KRW'] },
                },
              },
            },
          },
        },
      });
    }
    if (result) {
      const items = (result.items || [])
        .filter(it => it.option_name || it.unit_price)
        .map(it => ({
          option_name: it.option_name || '',
          specification: it.specification || '',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          currency: ['USD', 'CNY', 'KRW'].includes(it.currency) ? it.currency : 'CNY',
          margin_percent: 0,
        }));
      setForm(f => ({
        ...f,
        factory_name: result.factory_name || f.factory_name,
        product_name: result.product_name || f.product_name,
        model_name: result.model_name || f.model_name,
        logistics_cost: result.logistics_cost || f.logistics_cost,
        incoterms: ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'].includes(result.incoterms) ? result.incoterms : f.incoterms,
        quote_options: items.length > 0 ? items : f.quote_options,
      }));
      if (items.length > 0) toast({ title: `견적 항목 ${items.length}개 자동 입력 완료`, description: '옵션명·사양·수량·단가·통화를 확인 후 필요 시 수정하세요.' });
    } else {
      toast({ title: '자동 추출 실패', description: '파일 내용을 인식하지 못했습니다. 직접 입력해주세요.', variant: 'destructive' });
    }
    setParsing(false);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, product_image_url: file_url }));
    setUploadingImage(false);
  };

  const quoteCalc = useMemo(() => calculateQuote(form), [form]);
  const { factoryCNY, logisticsCNY, optionBaseUSD: optionsTotalUSD, optionMarginUSD: optionsMarginUSD, baseUSD, feeUSD, totalUSD } = quoteCalc;

  const handleSubmit = (e) => {
    e.preventDefault();
    const usdR = Number(form.exchange_rate_usd) || 0;
    const cnyR = Number(form.exchange_rate_usd_cny) || 0;
    const normalizedOptions = (form.quote_options || [])
      .filter(o => o.option_name || o.unit_price)
      .map(o => ({
        option_name: o.option_name || '',
        specification: o.specification || '',
        quantity: Number(o.quantity) || 0,
        unit_price: Number(o.unit_price) || 0,
        currency: o.currency || 'CNY',
        margin_percent: Number(o.margin_percent) || 0,
        total_usd: (Number(o.quantity) || 0) * optionToUSD(o.unit_price, o.currency, usdR, cnyR),
      }));
    const optTotalUSD = normalizedOptions.reduce((s, o) => s + o.total_usd, 0);
    const optMarginUSD = normalizedOptions.reduce((s, o) => s + o.total_usd * (o.margin_percent || 0) / 100, 0);
    const payload = {
      ...form,
      quote_options: normalizedOptions,
      options_total_usd: optTotalUSD,
      final_price_usd: totalUSD,
      remarks: form.remarks || '',
      advance_payment_percent: Number(form.advance_payment_percent) || 0,
      balance_payment_percent: Number(form.balance_payment_percent) || 0,
      shipping_days: Number(form.shipping_days) || 0,
      product_image_url: form.product_image_url || '',
      card_id: card.id,
      tenant_id: user?.tenant_id || card.tenant_id,
      client_name: card.client_name || form.client_name,
      machine_category: card.target_machine_category,
      factory_total_cost: factoryCNY,
      factory_cost_currency: form.factory_cost_currency || 'CNY',
      logistics_cost: logisticsCNY,
      logistics_cost_currency: form.logistics_cost_currency || 'CNY',
      masir_fee_value: Number(form.masir_fee_value) || 0,
      masir_fee_amount_cny: feeUSD * cnyR,
      final_client_price: totalUSD,
      final_currency: 'USD',
      exchange_rate_date: form.exchange_rate_date,
      exchange_rate_usd: usdR,
      exchange_rate_usd_cny: cnyR,
      exchange_rate_krw: Number(form.exchange_rate_krw) || 0,
      cargo_length_cm: Number(form.cargo_length_cm) || 0,
      cargo_width_cm: Number(form.cargo_width_cm) || 0,
      cargo_height_cm: Number(form.cargo_height_cm) || 0,
      cargo_weight_kg: Number(form.cargo_weight_kg) || 0,
      cargo_quantity: Number(form.cargo_quantity) || 1,
      cargo_cbm: calcCbm({
        lengthCm: form.cargo_length_cm,
        widthCm: form.cargo_width_cm,
        heightCm: form.cargo_height_cm,
        quantity: form.cargo_quantity || 1,
      }),
      shipping_mode: form.shipping_mode || 'SEA_LCL',
      shipping_term: form.shipping_term || 'FOB',
      logistics_estimated_usd: Number(form.logistics_estimated_usd) || 0,
      logistics_estimate_lines: form.logistics_estimate_lines || [],
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (q) => {
    const fCur = q.factory_cost_currency || 'CNY';
    const lCur = q.logistics_cost_currency || 'CNY';
    const usdR = Number(q.exchange_rate_usd) || 0;
    const cnyR = Number(q.exchange_rate_usd_cny) || 0;
    const fDisp = q.factory_total_cost != null ? (fCur === 'CNY' || !cnyR ? q.factory_total_cost : fromUSD(q.factory_total_cost / cnyR, fCur, usdR, cnyR)) : '';
    const lDisp = q.logistics_cost != null ? (lCur === 'CNY' || !cnyR ? q.logistics_cost : fromUSD(q.logistics_cost / cnyR, lCur, usdR, cnyR)) : '';
    setEditingId(q.id);
    updateMutation.reset();
    setForm({
      factory_name: q.factory_name || '',
      incoterms: q.incoterms || 'EXW',
      settlement_route: q.settlement_route || 'CLIENT_TO_AEGIS',
      quote_issuer: q.quote_issuer || 'AEGIS',
      quote_title: q.quote_title || '',
      product_name: q.product_name || '',
      model_name: q.model_name || '',
      quote_options: (q.quote_options || []).map(o => (
        o.unit_price == null && o.unit_price_usd != null
          ? { ...o, unit_price: o.unit_price_usd, currency: 'USD' }
          : o
      )),
      final_currency: q.exchange_rate_usd_cny ? 'USD' : (q.final_currency || 'CNY'),
      factory_total_cost: fDisp === 0 ? '' : fDisp,
      factory_cost_currency: fCur,
      logistics_cost: lDisp === 0 ? '' : lDisp,
      logistics_cost_currency: lCur,
      masir_fee_type: q.masir_fee_type || 'PERCENT',
      masir_fee_value: q.masir_fee_value ?? '',
      exchange_rate_date: q.exchange_rate_date || '',
      exchange_rate_usd: q.exchange_rate_usd || '',
      exchange_rate_usd_cny: q.exchange_rate_usd_cny || '',
      exchange_rate_krw: q.exchange_rate_krw || '',
      remarks: q.remarks || '',
      advance_payment_percent: q.advance_payment_percent ?? '30',
      balance_payment_percent: q.balance_payment_percent ?? '70',
      shipping_days: q.shipping_days || '',
      product_image_url: q.product_image_url || '',
      status: q.status || 'DRAFT',
      raw_file_url: q.raw_file_url || '',
      cargo_length_cm: q.cargo_length_cm || '',
      cargo_width_cm: q.cargo_width_cm || '',
      cargo_height_cm: q.cargo_height_cm || '',
      cargo_weight_kg: q.cargo_weight_kg || '',
      cargo_quantity: q.cargo_quantity || 1,
      shipping_mode: q.shipping_mode || 'SEA_LCL',
      shipping_term: q.shipping_term || 'FOB',
      logistics_estimated_usd: q.logistics_estimated_usd || '',
      logistics_estimate_lines: q.logistics_estimate_lines || [],
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">이 카드에 연결된 견적서 — 등록 즉시 견적관리 페이지와 동기화됩니다</p>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}>
          <Plus className="w-3 h-3" />{editingId ? '수정 중' : '견적 추가'}
        </Button>
      </div>

      {/* 견적 추가 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-xl p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold">{editingId ? '견적 수정' : '신규 견적 등록'}</p>
          {editingId && updateMutation.isError && <p role="alert" className="text-xs text-destructive">{updateMutation.error?.response?.data?.error || '수정 저장에 실패했습니다. 다시 시도해주세요.'}</p>}

          {/* 파일 업로드 */}
          <div>
            <Label className="text-xs">견적서 파일 업로드 (선택 — AI 자동 추출)</Label>
            <div className="flex gap-2 mt-1">
              <DropZone
                onFile={handleFileUpload}
                uploading={uploading || parsing}
                accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                compact
                label={parsing ? 'AI 분석 중...' : '파일 선택'}
              />
              {form.raw_file_url && <span className="text-[10px] text-accent self-center">✓ 업로드 완료</span>}
            </div>
          </div>

          <div>
            <Label className="text-xs">견적서 제목</Label>
            <Input value={form.quote_title} onChange={e => setForm(f => ({ ...f, quote_title: e.target.value }))} placeholder="예: 드립백 포장기 공급 견적" className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">제품명</Label>
              <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="예: 드립백 포장기" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">모델명</Label>
              <Input value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} placeholder="예: DBM-5000" className="h-8 text-xs" />
            </div>
          </div>

          {/* 옵션 / 세부 항목 (CNY/RMB 기준) */}
          <div className="border rounded-xl p-3 bg-background">
            <QuoteOptionsEditor
              options={form.quote_options}
              onChange={(opts) => setForm(f => ({ ...f, quote_options: opts }))}
              usdToKrw={Number(form.exchange_rate_usd) || 0}
              usdToCny={Number(form.exchange_rate_usd_cny) || 0}
            />
            <div className="mt-3"><ManualExchangeRates compact values={form} onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))} /></div>
          </div>

          <div className="rounded-lg border bg-primary/5 px-3 py-2"><p className="text-xs font-semibold text-primary">거래 및 PDF 기준 통화: USD</p><p className="text-[10px] text-muted-foreground">CNY 공장 원가는 직접 USD/CNY 환율로 환산되며 KRW는 참고가로만 표시됩니다.</p></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">공장명 *</Label>
              <Input value={form.factory_name} onChange={e => setForm(f => ({ ...f, factory_name: e.target.value }))} placeholder="공장명" required className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">인코텀즈</Label>
              <Select value={form.incoterms} onValueChange={v => setForm(f => ({ ...f, incoterms: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">모든 운송 수단 (Incoterms 2020)</div>
                  {INCOTERMS_2020.filter(t => t.group === '모든 운송 수단').map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">해상 운송 전용</div>
                  {INCOTERMS_2020.filter(t => t.group === '해상 운송 전용').map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">항구 지정 (레거시)</div>
                  {LEGACY_INCOTERMS.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SettlementFields
            settlementRoute={form.settlement_route}
            quoteIssuer={form.quote_issuer}
            onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
            canEditIssuer={canEditIssuer}
            compact
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">공장 원가 {optionsTotalUSD > 0 && <span className="text-[10px] text-primary font-semibold">(옵션 합산 자동 반영)</span>}</Label>
              {optionsTotalUSD > 0 ? (
                <div className="h-8 flex items-center px-3 rounded-md border bg-muted/40 text-xs font-semibold">
                  ${optionsTotalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-muted-foreground font-normal ml-2">≈ ¥{Math.round(factoryCNY).toLocaleString()}</span>
                </div>
              ) : (
              <>
              <div className="flex gap-1">
                <Input type="number" value={form.factory_total_cost} onChange={e => setForm(f => ({ ...f, factory_total_cost: e.target.value }))} className="h-8 text-xs flex-1" placeholder={form.factory_cost_currency === 'KRW' ? '₩' : form.factory_cost_currency === 'USD' ? '$' : '¥'} />
                <Select value={form.factory_cost_currency} onValueChange={v => setForm(f => ({ ...f, factory_cost_currency: v }))}>
                  <SelectTrigger className="h-8 w-[78px] text-xs px-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNY" className="text-xs">¥ CNY</SelectItem>
                    <SelectItem value="USD" className="text-xs">$ USD</SelectItem>
                    <SelectItem value="KRW" className="text-xs">₩ KRW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.factory_cost_currency !== 'CNY' && factoryCNY > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">≈ ¥{Math.round(factoryCNY).toLocaleString()} CNY</p>
              )}
              </>
              )}
            </div>
            <div>
              <Label className="text-xs">물류비</Label>
              <div className="flex gap-1">
                <Input type="number" value={form.logistics_cost} onChange={e => setForm(f => ({ ...f, logistics_cost: e.target.value }))} className="h-8 text-xs flex-1" placeholder={form.logistics_cost_currency === 'KRW' ? '₩' : form.logistics_cost_currency === 'USD' ? '$' : '¥'} />
                <Select value={form.logistics_cost_currency} onValueChange={v => setForm(f => ({ ...f, logistics_cost_currency: v }))}>
                  <SelectTrigger className="h-8 w-[78px] text-xs px-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNY" className="text-xs">¥ CNY</SelectItem>
                    <SelectItem value="USD" className="text-xs">$ USD</SelectItem>
                    <SelectItem value="KRW" className="text-xs">₩ KRW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.logistics_cost_currency !== 'CNY' && logisticsCNY > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">≈ ¥{Math.round(logisticsCNY).toLocaleString()} CNY</p>
              )}
            </div>
          </div>

          {/* 부피·중량 기반 물류비 자동 추정 */}
          <LogisticsEstimator
            cargo={form}
            onCargoChange={(next) => setForm(next)}
            cargoValueUsd={optionsTotalUSD}
            onApply={(usdTotal, result) => {
              setForm(f => ({
                ...f,
                logistics_cost: usdTotal,
                logistics_cost_currency: 'USD',
                logistics_estimated_usd: usdTotal,
                logistics_estimate_lines: result.lines.map(l => ({ label: l.label, amount: l.amount })),
              }));
              toast({ title: `물류비 $${usdTotal.toLocaleString()} 적용 완료`, description: `${result.cbm} CBM · 과금중량 ${result.chargeableKg}kg 기준 근사치` });
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">마시아 수수료 유형</Label>
              <Select value={form.masir_fee_type} onValueChange={v => setForm(f => ({ ...f, masir_fee_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">% (원가+물류비 기준)</SelectItem>
                  <SelectItem value="FIXED">고정 (USD $)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">수수료 {form.masir_fee_type === 'PERCENT' ? '(%)' : '(USD $)'}</Label>
              <Input type="number" value={form.masir_fee_value} onChange={e => setForm(f => ({ ...f, masir_fee_value: e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">선금 (%)</Label>
              <Input type="number" min="0" max="100" value={form.advance_payment_percent} onChange={e => setForm(f => ({ ...f, advance_payment_percent: e.target.value }))} className="h-8 text-xs" placeholder="예: 30" />
            </div>
            <div>
              <Label className="text-xs">잔금 (%)</Label>
              <Input type="number" min="0" max="100" value={form.balance_payment_percent} onChange={e => setForm(f => ({ ...f, balance_payment_percent: e.target.value }))} className="h-8 text-xs" placeholder="예: 70" />
            </div>
            <div>
              <Label className="text-xs">출하일 (발주 후 일)</Label>
              <Input type="number" min="0" value={form.shipping_days} onChange={e => setForm(f => ({ ...f, shipping_days: e.target.value }))} className="h-8 text-xs" placeholder="예: 45" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">제품 사진 (PDF에 표시)</Label>
              <div className="flex items-center gap-2 mt-1">
                <DropZone onFile={handleImageUpload} uploading={uploadingImage} accept="image/*" compact label="사진 업로드" />
                {form.product_image_url && (
                  <div className="relative">
                    <img src={form.product_image_url} alt="제품 사진" className="h-12 w-12 object-cover rounded-md border" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, product_image_url: '' }))}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                      title="사진 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">비고 (PDF에 표시)</Label>
              <Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} className="text-xs" placeholder="특이사항, 포함/불포함 내역 등" />
            </div>
          </div>

          {/* 자동 계산 요약 */}
          {(baseUSD > 0 || feeUSD > 0 || optionsMarginUSD > 0) && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">고객 제안가 자동 계산 (USD 거래 기준)</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center"><p className="text-muted-foreground text-[10px]">원가 + 물류</p><p className="font-semibold">${baseUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                <div className="text-center"><p className="text-muted-foreground text-[10px]">항목별 마진</p><p className="font-semibold text-accent">${optionsMarginUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                <div className="text-center"><p className="text-muted-foreground text-[10px]">수수료</p><p className="font-semibold text-accent">${feeUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                <div className="text-center"><p className="text-muted-foreground text-[10px]">최종 거래가</p><p className="font-bold text-primary">${totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
              </div>
              <CurrencyPanel usd={totalUSD} usdToCny={Number(form.exchange_rate_usd_cny)} usdToKrw={Number(form.exchange_rate_usd)} />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={resetForm}>취소</Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={createMutation.isPending || updateMutation.isPending}>{editingId ? '수정 저장' : '등록'}</Button>
          </div>
        </form>
      )}

      {/* 견적 리스트 */}
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />)}</div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
          <FileText className="w-8 h-8 opacity-30" />
          <p className="text-sm">등록된 견적이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map(q => {
            const st = STATUS_META[q.status] || STATUS_META.DRAFT;
            return (
              <div key={q.id} className="border rounded-xl p-3 space-y-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{q.quote_title || q.factory_name}</span>
                    {q.product_name && <span className="text-[11px] text-muted-foreground">{q.product_name}{q.model_name ? ` · ${q.model_name}` : ''}</span>}
                    {q.incoterms && <Badge variant="outline" className="text-[9px] h-4 px-1">{q.incoterms.replace('_', ' ')}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={q.status} onValueChange={v => updateStatusMutation.mutate({ id: q.id, status: v })}>
                      <SelectTrigger className={`h-6 text-[10px] border-0 px-2 ${st.color} w-auto min-w-[80px]`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => generateQuotationPDF(q)}
                      className="text-muted-foreground hover:text-primary p-1"
                      title="공식 견적서 PDF 다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canEditIssuer && <QuotationHistoryButton quotation={q} />}
                    <button onClick={() => handleEdit(q)} className="text-muted-foreground hover:text-primary p-1" title="수정">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(q.id)} className="text-muted-foreground hover:text-destructive p-1" title="삭제">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {q.options_total_usd > 0 && (
                      <span>옵션 합계: <strong className="text-primary">${q.options_total_usd.toLocaleString()}</strong>
                      {q.exchange_rate_usd > 0 && <span className="opacity-70"> (≈₩{Math.round(q.options_total_usd * q.exchange_rate_usd).toLocaleString()})</span>}</span>
                    )}
                    {q.factory_total_cost > 0 && <span>원가: <strong className="text-foreground">¥{q.factory_total_cost?.toLocaleString()}</strong></span>}
                    {q.logistics_cost > 0 && <span>물류비: <strong className="text-foreground">¥{q.logistics_cost?.toLocaleString()}</strong></span>}
                    {q.masir_fee_amount_cny > 0 && <span>수수료: <strong className="text-accent">¥{q.masir_fee_amount_cny?.toLocaleString()} {q.masir_fee_type === 'PERCENT' ? `(${q.masir_fee_value}%)` : '(고정)'}</strong></span>}
                  </div>
                  {q.final_client_price > 0 && (isUsdQuote(q)
                    ? <CurrencyPanel usd={q.final_client_price} usdToCny={q.exchange_rate_usd_cny} usdToKrw={q.exchange_rate_usd} />
                    : <CurrencyPanel legacyCny={q.final_client_price} usdToKrw={q.exchange_rate_usd} legacyCnyToKrw={q.exchange_rate_krw} />
                  )}
                </div>
                {q.raw_file_url && (
                  <a href={q.raw_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />원본 파일 보기
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}