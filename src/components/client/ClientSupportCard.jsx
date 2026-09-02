import React from 'react';
import { LifeBuoy } from 'lucide-react';
import { Card } from '@/components/ui/card';

// 플랫폼 인증(A안)을 사용하므로 비밀번호 재설정 대신 담당자 연락처를 상시 노출한다.
export default function ClientSupportCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <LifeBuoy className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">담당자 문의</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
        계정 접근이 어려우시거나 진행 상황에 문의가 있으시면 담당 PM 에게 연락해 주세요.
        프로젝트별 문의는 각 카드의 채팅 탭을 이용하시면 가장 빠릅니다.
      </p>
      <div className="mt-3 text-xs space-y-1">
        <p><span className="text-muted-foreground">이메일 </span><a href="mailto:contact@aegis-trade.com" className="text-primary hover:underline">contact@aegis-trade.com</a></p>
        <p><span className="text-muted-foreground">본사 </span>서울 · 선전 (Shenzhen) 지사</p>
      </div>
    </Card>
  );
}