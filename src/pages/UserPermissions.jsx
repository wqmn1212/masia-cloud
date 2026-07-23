import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MemberAccessCard from '@/components/admin/MemberAccessCard';
import AccessEditorDialog from '@/components/admin/AccessEditorDialog';
import RoleManager from '@/components/admin/RoleManager';
import RoleEditorDialog from '@/components/admin/RoleEditorDialog';

export default function UserPermissions() {
  const [member, setMember] = useState(null);
  const [role, setRole] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading: loadingUser } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });
  const enabled = me?.account_tier === 'service';
  const { data, isLoading } = useQuery({ queryKey: ['my-sub-accounts'], queryFn: async () => (await base44.functions.invoke('listMySubAccounts', {})).data, enabled });
  const { data: roleData } = useQuery({ queryKey: ['team-roles'], queryFn: async () => (await base44.functions.invoke('manageTeamRoles', { action: 'list' })).data, enabled });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['team-roles'] }); queryClient.invalidateQueries({ queryKey: ['my-sub-accounts'] }); };
  const updateMember = useMutation({ mutationFn: (item) => base44.functions.invoke('updateMemberPermissions', { target_user_id: item.id, team_role_id: item.team_role_id }), onSuccess: () => { refresh(); setMember(null); toast({ title: '팀원 역할이 저장되었습니다' }); }, onError: (error) => toast({ title: '권한 저장 실패', description: String(error.message || error), variant: 'destructive' }) });
  const saveRole = useMutation({ mutationFn: (item) => base44.functions.invoke('manageTeamRoles', { action: item.id ? 'update' : 'create', role_id: item.id, name: item.name, description: item.description, menu_paths: item.menu_paths }), onSuccess: () => { refresh(); setRole(null); toast({ title: '역할이 저장되었습니다' }); }, onError: (error) => toast({ title: '역할 저장 실패', description: String(error.message || error), variant: 'destructive' }) });
  const deleteRole = useMutation({ mutationFn: (item) => base44.functions.invoke('manageTeamRoles', { action: 'delete', role_id: item.id }), onSuccess: refresh, onError: (error) => toast({ title: '역할 삭제 실패', description: String(error.message || error), variant: 'destructive' }) });

  if (loadingUser) return <div className="py-20 text-center text-sm text-muted-foreground">사용자 정보를 불러오는 중...</div>;
  if (!enabled) return <Card className="max-w-lg mx-auto"><CardContent className="p-12 text-center"><ShieldAlert className="w-10 h-10 mx-auto text-destructive" /><p className="mt-3 font-semibold">팀 관리자만 접근할 수 있습니다</p></CardContent></Card>;
  const members = data?.subs || [];
  const roles = roleData?.roles || [];
  return <div className="space-y-6">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="w-5 h-5" /></div><div><h1 className="text-2xl font-bold">사용자 권한</h1><p className="text-sm text-muted-foreground">역할별 메뉴 접근 권한을 만들고 팀원에게 배정합니다</p></div></div>
    <RoleManager roles={roles} onCreate={() => setRole({ name: '', description: '', menu_paths: [] })} onEdit={(item) => setRole({ ...item })} onDelete={(item) => deleteRole.mutate(item)} deleting={deleteRole.isPending} />
    <Card><CardContent className="p-0">{isLoading ? <p className="p-10 text-center text-sm text-muted-foreground">팀원을 불러오는 중...</p> : members.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">관리할 팀원이 없습니다</p> : members.map((item) => <MemberAccessCard key={item.id} member={item} onEdit={() => setMember({ ...item })} />)}</CardContent></Card>
    <AccessEditorDialog member={member} roles={roles} onChange={setMember} onClose={() => setMember(null)} onSave={() => updateMember.mutate(member)} saving={updateMember.isPending} />
    <RoleEditorDialog role={role} onChange={setRole} onClose={() => setRole(null)} onSave={() => saveRole.mutate(role)} saving={saveRole.isPending} />
  </div>;
}