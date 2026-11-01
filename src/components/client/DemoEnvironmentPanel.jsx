import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, MonitorPlay, RotateCcw, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { demoPortalPath } from '@/lib/clientView';

const errorText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';

// 고객사 관리 맨 위: 영업 미팅용 데모 고객 포털. 실제 팀과 분리된 데모 팀 안에 예시 데이터가 있다.
export default function DemoEnvironmentPanel() {
  const { user } = useAuth();
  const canReset = ['master', 'service'].includes(user?.account_tier);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['demo-environment'], queryFn: async () => (await base44.functions.invoke('demoEnvironment', { action: 'status' })).data });
  const [busy, setBusy] = useState('');
  const run = async (action) => {
    if (action === 'remove' && !window.confirm('데모 데이터를 모두 지울까요? 실제 고객 데이터는 건드리지 않습니다.')) return;
    setBusy(action);
    try {
      const res = (await base44.functions.invoke('demoEnvironment', { action })).data;
      qc.setQueryData(['demo-environment'], res);
      toast({ title: action === 'reset' ? '데모를 오늘 기준으로 새로 만들었습니다' : '데모를 지웠습니다' });
    } catch (e) {
      toast({ title: '처리하지 못했습니다', description: errorText(e), variant: 'destructive' });
    } finally { setBusy(''); }
  };
  const ready = !!data?.ready;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <MonitorPlay className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">영업 미팅용 데모</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              예시 고객사 "{data?.company_name || '데모상사 (시연용)'}"의 고객 포털을 그대로 보여 줍니다. 문의 → 견적 → 발주 → 현지 검수 → 선적 → 도착 원가 → 불량 보상 → 성과 리포트까지 한 바퀴 돈 예시이고, 날짜는 초기화한 날 기준입니다. 실제 팀과 분리되어 있어 알림·메일이 아무에게도 가지 않습니다.
            </p>
            {isLoading ? <p className="mt-1 text-xs text-muted-foreground">확인하는 중…</p> : ready ? (
              <p className="mt-1 text-xs text-muted-foreground">카드 {data.cards}개{data.reset_at ? ` · ${new Date(data.reset_at).toLocaleString('ko-KR')} ${data.reset_by_name || ''} 초기화` : ''}</p>
            ) : <p className="mt-1 text-xs text-muted-foreground">{canReset ? '아직 데모가 없습니다. 데모 만들기를 누르세요 (10~20초).' : '아직 데모가 없습니다. 대표·팀 관리자에게 만들어 달라고 하세요.'}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {ready && <Button size="sm" className="h-8 gap-1.5" onClick={() => navigate(demoPortalPath(data.company_id))}><MonitorPlay className="h-3.5 w-3.5" />데모 고객 포털 열기</Button>}
          {canReset && <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!!busy || isLoading} onClick={() => run('reset')}>{busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}{ready ? '처음 상태로 초기화' : '데모 만들기'}</Button>}
          {canReset && ready && <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" disabled={!!busy} onClick={() => run('remove')}>{busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}지우기</Button>}
        </div>
      </div>
    </section>
  );
}
