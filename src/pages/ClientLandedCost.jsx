import React, { useMemo, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NewInquiryDialog from '@/components/client/NewInquiryDialog';
import LandedCostForm, { EMPTY_LANDED_INPUT, toEngineInput } from '@/components/landedcost/LandedCostForm';
import LandedCostResult from '@/components/landedcost/LandedCostResult';
import useLogisticsRates from '@/components/landedcost/useLogisticsRates';
import { calcLandedCost, compareModes, quoteNotice } from '@/lib/landedCost';

const SAMPLE = { ...EMPTY_LANDED_INPUT, cargoBy: 'TOTAL', totalCbm: '9.5', totalKg: '1200', units: '5000', goodsValue: '10000', term: 'CIF' };

// 고객 포털 전용 수입 물류비 계산기. 로그인한 고객사 계정만 쓸 수 있다 (요율 조회 함수도 로그인 필수).
export default function ClientLandedCost() {
  const { rates, usdKrw, rateDate, fxStale } = useLogisticsRates();
  const [form, setForm] = useState(SAMPLE);
  const [inquiry, setInquiry] = useState(null);

  const engineInput = useMemo(() => toEngineInput(form, usdKrw), [form, usdKrw]);
  const result = useMemo(() => calcLandedCost(engineInput, rates), [engineInput, rates]);
  const compare = useMemo(() => compareModes(engineInput, rates), [engineInput, rates]);

  const ask = () => setInquiry(`[물류비 계산기에서 문의]\n${quoteNotice(result)}\n\n제품·공장 정보: `);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">물류비 계산기</h1>
        <p className="mt-1 text-sm text-muted-foreground">공장 견적서의 거래 조건과 화물을 넣으면, 한국 도착까지 구간별로 누가 얼마를 내는지와 따로 낼 돈을 계산합니다</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <Card className="p-5">
          <LandedCostForm value={form} onChange={setForm} defaultUsdKrw={usdKrw} />
        </Card>
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <LandedCostResult result={result} compare={compare} />
          </Card>
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">이 조건으로 실제 견적을 받아 보세요</p>
              <p className="mt-0.5 text-xs text-muted-foreground">계산 결과가 문의 내용에 들어갑니다. 담당자가 포워더 견적으로 확인해 회신드립니다.</p>
            </div>
            <Button onClick={ask} disabled={result.needsCargo} className="gap-1.5"><MessageSquarePlus className="h-4 w-4" />담당자에게 문의</Button>
          </Card>
          {fxStale && <p className="rounded-md bg-chart-3/10 px-3 py-2 text-xs text-chart-3">환율이 {rateDate} 기준입니다. 최신 환율로 계산하려면 '받은 견적이 있으면 더 정확하게'에서 환율을 직접 넣어 주세요.</p>}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            이 금액은 이지스가 최근 포워더 청구 기준으로 계산한 예상치입니다{rateDate ? ` (환율 기준일 ${rateDate})` : ''}. 실제 금액은 도착 후 실측 부피, 도착일 환율, 세관 검사, 보관 기간에 따라 달라질 수 있고, 관세율은 품목(HS코드)으로 확인해야 합니다.
          </p>
        </div>
      </div>

      <NewInquiryDialog open={!!inquiry} onClose={() => setInquiry(null)} initialTitle="물류비 견적 확인 요청" initialDetail={inquiry || ''} />
    </div>
  );
}
