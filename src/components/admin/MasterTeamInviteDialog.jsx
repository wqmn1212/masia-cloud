import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export default function MasterTeamInviteDialog({ tenantId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', account_label: '', team_role_id: '' });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ['master-team-roles', tenantId], queryFn: async () => (await base44.functions.invoke('manageTeamRoles', { action: 'list', tenant_id: tenantId })).data });
  const invite = useMutation({
    mutationFn: () => base44.functions.invoke('inviteSubAccount', { ...form, tenant_id: tenantId }),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['master-team-members', tenantId] }); setOpen(false); setForm({ email: '', account_label: '', team_role_id: '' }); toast({ title: res.data?.pending ? '초대장을 발송했습니다.' : '팀원을 추가했습니다.' }); },
    onError: (error) => toast({ title: '초대 실패', description: error.message, variant: 'destructive' }),
  });
  const roles = data?.roles || [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus />팀원 추가</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>팀원 추가</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <div><Label>이메일</Label><Input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="member@company.com" /></div>
          <div><Label>표시 이름 (선택)</Label><Input value={form.account_label} onChange={(event) => setForm({ ...form, account_label: event.target.value })} placeholder="예: 영업팀 김OO" /></div>
          <div><Label>팀 역할</Label><Select required value={form.team_role_id} onValueChange={(value) => setForm({ ...form, team_role_id: value })}><SelectTrigger><SelectValue placeholder="역할을 선택하세요" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select>{roles.length === 0 && <p className="mt-1 text-xs text-destructive">이 팀에 등록된 역할이 없습니다.</p>}</div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button type="submit" disabled={invite.isPending || !form.team_role_id}>{invite.isPending && <Loader2 className="animate-spin" />}초대 발송</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}