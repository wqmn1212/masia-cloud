import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ConfirmTypeDialog from '@/components/admin/ConfirmTypeDialog';

export default function TeamDeleteDialog({ tenant, onOpenChange, onConfirm, pending }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-impact', tenant?.id],
    queryFn: async () => (await base44.functions.invoke('masterAdminControl', { action: 'tenant_impact', tenant_id: tenant.id })).data,
    enabled: !!tenant,
  });
  return (
    <ConfirmTypeDialog open={!!tenant} onOpenChange={onOpenChange} title={`팀 삭제 · ${tenant?.name || ''}`} expected={tenant?.name} onConfirm={onConfirm} pending={pending}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
          <p>소속 계정 {data?.member_count || 0}명은 모두 <b>비활성</b> 처리됩니다.</p>
          <p>대기 중인 초대 {data?.invite_count || 0}건은 취소됩니다.</p>
          <p>{data?.has_data ? '남아 있는 업무 데이터(카드·견적 등)는 삭제되지 않고 보존되지만, 어떤 팀에도 속하지 않게 됩니다.' : '남아 있는 업무 데이터가 없습니다.'}</p>
          <p className="font-medium">이 작업은 되돌릴 수 없습니다.</p>
        </div>
      )}
    </ConfirmTypeDialog>
  );
}