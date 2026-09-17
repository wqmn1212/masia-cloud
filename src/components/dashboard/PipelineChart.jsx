import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';

const STAGE_LABELS = {
  CONTRACT: '계약 완료',
  MANUFACTURING: '제조 중',
  QC_PASS: 'QC 통과',
  SHIPPING: '해상 선적',
  CUSTOMS: '통관',
  INSTALLATION: '설치'
};

export default function PipelineChart({ timelines }) {
  const { t } = useLanguage();
  const stageData = Object.entries(STAGE_LABELS).map(([key, label]) => ({
    name: t(`stage.${key}`, label),
    count: timelines.filter(t => t.current_stage === key).length,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t('dashboard.pipeline')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={t('dashboard.countLabel')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}