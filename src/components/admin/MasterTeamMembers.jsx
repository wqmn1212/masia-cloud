import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import UserAccountRow from '@/components/admin/UserAccountRow';
import MasterTeamInviteDialog from '@/components/admin/MasterTeamInviteDialog';
import PendingInviteRow from '@/components/admin/PendingInviteRow';

export default function MasterTeamMembers({ tenantId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['master-team-members', tenantId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await base44.functions.invoke('listMySubAccounts', { tenant_id: tenantId })).data,
  });
  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => base44.functions.invoke('toggleUserActive', { target_user_id: id, is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => toast({ title: '상태 변경 실패', description: error.message, variant: 'destructive' }),
  });
  const resetPassword = useMutation({
    mutationFn: (email) => base44.functions.invoke('resetClientPassword', { email }),
    onSuccess: (_, email) => toast({ title: '비밀번호 설정 메일이 발송되었습니다', description: email }),
    onError: (error) => toast({ title: '메일 발송 실패', description: error.message, variant: 'destructive' }),
  });
  const members = data?.members || data?.subs || [];
  const pending = data?.pending || [];
  const isClientTeam = data?.tenant_type === 'client';
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />{isClientTeam ? '고객 계정' : '팀원 관리'} ({members.length})</CardTitle><MasterTeamInviteDialog tenantId={tenantId} isClientTeam={isClientTeam} /></CardHeader>
      <CardContent className="divide-y p-0">
        {isLoading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" /> : members.length === 0
          ? <p className="p-8 text-center text-sm text-muted-foreground">등록된 팀원이 없습니다.</p>
          : members.map((member) => <UserAccountRow key={member.id} user={member} disabled={toggle.isPending} onToggle={(is_active) => toggle.mutate({ id: member.id, is_active })} onResetPassword={() => resetPassword.mutate(member.email)} resetPending={resetPassword.isPending} />)}
        {pending.map((invite) => <PendingInviteRow key={invite.id} invite={invite} isClientTeam={isClientTeam} />)}
      </CardContent>
    </Card>
  );
}