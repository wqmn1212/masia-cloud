import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

// 고객 포털 설정 (대표·팀 관리자·마스터): 고객 카드 화면에 담당 PM(카드 책임자) 이름과 답변 가능 시간을 보여 줄지 (기본 숨김),
// 고객 확인을 요청한 파일은 고객이 승인한 판만 공장 전달 승인본으로 지정하게 할지 (기본 끔 — 지금처럼 직원이 지정).
export default function ClientPortalSettingsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = user?.tenant_id;
  const allowed = ['master', 'service'].includes(user?.account_tier) && !!tenantId;
  const { data: setting, isLoading } = useQuery({
    queryKey: ['operation-setting', tenantId],
    enabled: allowed,
    queryFn: async () => (await base44.entities.OperationSetting.filter({ tenant_id: tenantId }, '-updated_date', 1))[0] || null,
  });
  const [showPm, setShowPm] = useState(false);
  const [hours, setHours] = useState('');
  const [needClient, setNeedClient] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setShowPm(setting?.client_show_pm === true); setHours(setting?.client_reply_hours || ''); setNeedClient(setting?.factory_approval_requires_client === true); }, [setting]);
  if (!allowed || isLoading) return null;

  const save = async () => {
    setBusy(true);
    try {
      const patch = { client_show_pm: showPm, client_reply_hours: hours.trim().slice(0, 60), factory_approval_requires_client: needClient, updated_by: user.full_name || user.email || '' };
      if (setting) await base44.entities.OperationSetting.update(setting.id, patch);
      else await base44.entities.OperationSetting.create({ tenant_id: tenantId, ...patch });
      qc.invalidateQueries({ queryKey: ['operation-setting', tenantId] });
      toast({ title: '고객 포털 설정을 저장했습니다' });
    } catch (err) {
      toast({ title: '저장하지 못했습니다', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const changed = showPm !== (setting?.client_show_pm === true) || hours !== (setting?.client_reply_hours || '') || needClient !== (setting?.factory_approval_requires_client === true);
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-body font-semibold">고객 포털에 담당 PM 보여 주기</h2>
            <p className="mt-0.5 text-label text-muted-foreground">켜면 고객 카드 화면 위쪽에 카드 책임자 이름과 답변 가능 시간이 보입니다. 끄면 지금처럼 담당자를 보여 주지 않습니다.</p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-label">
            <span>담당 PM 이름 표시</span>
            <Switch checked={showPm} onCheckedChange={setShowPm} disabled={busy} aria-label="담당 PM 이름 표시" />
          </label>
          <label className="block text-label">답변 가능 시간 (선택)
            <Input className="mt-1 text-label" value={hours} maxLength={60} onChange={(e) => setHours(e.target.value)} placeholder="예: 평일 10:00~18:00 (한국 시간)" disabled={busy} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-label">
            <span>고객 확인을 요청한 파일은 고객이 승인한 판만 공장 전달 승인본으로 지정<span className="block text-caption text-muted-foreground">인쇄·도면 불량 때 '고객이 승인한 판'이 근거가 됩니다. 확인을 요청하지 않은 파일은 지금처럼 지정합니다.</span></span>
            <Switch checked={needClient} onCheckedChange={setNeedClient} disabled={busy} aria-label="고객 승인 판만 승인본으로" />
          </label>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={save} disabled={busy || !changed}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
