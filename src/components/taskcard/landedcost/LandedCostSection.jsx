import React, { useState } from 'react';
import { Calculator, CheckCircle2, EyeOff } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import useLandedCostRecord from './useLandedCostRecord';
import LandedCostDialog from './LandedCostDialog';
import { fmtDateTime } from '../quotecompare/format';
import { fmtWon } from '@/lib/orderCost';

const won = fmtWon;
const DONE_SHIPMENT = ['ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];

// 정산 탭: 주문의 한국 도착 원가를 확정해 고객 '상품 원가'에 보여 준다. 고객사가 연결된 카드에서만 보인다.
export default function LandedCostSection({ card, user }) {
  const { t } = useLanguage();
  const lc = useLandedCostRecord(card);
  const [open, setOpen] = useState(false);
  if (!card.client_id || lc.loading) return null;
  const rec = lc.record;
  const confirmed = rec?.status === 'CONFIRMED';
  const arrived = lc.shipments.length > 0 && lc.shipments.every((s) => DONE_SHIPMENT.includes(s.status));
  const hasInput = !!lc.quotation || lc.stages.length > 0;
  if (!rec && !hasInput) return null;

  const toggle = async () => {
    try {
      await lc.setStatus(confirmed ? 'WITHDRAWN' : 'CONFIRMED');
      toast({ title: confirmed ? t('lc.withdrawn') : t('lc.republished') });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };

  return (
    <section className="mb-4 space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-body font-semibold"><Calculator className="h-4 w-4 text-primary" />{t('lc.title')}
            {rec && <Badge variant="outline" className="text-micro">{confirmed ? t('lc.status.CONFIRMED') : t('lc.status.WITHDRAWN')}{rec.revision > 1 ? ` · ${rec.revision}${t('lc.revisionSuffix')}` : ''}</Badge>}
          </div>
          {rec ? (
            <p className="mt-0.5 text-label text-muted-foreground">
              {rec.product_name} · {Number(rec.units).toLocaleString('ko-KR')}{rec.unit_label} · {t('lc.total')} {won(rec.total_krw)} · <span className="font-semibold text-foreground">{rec.unit_label}{t('lc.per')} {won(rec.per_unit_krw)}</span>
              {rec.estimated && <span className="text-warning-text"> · {t('lc.hasEstimate')}</span>}
              <span> · {rec.confirmed_by_name} {fmtDateTime(rec.confirmed_at)}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-label text-muted-foreground">{arrived ? <span className="font-medium text-primary">{t('lc.readyHint')}</span> : t('lc.desc')}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rec && <Button size="sm" variant="ghost" className="h-7 gap-1 text-label" onClick={toggle}>{confirmed ? <><EyeOff className="h-3 w-3" />{t('lc.withdraw')}</> : <><CheckCircle2 className="h-3 w-3" />{t('lc.republish')}</>}</Button>}
          <Button size="sm" variant={rec ? 'outline' : arrived ? 'default' : 'outline'} className="h-7 text-label" onClick={() => setOpen(true)}>{rec ? t('lc.edit') : t('lc.start')}</Button>
        </div>
      </div>
      {open && <LandedCostDialog open={open} onOpenChange={setOpen} card={card} user={user} lc={lc} />}
    </section>
  );
}
