import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileUp, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import QuoteLineEditor from '@/components/quotation/QuoteLineEditor';

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백 포장기',
  SLEEVE: '슬리브 라벨러',
  DESKTOP_LABELER: '탁상용 라벨러',
  TUBE_SEALER: '튜브 실링기'
};

export default function AgentQuotes() {
  const { t } = useLanguage();
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState({
    factory_id: '', factory_name: '', machine_category: '',
    line_items: [], incoterms: 'EXW',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isSub = me?.account_tier === 'sub';

  const { data: factories = [] } = useQuery({
    queryKey: ['factories'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }),
  });

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadedUrl(file_url);
    setUploading(false);
    toast({ title: t('common.upload') });
  };

  const handleAIParse = async () => {
    if (!uploadedUrl) return;
    setParsing(true);
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: uploadedUrl,
      json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_name_cn: { type: 'string', description: '품목명 (중문)' },
                item_name_ko: { type: 'string', description: '품목명 (한글 번역)' },
                specification: { type: 'string', description: '사양/규격' },
                quantity: { type: 'number', description: '수량' },
                unit_price_cny: { type: 'number', description: '단가 (CNY)' },
                total_cny: { type: 'number', description: '소계 (CNY)' },
              }
            }
          }
        }
      }
    });
    if (result.status === 'success' && result.output?.items) {
      updateField('line_items', result.output.items);
      toast({ title: t('agentquotes.ai') });
    } else {
      toast({ title: 'AI 파싱 실패', variant: 'destructive' });
    }
    setParsing(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const total = (form.line_items || []).reduce((s, i) => s + (i.total_cny || 0), 0);
      return base44.entities.Quotation.create({
        ...form,
        factory_total_cost: total,
        raw_file_url: uploadedUrl,
        ai_status: uploadedUrl ? 'SUCCESS' : 'PENDING',
        status: 'REVIEW',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setForm({ factory_id: '', factory_name: '', machine_category: '', line_items: [], incoterms: 'EXW' });
      setUploadedUrl('');
      toast({ title: '견적 업로드 완료', description: '본사 검수 대기중' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('agentquotes.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('agentquotes.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('agentquotes.upload.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
              {uploading ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : uploadedUrl ? (
                <CheckCircle className="w-8 h-8 text-accent" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {uploadedUrl ? t('agentquotes.upload.done') : t('agentquotes.upload.hint')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .xlsx, .docx, .pdf, .jpg, .png
                </p>
              </div>
              <input type="file" className="hidden" accept=".xlsx,.docx,.pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
            </label>

            {uploadedUrl && (
              <Button onClick={handleAIParse} disabled={parsing} className="w-full" variant="outline">
                {parsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                {t('agentquotes.ai')}
              </Button>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('agentquotes.factory')}</Label>
                <Select value={form.factory_id} onValueChange={(v) => {
                  const f = factories.find(x => x.id === v);
                  updateField('factory_id', v);
                  updateField('factory_name', f?.company_name || '');
                }}>
                  <SelectTrigger><SelectValue placeholder={t('agentquotes.factory')} /></SelectTrigger>
                  <SelectContent>
                    {factories.map(f => <SelectItem key={f.id} value={f.id}>{f.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('agentquotes.category')}</Label>
                <Select value={form.machine_category} onValueChange={(v) => updateField('machine_category', v)}>
                  <SelectTrigger><SelectValue placeholder={t('agentquotes.category')} /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k]) => (
                      <SelectItem key={k} value={k}>{t(`cat.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Item Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('agentquotes.editor')}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteLineEditor items={form.line_items || []} onChange={(items) => updateField('line_items', items)} />
            </CardContent>
          </Card>
          <div className="flex justify-end items-center gap-3">
            {isSub && <p className="text-xs text-muted-foreground">원가 항목 저장은 팀 관리자 전용입니다.</p>}
            <Button onClick={() => saveMutation.mutate()} disabled={isSub || saveMutation.isPending || !form.factory_id}>
              {saveMutation.isPending ? t('agentquotes.saving') : t('agentquotes.submit')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}