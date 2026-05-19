import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Factory, FileText, Users, Wrench } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import RecentQuotations from '@/components/dashboard/RecentQuotations';
import PipelineChart from '@/components/dashboard/PipelineChart';

export default function Dashboard() {
  const { data: factories = [] } = useQuery({
    queryKey: ['factories'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }),
  });
  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 20),
  });
  const { data: asRequests = [] } = useQuery({
    queryKey: ['as-requests'],
    queryFn: () => base44.entities.ASRequest.list('-created_date', 10),
  });
  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: () => base44.entities.ProductionTimeline.list('-created_date', 50),
  });

  const openAS = asRequests.filter(r => r.status !== 'CLOSED' && r.status !== 'RESOLVED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">마시아 클라우드 통합 현황</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="등록 공장" value={factories.length} icon={Factory} trend="2건" trendUp />
        <StatCard title="고객사" value={clients.length} icon={Users} />
        <StatCard title="진행 견적" value={quotations.length} icon={FileText} trend="5건" trendUp />
        <StatCard title="미결 AS" value={openAS.length} icon={Wrench} subtitle="접수 완료 기준" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineChart timelines={timelines} />
        <RecentQuotations quotations={quotations} />
      </div>
    </div>
  );
}