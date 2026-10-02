import React from 'react';
import { Button } from '@/components/ui/button';
import { PUBLISH_STATUS, statusOf } from '@/lib/portfolioMeta';

// 상태 배지 + 다음 단계 버튼 (초안 → 검토 요청 → 발행)
export default function PortfolioStatusActions({ item, canPublish, onSetStatus }) {
  const status = statusOf(item);
  const meta = PUBLISH_STATUS[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-semibold px-2 py-1 rounded-md ${meta.className}`}>{meta.label}</span>
      {status === 'draft' && (
        <Button size="sm" variant="outline" onClick={() => onSetStatus(item, 'review')}>검토 요청</Button>
      )}
      {status === 'review' && canPublish && (
        <>
          <Button size="sm" disabled={!item.consent_confirmed} title={item.consent_confirmed ? undefined : '고객 동의 확인 후 발행할 수 있습니다'} onClick={() => onSetStatus(item, 'published')}>발행</Button>
          <Button size="sm" variant="ghost" onClick={() => onSetStatus(item, 'draft')}>반려</Button>
        </>
      )}
      {status === 'review' && !canPublish && (
        <Button size="sm" variant="ghost" onClick={() => onSetStatus(item, 'draft')}>요청 취소</Button>
      )}
      {status === 'published' && canPublish && (
        <Button size="sm" variant="outline" onClick={() => onSetStatus(item, 'draft')}>발행 취소</Button>
      )}
    </div>
  );
}