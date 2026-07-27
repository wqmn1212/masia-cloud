import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TeamPermissionGrid from '@/components/admin/TeamPermissionGrid';

export default function MasterTeamDashboard() {
  const { tenantId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['service-admins'],
    queryFn: async () => (await base44.functions.invoke('listServiceAdmins', {})).data,
  });
  if (isLoading) return <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-muted-foreground" />;
  const tenant = data?.tenants?.find((item) => item.id === tenantId);
  if (!tenant) return <p className="py-20 text-center text-sm text-muted-foreground">팀을 찾을 수 없습니다.</p>;
  const admin = data?.serviceAdmins?.find((item) => item.tenant_id === tenant.id);
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/master-admin"><ArrowLeft />팀 목록</Link></Button>
      <div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-primary" /><div><h1 className="text-2xl font-bold">{tenant.name} 대시보드</h1><p className="text-sm text-muted-foreground">팀 마스터: {admin?.email || tenant.master_email || '미지정'}</p></div></div>
      <Card><CardHeader><CardTitle className="text-base">전체 기능 접근</CardTitle></CardHeader><CardContent><TeamPermissionGrid tenantId={tenant.id} /></CardContent></Card>
    </div>
  );
}