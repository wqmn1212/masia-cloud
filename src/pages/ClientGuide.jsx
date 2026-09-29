import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GuideSection from '@/components/client/guide/GuideSection';
import CardTabsGuide from '@/components/client/guide/CardTabsGuide';
import GuideFaq from '@/components/client/guide/GuideFaq';
import { MockSidebar, MockDashboard, MockBoard } from '@/components/client/guide/GuideMockups';

export default function ClientGuide() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">이용 가이드</h1>
        <p className="text-sm text-muted-foreground mt-1">AEGIS Cloud에서 프로젝트 진행 상황을 확인하고 담당자와 소통하는 방법을 안내합니다</p>
      </div>
      <GuideSection no="01" title="왼쪽 메뉴에서 시작합니다" mock={<MockSidebar />}>
        <p>왼쪽에 메뉴 세 개가 있습니다. 진행 상황을 한눈에 보려면 고객 대시보드, 프로젝트를 단계별로 보려면 소싱 보드, 사용법이 궁금하면 이 이용 가이드입니다.</p>
      </GuideSection>
      <GuideSection no="02" title="고객 대시보드에서 전체를 확인합니다" mock={<MockDashboard />}>
        <p>맨 위 숫자는 단계별 프로젝트 건수입니다. 그 아래에 진행 중인 프로젝트가 나열되고, 제목을 누르면 상세 화면이 열립니다. 담당자 연락처와 공유 파일도 이 화면에 있습니다.</p>
      </GuideSection>
      <GuideSection no="03" title="소싱 보드에서 단계를 확인합니다" mock={<MockBoard />}>
        <p>프로젝트가 대기 중, 소싱 중, 견적 검토, 발주·제작, 완료 다섯 단계를 지나갑니다. 단계는 AEGIS 담당자가 업데이트하므로 직접 옮기실 필요는 없습니다. 새 프로젝트를 맡기실 때는 오른쪽 위 신규 문의 작성을 누르세요.</p>
      </GuideSection>
      <CardTabsGuide />
      <GuideFaq />
      <Card className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold">이제 프로젝트를 확인해 보세요</p>
          <p className="text-sm text-muted-foreground">궁금한 점은 각 프로젝트의 문의 탭에서 담당자에게 남겨 주세요.</p>
        </div>
        <Button asChild><Link to="/client/board">소싱 보드로 가기</Link></Button>
      </Card>
    </div>
  );
}