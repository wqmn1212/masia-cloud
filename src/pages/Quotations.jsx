import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, FileText, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import QuoteLineEditor from '@/components/quotation/QuoteLineEditor';
import MarginCalculator from '@/components/quotation/MarginCalculator';
import RiskAlertPopup from '@/components/quotation/RiskAlertPopup';

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백 포장기',
  SLEEVE: '슬리브 라벨러',
  DESKTOP_LABELER: '탁상용 라벨러',
  TUBE_SEALER: '튜브 실링기'
};

const STATUS_MAP = {
  DRAFT: { label: '초안', className: 'bg-muted text-muted-foreground' },
  REVIEW: { label: '검토중', className: 'bg-chart-3/15 text-chart-3' },
  APPROVED: { label: '승인', className: 'bg-accent/15 text-accent' },
  SENT: { label: '발송', className: 'bg-primary/15 text-primary' },
  ACCEPTED: { label: '수락', className: 'bg-accent/15 text-accent' },
  REJECTED: { label: '거절', className: 'bg-destructive/15 text-destructive' },
};

export default function Quotations() {
  const { t } = useLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailQuote, setDetailQuote] = useState(null);
  const [riskAlerts, setRiskAlerts] = useState([]);
  const [showRisk, setShowRisk] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isSub = me?.account_tier === 'sub';

  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 50),
  });
  const { data: factories = [] } = useQuery({
    queryKey: ['factories'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }),
  });
  const { data: qcLogs = [] } = useQuery({
    queryKey: ['qc-logs'],
    queryFn: () => base44.entities.QCKnowledgeLog.list(),
  });

  const [form, setForm] = useState({
    factory_id: '', factory_name: '', client_id: '', client_name: '',
    machine_category: '', incoterms: 'EXW', line_items: [],
    factory_total_cost: 0, logistics_cost: 0,
    masir_fee_type: 'PERCENT', masir_fee_value: 0,
    final_client_price: 0, status: 'DRAFT',
  });

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Calculate final price
  useEffect(() => {
    const base = (form.factory_total_cost || 0) + (form.logistics_cost || 0);
    let final_price;
    if (form.masir_fee_type === 'PERCENT') {
      final_price = base * (1 + (form.masir_fee_value || 0) / 100);
    } else {
      final_price = base + (form.masir_fee_value || 0);
    }
    updateField('final_client_price', Math.round(final_price * 100) / 100);
  }, [form.factory_total_cost, form.logistics_cost, form.masir_fee_type, form.masir_fee_value]);

  // Recalculate factory total from line items
  useEffect(() => {
    const total = (form.line_items || []).reduce((sum, item) => sum + (item.total_cny || 0), 0);
    updateField('factory_total_cost', total);
  }, [form.line_items]);

  // Check risk alerts when category changes
  useEffect(() => {
    if (form.machine_category) {
      const alerts = qcLogs.filter(log => log.target_category === form.machine_category);
      if (alerts.length > 0) {
        setRiskAlerts(alerts);
        setShowRisk(true);
      }
    }
  }, [form.machine_category, qcLogs]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Quotation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setCreateOpen(false);
      toast({ title: t('quotations.add') });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('quotations.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('quotations.subtitle')}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t('quotations.add')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('quotations.form.title')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <Label>{t('quotations.form.factory')}</Label>
                  <Select value={form.factory_id} onValueChange={(v) => {
                    const f = factories.find(x => x.id === v);
                    updateField('factory_id', v);
                    updateField('factory_name', f?.company_name || '');
                  }}>
                    <SelectTrigger><SelectValue placeholder={t('quotations.form.factory')} /></SelectTrigger>
                    <SelectContent>
                      {factories.map(f => <SelectItem key={f.id} value={f.id}>{f.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quotations.form.client')}</Label>
                  <Select value={form.client_id} onValueChange={(v) => {
                    const c = clients.find(x => x.id === v);
                    updateField('client_id', v);
                    updateField('client_name', c?.company_name || '');
                  }}>
                    <SelectTrigger><SelectValue placeholder={t('quotations.form.client')} /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quotations.form.category')}</Label>
                  <Select value={form.machine_category} onValueChange={(v) => updateField('machine_category', v)}>
                    <SelectTrigger><SelectValue placeholder={t('quotations.form.category.placeholder')} /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k]) => (
                        <SelectItem key={k} value={k}>{t(`cat.${k}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <QuoteLineEditor items={form.line_items || []} onChange={(items) => updateField('line_items', items)} />
                </div>
                <div>
                  {isSub ? (
                    <p className="text-xs text-muted-foreground border border-dashed rounded-lg p-4">
                      원가·수수료 및 마진 계산은 팀 관리자 전용입니다.
                    </p>
                  ) : (
                  <MarginCalculator
                    factoryTotal={form.factory_total_cost}
                    logisticsCost={form.logistics_cost}
                    feeType={form.masir_fee_type}
                    feeValue={form.masir_fee_value}
                    onLogisticsChange={(v) => updateField('logistics_cost', v)}
                    onFeeTypeChange={(v) => updateField('masir_fee_type', v)}
                    onFeeValueChange={(v) => updateField('masir_fee_value', v)}
                    finalPrice={form.final_client_price}
                  />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={createMutation.isPending}>{t('quotations.save')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quotation List */}
      <div className="space-y-3">
        {quotations.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="mt-4 text-lg font-semibold">{t('quotations.empty')}</p>
          </Card>
        ) : (
          quotations.map((q) => {
            const st = STATUS_MAP[q.status] || STATUS_MAP.DRAFT;
            return (
              <Card key={q.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailQuote(q)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{q.factory_name || t('quotations.unspecified')} → {q.client_name || t('quotations.unspecified')}</p>
                      <p className="text-xs text-muted-foreground">{q.machine_category ? t(`cat.${q.machine_category}`) : t('quotations.nocat')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={`${st.className} border-0`}>{t(`qstatus.${q.status}`)}</Badge>
                    {q.final_client_price > 0 && (
                      <p className="text-sm font-bold">¥{q.final_client_price?.toLocaleString()}</p>
                    )}
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <RiskAlertPopup alerts={riskAlerts} open={showRisk} onClose={() => setShowRisk(false)} />

      {/* Detail Dialog */}
      {detailQuote && (
        <Dialog open={!!detailQuote} onOpenChange={() => setDetailQuote(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('quotations.detail')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">{t('quotations.detail.factory')}</p><p className="font-semibold">{detailQuote.factory_name}</p></div>
                <div><p className="text-xs text-muted-foreground">{t('quotations.detail.client')}</p><p className="font-semibold">{detailQuote.client_name}</p></div>
                <div><p className="text-xs text-muted-foreground">{t('quotations.detail.category')}</p><p className="font-semibold">{detailQuote.machine_category ? t(`cat.${detailQuote.machine_category}`) : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">{t('quotations.detail.status')}</p><Badge className={`${(STATUS_MAP[detailQuote.status] || STATUS_MAP.DRAFT).className} border-0`}>{t(`qstatus.${detailQuote.status}`)}</Badge></div>
              </div>
              <div className={`grid grid-cols-3 gap-3 ${isSub ? 'hidden' : ''}`}>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">{t('quotations.detail.factorycost')}</p>
                  <p className="text-lg font-bold">¥{(detailQuote.factory_total_cost || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">{t('quotations.detail.logistics')}</p>
                  <p className="text-lg font-bold">¥{(detailQuote.logistics_cost || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <p className="text-xs text-primary">{t('quotations.detail.finalprice')}</p>
                  <p className="text-lg font-bold text-primary">¥{(detailQuote.final_client_price || 0).toLocaleString()}</p>
                </div>
              </div>
              {detailQuote.line_items?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">{t('quotations.detail.items')}</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50">
                        <th className="text-left p-2">{t('quotations.col.item')}</th><th className="text-right p-2">{t('quotations.col.qty')}</th><th className="text-right p-2">{t('quotations.col.unit')}</th><th className="text-right p-2">{t('quotations.col.sub')}</th>
                      </tr></thead>
                      <tbody>
                        {detailQuote.line_items.map((item, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{item.item_name_ko || item.item_name_cn}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">¥{(item.unit_price_cny || 0).toLocaleString()}</td>
                            <td className="p-2 text-right font-medium">¥{(item.total_cny || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}