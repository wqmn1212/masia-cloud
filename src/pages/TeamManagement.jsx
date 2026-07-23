import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, UserCog, Loader2, AlertTriangle, Mail, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import UserAccountRow from '@/components/admin/UserAccountRow';
import PermissionPicker from '@/components/admin/PermissionPicker';

export default function TeamManagement() {
  const [me, setMe] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [allowedTabs, setAllowedTabs] = useState([]);
  const [permissionUser, setPermissionUser] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => setMe(false));
  }, []);

  const isServiceAdmin = me && me.account_tier === 'service';

  const { data, isLoading } = useQuery({
    queryKey: ['my-sub-accounts'],
    queryFn: async () => (await base44.functions.invoke('listMySubAccounts', {})).data,
    enabled: !!isServiceAdmin,
  });

  const inviteMutation = useMutation({
    mutationFn: (body) => base44.functions.invoke('inviteSubAccount', body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-sub-accounts'] });
      setInviteOpen(false);
      setEmail('');
      setLabel('');
      setAllowedTabs([]);
      toast({
        title: '초대 완료',
        description: res.data?.pending
          ? '초대장이 발송되었습니다. 사용자가 가입하면 자동으로 팀원으로 연결됩니다.'
          : '팀원이 추가되었습니다.',
      });
    },
    onError: (err) =>
      toast({ title: '초대 실패', description: String(err.message || err), variant: 'destructive' }),
  });

  const permissionMutation = useMutation({
    mutationFn: ({ id, allowed_tabs, team_role }) => base44.functions.invoke('updateMemberPermissions', { target_user_id: id, allowed_tabs, team_role: team_role || 'member' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sub-accounts'] });
      setPermissionUser(null);
      toast({ title: '메뉴 권한 저장 완료' });
    },
    onError: (err) => toast({ title: '권한 저장 실패', description: String(err.message || err), variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      base44.functions.invoke('toggleUserActive', { target_user_id: id, is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-sub-accounts'] }),
    onError: (err) =>
      toast({ title: '상태 변경 실패', description: String(err.message || err), variant: 'destructive' }),
  });

  if (me === null) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!isServiceAdmin) {
    return (
      <Card className="p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
        <p className="mt-4 text-lg font-semibold">접근 권한이 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">
          서비스 관리자만 팀을 관리할 수 있습니다.
        </p>
      </Card>
    );
  }

  const subs = data?.subs || [];
  const pending = data?.pending || [];
  const activeCount = subs.filter((u) => u.is_active !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
            <UserCog className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">팀 관리</h1>
            <p className="text-sm text-muted-foreground">하위 계정을 초대하고 활성 상태를 관리합니다</p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />팀원 초대
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatBox label="전체 팀원" value={subs.length} />
        <StatBox label="활성 계정" value={activeCount} />
        <StatBox label="대기 중인 초대" value={pending.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />팀원 ({subs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : subs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              등록된 팀원이 없습니다. 우측 상단에서 초대해 보세요.
            </div>
          ) : (
            subs.map((u) => (
              <UserAccountRow
                key={u.id}
                user={u}
                onToggle={(is_active) => toggleMutation.mutate({ id: u.id, is_active })}
                onPermissions={() => setPermissionUser({ ...u, allowed_tabs: u.allowed_tabs || [] })}
                disabled={toggleMutation.isPending}
              />
            ))
          )}
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />대기 중인 초대 ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.email}</p>
                  {p.account_label && (
                    <p className="text-xs text-muted-foreground truncate">{p.account_label}</p>
                  )}
                </div>
                <span className="text-xs text-amber-600 font-medium">가입 대기 중</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀원 초대</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate({ email, account_label: label, allowed_tabs: allowedTabs });
            }}
            className="space-y-4 pt-2"
          >
            <div>
              <Label className="text-xs">이메일</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@company.com"
              />
            </div>
            <div>
              <Label className="text-xs">표시 이름 (선택)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: 영업팀 김OO"
              />
            </div>
            <div>
              <Label className="text-xs">접근 허용 메뉴</Label>
              <PermissionPicker value={allowedTabs} onChange={setAllowedTabs} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>취소</Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                초대 발송
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!permissionUser} onOpenChange={(open) => !open && setPermissionUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>팀원 메뉴 권한</DialogTitle></DialogHeader>
          {permissionUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{permissionUser.email}</p>
              <PermissionPicker
                value={permissionUser.allowed_tabs}
                onChange={(allowed_tabs) => setPermissionUser({ ...permissionUser, allowed_tabs })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPermissionUser(null)}>취소</Button>
                <Button
                  disabled={permissionMutation.isPending}
                  onClick={() => permissionMutation.mutate({ id: permissionUser.id, allowed_tabs: permissionUser.allowed_tabs, team_role: permissionUser.team_role })}
                >저장</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 text-center">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}