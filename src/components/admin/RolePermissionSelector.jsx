import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InvitePermissionPicker from '@/components/admin/InvitePermissionPicker';
import { TEAM_MENU_OPTIONS } from '@/lib/menuPermissions';

export default function RolePermissionSelector({ tenantId, roleId, paths, onChange }) {
  const [manual, setManual] = useState({});
  const { data } = useQuery({
    queryKey: ['master-team-roles', tenantId],
    queryFn: async () => (await base44.functions.invoke('manageTeamRoles', { action: 'list', tenant_id: tenantId })).data,
  });
  const roles = data?.roles || [];
  const selectRole = (value) => {
    const nextRoleId = value === 'none' ? '' : value;
    const defaults = new Set(roles.find((role) => role.id === nextRoleId)?.menu_paths || []);
    const nextPaths = TEAM_MENU_OPTIONS.filter((item) => manual[item.path] ?? defaults.has(item.path)).map((item) => item.path);
    onChange(nextRoleId, nextPaths);
  };
  const changePaths = (nextPaths) => {
    const selected = new Set(nextPaths);
    const previous = new Set(paths);
    const changes = {};
    TEAM_MENU_OPTIONS.forEach((item) => {
      if (selected.has(item.path) !== previous.has(item.path)) changes[item.path] = selected.has(item.path);
    });
    setManual((current) => ({ ...current, ...changes }));
    onChange(roleId, nextPaths);
  };
  return <div className="space-y-4">
    <div><Label>팀 역할 (선택)</Label><Select value={roleId || 'none'} onValueChange={selectRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">역할 미지정</SelectItem>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select>{roles.length === 0 && <p className="mt-1 text-xs text-muted-foreground">등록된 역할이 없어 기능 권한만 직접 선택할 수 있습니다.</p>}</div>
    <InvitePermissionPicker value={paths} onChange={changePaths} />
  </div>;
}