import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserCog } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import AccountDirectory from '@/components/admin/AccountDirectory';
import ConfirmTypeDialog from '@/components/admin/ConfirmTypeDialog';

const errMsg = (e) => e?.response?.data?.error || e.message;

export default function MasterAccountsPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [target, setTarget] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['master-all-accounts'],
    queryFn: async () => (await base44.functions.invoke('masterAdminControl', { action: 'list_all' })).data,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['master-all-accounts'] }); qc.invalidateQueries({ queryKey: ['service-admins'] }); };
  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => base44.functions.invoke('toggleUserActive', { target_user_id: id, is_active }),
    onSuccess: refresh,
    onError: (e) => toast({ title: '상태 변경 실패', description: errMsg(e), variant: 'destructive' }),
  });
  const remove = useMutation({
    mutationFn: (confirm) => base44.functions.invoke('masterAdminControl', { action: 'delete_user', target_user_id: target.id, confirm }),
    onSuccess: () => { toast({ title: '계정을 삭제했습니다', description: target.email }); setTarget(null); refresh(); },
    onError: (e) => toast({ title: '삭제 실패', description: errMsg(e), variant: 'destructive' }),
  });
  const accounts = data?.accounts || [];
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4" />전체 계정 관리 ({accounts.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        {isLoading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" /> : (
          <AccountDirectory accounts={accounts} tenants={data?.tenants || []} disabled={toggle.isPending}
            onToggle={(a, is_active) => toggle.mutate({ id: a.id, is_active })} onDelete={setTarget} />
        )}
      </CardContent>
      <ConfirmTypeDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} title="계정 삭제" expected={target?.email} onConfirm={(v) => remove.mutate(v)} pending={remove.isPending}>
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
          <p>접근만 막으려면 삭제 대신 <b>비활성</b> 스위치를 사용하세요.</p>
          <p>삭제하면 계정과 대기 중인 초대가 함께 사라지며 되돌릴 수 없습니다. 업무 기록의 담당자 이름 표기는 그대로 남습니다.</p>
        </div>
      </ConfirmTypeDialog>
    </Card>
  );
}