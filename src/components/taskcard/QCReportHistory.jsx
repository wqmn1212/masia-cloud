import React from 'react';
import { Badge } from '@/components/ui/badge';

const META = {
  PASS: { label: '합격', className: 'bg-accent/15 text-accent' },
  CONDITIONAL_PASS: { label: '조건부 합격', className: 'bg-chart-3/15 text-chart-3' },
  FAIL: { label: '불합격', className: 'bg-destructive/15 text-destructive' },
};

export default function QCReportHistory({ reports }) {
  if (!reports.length) return <p className="py-4 text-center text-xs text-muted-foreground">등록된 검수 이력이 없습니다</p>;
  return <div className="space-y-2">{reports.map(report => <div key={report.id} className="rounded-lg border p-3 text-xs">
    <div className="flex items-center justify-between"><span className="font-medium">{report.inspection_type === 'SAMPLE' ? '샘플 검수' : '양산품 검수'}</span><Badge className={`${META[report.qc_result]?.className} border-0`}>{META[report.qc_result]?.label}</Badge></div>
    <p className="mt-1 text-muted-foreground">{report.inspector_name || '검수자 미지정'} · {new Date(report.created_date).toLocaleString('ko-KR')}</p>
    {report.comments && <p className="mt-2 whitespace-pre-wrap">{report.comments}</p>}
    {!!report.media_urls?.length && <div className="mt-2 flex flex-wrap gap-2">{report.media_urls.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-primary underline">{report.media_names?.[i] || `증빙 ${i + 1}`}</a>)}</div>}
  </div>)}</div>;
}