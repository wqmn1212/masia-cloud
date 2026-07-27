import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import UserAccountRow from '@/components/admin/UserAccountRow';
import MasterTeamInviteDialog from '@/components/admin/MasterTeamInviteDialog';

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
  const members = data?.subs || [];
  const pending = data?.pending || [];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />팀원 관리 ({members.length})</CardTitle><MasterTeamInviteDialog tenantId={tenantId} /></CardHeader>
      <CardContent className="divide-y p-0">
        {isLoading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" /> : members.length === 0
          ? <p className="p-8 text-center text-sm text-muted-foreground">등록된 팀원이 없습니다.</p>
          : members.map((member) => <UserAccountRow key={member.id} user={member} disabled={toggle.isPending} onToggle={(is_active) => toggle.mutate({ id: member.id, is_active })} />)}
        {pending.map((invite) => <div key={invite.id} className="flex items-center gap-3 p-3"><Mail className="h-4 w-4 text-muted-foreground" /><div className="flex-1"><p className="text-sm font-medium">{invite.email}</p><p className="text-xs text-muted-foreground">{invite.team_role_name || '팀원'}</p></div><span className="text-xs font-medium text-amber-600">가입 대기 중</span></div>)}
      </CardContent>
    </Card>
  );
}