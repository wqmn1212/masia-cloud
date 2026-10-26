import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2, PackageSearch, Repeat } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ClientReorderDialog from '@/components/client/ClientReorderDialog';
import { fmtWon, groupByProduct } from '@/lib/orderCost';

const won = fmtWon;
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtWon(Math.abs(v))}`;
const fmtDate = (d) => (d ? d.replaceAll('-', '.') : '');
const CUR_LABEL = { USD: '달러', CNY: '위안' };

// 개당 원가 추이 (주문 순). 한 계열이라 범례 없이 제목이 이름을 대신하고, 점에 올리면 값이 보인다.
function Trend({ orders, unit }) {
  const [hover, setHover] = useState(null);
  if (orders.length < 2) return null;
  const W = 280, H = 64, PX = 8, PY = 10;
  const vals = orders.map((o) => o.per_unit_krw);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || hi * 0.1 || 1;
  const x = (i) => PX + (i * (W - PX * 2)) / (orders.length - 1);
  const y = (v) => PY + (1 - (v - (lo - span * 0.15)) / (span * 1.3)) * (H - PY * 2);
  const pts = orders.map((o, i) => [x(i), y(o.per_unit_krw)]);
  const h = hover != null ? orders[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={`${unit}당 도착 원가 추이`}>
        <line x1={PX} x2={W - PX} y1={H - 2} y2={H - 2} stroke="hsl(var(--border))" strokeWidth="1" />
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([px, py], i) => (
          <g key={orders[i].id}>
            <circle cx={px} cy={py} r={i === hover ? 5 : 4} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2" />
            <rect x={px - 14} y={0} width={28} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} />
          </g>
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] shadow-sm" style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          {fmtDate(h.order_date)} · <span className="font-semibold">{won(h.per_unit_krw)}</span>
        </div>
      )}
    </div>
  );
}

function ChangeLine({ label, value }) {
  if (value == null || Math.abs(value) < 0.005) return null;
  return <div className="flex justify-between gap-3 text-xs"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{value > 0 ? '▲' : '▼'} {signed(value)}</dd></div>;
}

function ProductCard({ g, onReorder, canReorder }) {
  const [open, setOpen] = useState(false);
  const r = g.latest;
  const ch = g.change;
  const unit = g.unit_label;
  const recurring = r.lines.filter((l) => !l.one_time);
  const oneTime = r.lines.filter((l) => l.one_time);
  const share = (v) => (r.total_krw ? Math.round((v / r.total_krw) * 100) : 0);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{g.name}</p>
          <p className="text-xs text-muted-foreground">주문 {g.orders.length}건 · 최근 {fmtDate(r.order_date)} · {Number(r.units).toLocaleString('ko-KR')}{unit}</p>
        </div>
        {r.estimated && <Badge variant="outline" className="shrink-0 text-[10px] text-chart-3">일부 예상값</Badge>}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">{unit}당 한국 도착 원가 (부가세 제외)</p>
          <p className="text-2xl font-bold tabular-nums">{won(r.per_unit_krw)}</p>
          {ch && (
            <p className="text-xs">
              <span className="font-medium tabular-nums">{ch.diff > 0 ? '▲' : ch.diff < 0 ? '▼' : ''} {signed(ch.diff)}{ch.pct != null ? ` (${ch.pct > 0 ? '+' : ''}${(ch.pct * 100).toFixed(1)}%)` : ''}</span>
              <span className="text-muted-foreground"> 직전 주문 대비</span>
            </p>
          )}
        </div>
        {g.orders.length > 1 && <div className="w-40 sm:w-48"><p className="text-[10px] text-muted-foreground">{unit}당 원가 추이</p><Trend orders={g.orders} unit={unit} /></div>}
      </div>

      {ch && Math.abs(ch.diff) >= 0.005 && (
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="mb-1 text-[11px] font-medium">왜 달라졌나요? ({unit}당)</p>
          <dl className="space-y-0.5">
            <ChangeLine label={ch.fx != null ? `공장 단가 (${CUR_LABEL[ch.currency] || ch.currency} 기준)` : '상품 대금'} value={ch.price} />
            <ChangeLine label={ch.fx_from && ch.fx_to ? `환율 (1${CUR_LABEL[ch.currency] ? ` ${CUR_LABEL[ch.currency]}` : ''} ${ch.fx_from.toFixed(ch.currency === 'CNY' ? 1 : 0)}원 → ${ch.fx_to.toFixed(ch.currency === 'CNY' ? 1 : 0)}원)` : '환율'} value={ch.fx} />
            <ChangeLine label="물류·통관·관세" value={ch.logistics} />
            <ChangeLine label="기타" value={ch.other} />
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen((v) => !v)}>{open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{open ? '접기' : '원가 내역·주문별 보기'}</Button>
        {canReorder && r.reorder_card && <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => onReorder(r.reorder_card)}><Repeat className="h-3 w-3" />재주문</Button>}
      </div>

      {open && (
        <div className="space-y-3 border-t pt-3">
          <div>
            <p className="mb-1 text-[11px] font-medium">최근 주문 원가 내역</p>
            <dl className="space-y-1 text-xs">
              {[['상품 대금', r.goods_krw], ['물류·한국 도착 비용', r.logistics_krw], ['기타', r.other_krw]].filter(([, v]) => v > 0).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums">{won(v)} <span className="text-muted-foreground">({share(v)}%)</span></dd></div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-1 font-medium"><dt>합계 ({Number(r.units).toLocaleString('ko-KR')}{unit})</dt><dd className="tabular-nums">{won(r.total_krw)}</dd></div>
            </dl>
            <ul className="mt-2 space-y-0.5">
              {recurring.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="min-w-0">{l.label}{l.estimated ? ' (예상)' : ''}{l.currency !== 'KRW' ? ` · ${l.currency} ${Number(l.amount).toLocaleString('ko-KR')} × ${Number(l.fx).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${l.fx_basis ? ` (${l.fx_basis})` : ''}` : ''}</span>
                  <span className="shrink-0 tabular-nums">{won(l.amount_krw)}</span>
                </li>
              ))}
            </ul>
            {oneTime.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">일회성 비용(개당 원가에서 뺌): {oneTime.map((l) => `${l.label} ${won(l.amount_krw)}`).join(', ')}</p>}
            {r.vat_krw > 0 && <p className="mt-1 text-[11px] text-muted-foreground">수입 부가세 {won(r.vat_krw)}는 매입세액 공제 대상이라 원가에서 뺐습니다.</p>}
            {r.client_note && <p className="mt-2 rounded-md border-l-2 border-primary bg-primary/5 px-2 py-1 text-xs">{r.client_note}</p>}
          </div>
          {g.orders.length > 1 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="text-[11px] text-muted-foreground"><tr><th className="py-1 text-left font-medium">주문일</th><th className="py-1 text-right font-medium">수량</th><th className="py-1 text-right font-medium">합계</th><th className="py-1 text-right font-medium">{unit}당</th></tr></thead>
                <tbody>
                  {[...g.orders].reverse().map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="py-1">{fmtDate(o.order_date)}{o.estimated ? <span className="text-chart-3"> · 예상 포함</span> : ''}</td>
                      <td className="py-1 text-right tabular-nums">{Number(o.units).toLocaleString('ko-KR')}{o.unit_label}</td>
                      <td className="py-1 text-right tabular-nums">{won(o.total_krw)}</td>
                      <td className="py-1 text-right font-medium tabular-nums">{won(o.per_unit_krw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// 고객 포털 '상품 원가': 주문이 끝나면 이지스가 실제로 낸 돈으로 확정한 개당 한국 도착 원가와 주문별 변동
export default function ClientProductCosts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reorder, setReorder] = useState(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['client-landed-costs'],
    queryFn: async () => (await base44.functions.invoke('getClientLandedCosts', withClientView())).data,
  });
  const groups = useMemo(() => groupByProduct(data?.records || []), [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">상품 원가</h1>
        <p className="mt-1 text-sm text-muted-foreground">주문이 끝나면 실제로 낸 상품 대금(입금일 환율)과 물류·통관·관세를 더해 개당 한국 도착 원가를 확정해 드립니다. 직전 주문보다 왜 오르거나 내렸는지도 함께 보여 드립니다.</p>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : isError ? <p className="text-sm text-destructive">상품 원가를 불러오지 못했습니다.</p>
        : groups.length === 0 ? (
          <Card className="p-12 text-center"><PackageSearch className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 font-semibold">아직 확정된 원가가 없습니다</p><p className="mt-1 text-sm text-muted-foreground">주문한 물건이 한국에 도착하고 비용 정산이 끝나면 담당자가 이곳에 원가를 올려 드립니다.</p></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((g) => <ProductCard key={g.key} g={g} canReorder={user?.account_tier === 'client'} onReorder={setReorder} />)}
          </div>
        )}
      <p className="text-[11px] text-muted-foreground">부가세 제외 금액입니다. 원가 관리를 돕는 참고 자료이며 회계 장부나 세무 신고 자료를 대신하지 않습니다.</p>
      {reorder && <ClientReorderDialog open={!!reorder} onOpenChange={(o) => !o && setReorder(null)} card={reorder} onOpenCard={(id) => navigate(`/client/board?card=${id}`)} />}
    </div>
  );
}
