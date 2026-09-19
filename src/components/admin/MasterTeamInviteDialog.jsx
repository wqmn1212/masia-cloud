import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import InvitePermissionPicker from '@/components/admin/InvitePermissionPicker';

export default function MasterTeamInviteDialog({ tenantId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', account_label: '', menu_paths: ['/dashboard'], send_password_setup: true });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invite = useMutation({
    mutationFn: () => base44.functions.invoke('inviteSubAccount', { ...form, tenant_id: tenantId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['master-team-members', tenantId] });
      setOpen(false);
      setForm({ email: '', account_label: '', menu_paths: ['/dashboard'], send_password_setup: true });
      const mail = res.data?.password_setup;
      const description = !mail?.requested ? '비밀번호 설정 메일은 발송하지 않았습니다.' : mail.sent ? '비밀번호 설정 메일도 함께 발송했습니다.' : `초대는 완료됐지만 비밀번호 설정 메일은 발송하지 못했습니다. ${mail.error || ''}`;
      toast({ title: res.data?.pending ? '초대장을 발송했습니다.' : '팀원을 추가했습니다.', description, variant: mail?.requested && !mail.sent ? 'destructive' : 'default' });
    },
    onError: (error) => toast({ title: '초대 실패', description: error.message, variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus />팀원 추가</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>팀원 추가</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <div><Label>이메일</Label><Input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="member@company.com" /></div>
          <div><Label>표시 이름 (선택)</Label><Input value={form.account_label} onChange={(event) => setForm({ ...form, account_label: event.target.value })} placeholder="예: 영업팀 김OO" /></div>
          <InvitePermissionPicker value={form.menu_paths} onChange={(menu_paths) => setForm({ ...form, menu_paths })} />
          <div className="flex items-start gap-3 rounded-md border p-3"><Checkbox id="master-member-password-mail" checked={form.send_password_setup} onCheckedChange={(checked) => setForm({ ...form, send_password_setup: checked === true })} /><div><Label htmlFor="master-member-password-mail" className="cursor-pointer">비밀번호 설정 메일도 함께 보내기</Label><p className="mt-1 text-xs text-muted-foreground">초대받은 사용자가 메일 링크에서 직접 비밀번호를 설정합니다.</p></div></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button type="submit" disabled={invite.isPending || form.menu_paths.length === 0}>{invite.isPending && <Loader2 className="animate-spin" />}초대 발송</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}