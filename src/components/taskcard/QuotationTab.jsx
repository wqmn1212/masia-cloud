import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, FileText, Trash2, Upload, Loader2, ExternalLink } from 'lucide-react';

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
  factory_total_cost: '',
  logistics_cost: '',
  masir_fee_type: 'PERCENT',
  masir_fee_value: '',
  final_client_price: '',
  status: 'DRAFT',
  raw_file_url: '',
};

export default function QuotationTab({ card, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, factory_name: card.factory_name || '', client_name: card.client_name || '' });
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations-by-card', card.id],
    queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Quotation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations-by-card', card.id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setShowForm(false);
      setForm({ ...emptyForm, factory_name: card.factory_name || '', client_name: card.client_name || '' });
      toast({ title: '견적 등록 완료 — 견적관리에서도 확인하세요' });
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, raw_file_url: file_url }));
    setUploading(false);

    // AI 파싱
    setParsing(true);
    const schema = {
      type: 'object',
      properties: {
        factory_name: { type: 'string' },
        factory_total_cost: { type: 'number' },
        logistics_cost: { type: 'number' },
        final_client_price: { type: 'number' },
        incoterms: { type: 'string' },
      },
    };
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `아래 견적서 파일에서 공장명, 총비용(CNY), 물류비(CNY), 고객 제안가, 인코텀즈를 추출하세요.`,
      file_urls: [file_url],
      response_json_schema: schema,
    });
    if (result) {
      setForm(f => ({
        ...f,
        factory_name: result.factory_name || f.factory_name,
        factory_total_cost: result.factory_total_cost || f.factory_total_cost,
        logistics_cost: result.logistics_cost || f.logistics_cost,
        final_client_price: result.final_client_price || f.final_client_price,
        incoterms: result.incoterms || f.incoterms,
      }));
    }
    setParsing(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      card_id: card.id,
      client_name: card.client_name || form.client_name,
      machine_category: card.target_machine_category,
      factory_total_cost: Number(form.factory_total_cost) || 0,
      logistics_cost: Number(form.logistics_cost) || 0,
      masir_fee_value: Number(form.masir_fee_value) || 0,
      final_client_price: Number(form.final_client_price) || 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">이 카드에 연결된 견적서 — 등록 즉시 견적관리 페이지와 동기화됩니다</p>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3 h-3" />견적 추가
        </Button>
      </div>

      {/* 견적 추가 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-xl p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold">신규 견적 등록</p>

          {/* 파일 업로드 */}
          <div>
            <Label className="text-xs">견적서 파일 업로드 (선택 — AI 자동 추출)</Label>
            <div className="flex gap-2 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {uploading ? '업로드 중...' : parsing ? 'AI 분석 중...' : '파일 선택'}
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" />
              </label>
              {form.raw_file_url && <span className="text-[10px] text-accent self-center">✓ 업로드 완료</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">공장명 *</Label>
              <Input value={form.factory_name} onChange={e => setForm(f => ({ ...f, factory_name: e.target.value }))} placeholder="공장명" required className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">인코텀즈</Label>
              <Select value={form.incoterms} onValueChange={v => setForm(f => ({ ...f, incoterms: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['EXW', 'FOB_SHANGHAI', 'FOB_GUANGZHOU', 'CIF'].map(v => <SelectItem key={v} value={v}>{v.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">공장 원가 (CNY)</Label>
              <Input type="number" value={form.factory_total_cost} onChange={e => setForm(f => ({ ...f, factory_total_cost: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">물류비 (CNY)</Label>
              <Input type="number" value={form.logistics_cost} onChange={e => setForm(f => ({ ...f, logistics_cost: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">고객 제안가 (CNY)</Label>
              <Input type="number" value={form.final_client_price} onChange={e => setForm(f => ({ ...f, final_client_price: e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">마시아 수수료 유형</Label>
              <Select value={form.masir_fee_type} onValueChange={v => setForm(f => ({ ...f, masir_fee_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">%</SelectItem>
                  <SelectItem value="FIXED">고정 (CNY)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">수수료 값</Label>
              <Input type="number" value={form.masir_fee_value} onChange={e => setForm(f => ({ ...f, masir_fee_value: e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>취소</Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={createMutation.isPending}>등록</Button>
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
            const margin = q.final_client_price && q.factory_total_cost
              ? ((q.final_client_price - q.factory_total_cost - (q.logistics_cost || 0)) / q.final_client_price * 100).toFixed(1)
              : null;
            return (
              <div key={q.id} className="border rounded-xl p-3 space-y-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{q.factory_name}</span>
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
                    <button onClick={() => deleteMutation.mutate(q.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-[11px] text-muted-foreground">
                  {q.factory_total_cost > 0 && <span>공장원가: <strong className="text-foreground">¥{q.factory_total_cost?.toLocaleString()}</strong></span>}
                  {q.final_client_price > 0 && <span>제안가: <strong className="text-foreground">¥{q.final_client_price?.toLocaleString()}</strong></span>}
                  {margin && <span>마진율: <strong className="text-accent">{margin}%</strong></span>}
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