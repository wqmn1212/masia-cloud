import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MemberAccessCard from '@/components/admin/MemberAccessCard';
import AccessEditorDialog from '@/components/admin/AccessEditorDialog';

export default function UserPermissions() {
  const [member, setMember] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading: loadingUser } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });
  const { data, isLoading } = useQuery({
    queryKey: ['my-sub-accounts'],
    queryFn: async () => (await base44.functions.invoke('listMySubAccounts', {})).data,
    enabled: me?.account_tier === 'service',
  });
  const updateMutation = useMutation({
    mutationFn: (item) => base44.functions.invoke('updateMemberPermissions', {
      target_user_id: item.id, allowed_tabs: item.allowed_tabs || [], team_role: item.team_role || 'member',
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-sub-accounts'] }); setMember(null); toast({ title: '역할과 권한이 저장되었습니다' }); },
    onError: (error) => toast({ title: '권한 저장 실패', description: String(error.message || error), variant: 'destructive' }),
  });

  if (loadingUser) return <div className="py-20 text-center text-sm text-muted-foreground">사용자 정보를 불러오는 중...</div>;
  if (me?.account_tier !== 'service') return <Card className="max-w-lg mx-auto"><CardContent className="p-12 text-center"><ShieldAlert className="w-10 h-10 mx-auto text-destructive" /><p className="mt-3 font-semibold">팀 마스터만 접근할 수 있습니다</p></CardContent></Card>;
  const members = data?.subs || [];
  return <div className="space-y-6">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="w-5 h-5" /></div><div><h1 className="text-2xl font-bold">사용자 권한</h1><p className="text-sm text-muted-foreground">팀원 역할과 대시보드·견적 기능 접근 범위를 관리합니다</p></div></div>
    <Card><CardContent className="p-0">{isLoading ? <p className="p-10 text-center text-sm text-muted-foreground">팀원을 불러오는 중...</p> : members.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">관리할 팀원이 없습니다</p> : members.map((item) => <MemberAccessCard key={item.id} member={item} onEdit={() => setMember({ ...item, allowed_tabs: item.allowed_tabs || [] })} />)}</CardContent></Card>
    <AccessEditorDialog member={member} onChange={setMember} onClose={() => setMember(null)} onSave={() => updateMutation.mutate(member)} saving={updateMutation.isPending} />
  </div>;
}