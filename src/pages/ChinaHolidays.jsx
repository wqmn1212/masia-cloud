import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import HolidayManager from '@/components/holidays/HolidayManager';
import ClosureManager from '@/components/holidays/ClosureManager';

export default function ChinaHolidays() {
  const { user } = useAuth();
  const canEdit = ['master', 'service'].includes(user?.account_tier);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">중국 휴무</h1>
        <p className="text-sm text-muted-foreground mt-1">공휴일·공장 휴무를 등록하면 매일 08:00 진행 카드와의 겹침을 점검하고, 납품일 자동 계산에서 제외합니다.</p>
      </div>
      <HolidayManager canEdit={canEdit} />
      <ClosureManager user={user} canEdit={canEdit} />
    </div>
  );
}