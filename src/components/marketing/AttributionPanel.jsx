import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const QUOTE = ['quoting', 'converted'];
const PERIODS = { 7: '7일', 30: '30일', 90: '90일', 0: '전체' };

export default function AttributionPanel() {
  const [days, setDays] = useState('30');
  const [channel, setChannel] = useState('all');
  const { data, isLoading } = useQuery({
    queryKey: ['attribution'],
    queryFn: async () => ({
      leads: await base44.entities.ManufacturingLead.list('-created_date', 2000),
      contracts: await base44.entities.Contract.list('-created_date', 2000),
    }),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;

  const since = Number(days) ? Date.now() - Number(days) * 86400000 : 0;
  const inRange = data.leads.filter((l) => new Date(l.created_date).getTime() >= since);
  const channels = [...new Set(inRange.map((l) => l.utm_source || l.source || 'direct'))];
  const leads = inRange.filter((l) => channel === 'all' || (l.utm_source || l.source || 'direct') === channel);
  const hasContract = (l) => data.contracts.some((c) => (l.quotation_id && c.quotation_id === l.quotation_id) || (c.client_name && c.client_name === l.company));
  const rows = Object.values(leads.reduce((acc, l) => {
    const k = l.utm_campaign || '(캠페인 없음)';
    const r = (acc[k] ||= { campaign: k, inquiries: 0, quotes: 0, converted: 0, contracts: 0 });
    r.inquiries++; if (QUOTE.includes(l.status)) r.quotes++; if (l.status === 'converted') r.converted++; if (hasContract(l)) r.contracts++;
    return acc;
  }, {})).sort((a, b) => b.inquiries - a.inquiries);

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        {Object.entries(PERIODS).map(([k, v]) => <Button key={k} size="sm" variant={days === k ? 'default' : 'outline'} onClick={() => setDays(k)}>{v}</Button>)}
        <select className="h-8 rounded-md border bg-transparent px-2 text-sm ml-auto" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="all">전체 채널</option>
          {channels.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button size="sm" variant="ghost" asChild><Link to="/leads">리드 목록 →</Link></Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground text-left"><tr>
            <th className="py-2">캠페인</th><th className="text-right">문의</th><th className="text-right">견적</th><th className="text-right">전환</th><th className="text-right">계약</th>
          </tr></thead>
          <tbody className="divide-y tabular-nums">
            {rows.map((r) => (
              <tr key={r.campaign}><td className="py-3 font-medium">{r.campaign}</td><td className="text-right">{r.inquiries}</td><td className="text-right">{r.quotes}</td><td className="text-right">{r.converted}</td><td className="text-right">{r.contracts}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">해당 기간의 문의가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}