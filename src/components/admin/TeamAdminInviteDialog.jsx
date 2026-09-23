import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import InviteLinkNotice from '@/components/admin/InviteLinkNotice';

// 마스터 전용: 기존 팀(기본 본사)에 팀 관리자 초대
export default function TeamAdminInviteDialog({ open, onOpenChange, tenants, defaultTenantId, onDone }) {
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const teams = tenants.filter((t) => t.tenant_type !== 'client');

  useEffect(() => { if (open) setTenantId(defaultTenantId || teams[0]?.id || ''); }, [open, defaultTenantId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await base44.functions.invoke('inviteServiceAdmin', { email, tenant_id: tenantId, account_label: label }).catch((err) => ({ data: { error: err.response?.data?.error || err.message } }));
    setBusy(false);
    if (res.data?.error) return toast({ title: '초대 실패', description: res.data.error, variant: 'destructive' });
    toast({ title: '팀 관리자 초대 완료', description: res.data?.pending ? '참여 링크를 복사해 동료에게 전달하세요.' : '기존 계정에 팀 관리자 권한을 적용했습니다.' });
    onDone?.();
    if (!res.data?.pending) { setEmail(''); setLabel(''); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>팀 관리자 초대</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5"><Label className="text-xs">소속 팀</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="팀 선택" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.is_hq ? ' (본사)' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">이메일</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" /></div>
          <div className="space-y-1.5"><Label className="text-xs">이름/표시명 (선택)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 홍길동" /></div>
          {email && <InviteLinkNotice email={email} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
            <Button type="submit" disabled={busy || !tenantId}>{busy && <Loader2 className="animate-spin" />}초대하기</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}