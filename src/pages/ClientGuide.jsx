import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ClientGuideBody from '@/components/client/guide/ClientGuideBody';

export default function ClientGuide() {
  return (
    <ClientGuideBody lang="ko" footer={
      <Card className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold">이제 프로젝트를 확인해 보세요</p>
          <p className="text-sm text-muted-foreground">궁금한 점은 각 프로젝트의 문의 탭에서 담당자에게 남겨 주세요.</p>
        </div>
        <Button asChild><Link to="/client/board">소싱 보드로 가기</Link></Button>
      </Card>
    } />
  );
}