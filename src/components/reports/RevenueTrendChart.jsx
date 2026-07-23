import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney } from '@/lib/financialReport';

export default function RevenueTrendChart({ data, currency }) {
  return <Card>
    <CardHeader><CardTitle className="text-base">월별 매출 및 마진 추이</CardTitle></CardHeader>
    <CardContent className="h-80">
      {data.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">표시할 견적 데이터가 없습니다</div> :
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Intl.NumberFormat('ko', { notation: 'compact' }).format(v)} />
          <Tooltip formatter={(value, name) => [formatMoney(value, currency), name === 'revenue' ? '매출' : '마진']} />
          <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="margin" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>}
    </CardContent>
  </Card>;
}