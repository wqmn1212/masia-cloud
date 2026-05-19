import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export default function RecentQuotations({ quotations }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">최근 견적</CardTitle>
          <Link to="/quotations" className="text-xs text-primary hover:underline">전체 보기</Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">등록된 견적이 없습니다</p>
        ) : (
          quotations.slice(0, 5).map((q) => {
            const st = STATUS_MAP[q.status] || STATUS_MAP.DRAFT;
            return (
              <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.factory_name || '미지정 공장'}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[q.machine_category] || q.machine_category || '카테고리 없음'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge className={`${st.className} border-0 text-[10px]`}>{st.label}</Badge>
                  {q.final_client_price > 0 && (
                    <p className="text-xs font-semibold mt-1">
                      ¥{q.final_client_price?.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}