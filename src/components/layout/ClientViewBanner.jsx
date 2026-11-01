import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exitClientView, isDemoView } from '@/lib/clientView';

// 직원이 고객 포털을 열람하는 중임을 알리는 띠. 열람은 읽기 전용이라 고객용 버튼은 동작하지 않는다.
export default function ClientViewBanner() {
  const navigate = useNavigate();
  const demo = isDemoView();
  const leave = () => { exitClientView(); navigate(demo ? '/clients' : '/master-admin'); };
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body text-warning-text">
      <Eye className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{demo ? '영업 시연용 데모 고객 포털' : '고객 포털 미리보기'}</span>
        <span className="ml-1.5 text-caption opacity-80">{demo ? '예시 데이터입니다. 고객이 보는 화면 그대로이며, 읽기 전용이라 수락·서명 같은 버튼은 동작하지 않습니다.' : '읽기 전용입니다. 고객용 버튼은 동작하지 않습니다.'}</span>
      </p>
      <Button size="sm" variant="outline" className="h-8 gap-1 border-warning/60 bg-transparent text-warning-text hover:bg-warning/15" onClick={leave}><LogOut className="h-3.5 w-3.5" />직원 화면으로</Button>
    </div>
  );
}
