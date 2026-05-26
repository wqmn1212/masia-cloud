import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Shield, Loader2, AlertTriangle, Mail, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import UserAccountRow from '@/components/admin/UserAccountRow';

export default function MasterAdminDashboard() {
  const [setupStatus, setSetupStatus] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 마스터 셋업 / 권한 체크
  useEffect(() => {
    base44.functions.invoke('setupMasterAdmin', {})
      .then((res) => setSetupStatus(res.data?.status || 'error'))
      .catch(() => setSetupStatus('error'));
  }, []);

  const isMaster = setupStatus === 'is_master' || setupStatus === 'became_master';

  const { data, isLoading } = useQuery({
    queryKey: ['service-admins'],
    queryFn: async () => (await base44.functions.invoke('listServiceAdmins', {})).data,
    enabled: isMaster,
  });

  const inviteMutation = useMutation({
    mutationFn: (body) => base44.functions.invoke('inviteServiceAdmin', body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['service-admins'] });
      setInviteOpen(false);
      setEmail('');
      setLabel('');
      toast({
        title: '초대 완료',
        description: res.data?.pending
          ? '초대장이 발송되었습니다. 사용자가 가입하면 자동으로 서비스 관리자로 지정됩니다.'
          : '서비스 관리자로 등록되었습니다.',
      });
    },
    onError: (err) =>
      toast({ title: '초대 실패', description: String(err.message || err), variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      base44.functions.invoke('toggleUserActive', { target_user_id: id, is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-admins'] }),
    onError: (err) =>
      toast({ title: '상태 변경 실패', description: String(err.message || err), variant: 'destructive' }),
  });

  if (setupStatus === null) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (setupStatus === 'master_exists' || setupStatus === 'not_eligible' || setupStatus === 'error') {
    return (
      <Card className="p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
        <p className="mt-4 text-lg font-semibold">접근 권한이 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">
          {setupStatus === 'master_exists'
            ? '이미 다른 사용자가 마스터 관리자로 지정되어 있습니다.'
            : '마스터 관리자 권한이 없습니다.'}
        </p>
      </Card>
    );
  }

  const serviceAdmins = data?.serviceAdmins || [];
  const pending = data?.pending || [];
  const activeCount = serviceAdmins.filter((u) => u.is_active !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">마스터 관리자 대시보드</h1>
            <p className="text-sm text-muted-foreground">서비스 관리자 계정을 초대하고 활성 상태를 관리합니다</p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />서비스 관리자 초대
        </Button>
      </div>

      {setupStatus === 'became_master' && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 text-sm text-green-800">
            ✅ 마스터 관리자로 지정되었습니다.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatBox label="전체 서비스 관리자" value={serviceAdmins.length} />
        <StatBox label="활성 계정" value={activeCount} />
        <StatBox label="대기 중인 초대" value={pending.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />서비스 관리자 ({serviceAdmins.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : serviceAdmins.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              등록된 서비스 관리자가 없습니다
            </div>
          ) : (
            serviceAdmins.map((u) => (
              <UserAccountRow
                key={u.id}
                user={u}
                onToggle={(is_active) => toggleMutation.mutate({ id: u.id, is_active })}
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
            <DialogTitle>서비스 관리자 초대</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate({ email, account_label: label });
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
                placeholder="admin@company.com"
              />
            </div>
            <div>
              <Label className="text-xs">회사/팀 이름 (선택)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: 마시아 코리아"
              />
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