import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Factory, FileText, Users, Wrench } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import TaskCalendar from '@/components/calendar/TaskCalendar';
import RecentQuotations from '@/components/dashboard/RecentQuotations';
import PipelineChart from '@/components/dashboard/PipelineChart';

export default function Dashboard() {
  const { t } = useLanguage();
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
  const { data: allCards = [] } = useQuery({
    queryKey: ['task-cards'],
    queryFn: () => base44.entities.TaskCard.list('-created_date', 200),
  });
  const { data: allTaskItems = [] } = useQuery({
    queryKey: ['task-items-all'],
    queryFn: () => base44.entities.TaskItem.list('due_date', 500),
  });

  const openAS = asRequests.filter(r => r.status !== 'CLOSED' && r.status !== 'RESOLVED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.factories')} value={factories.length} icon={Factory} trend="2건" trendUp />
        <StatCard title={t('dashboard.clients')} value={clients.length} icon={Users} />
        <StatCard title={t('dashboard.quotations')} value={quotations.length} icon={FileText} trend="5건" trendUp />
        <StatCard title={t('dashboard.openAS')} value={openAS.length} icon={Wrench} subtitle={t('dashboard.asSubtitle')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineChart timelines={timelines} />
        <RecentQuotations quotations={quotations} />
      </div>

      <TaskCalendar
        cards={allCards}
        taskItems={allTaskItems}
        onCardClick={() => {}}
        onDateClick={() => {}}
      />
    </div>
  );
}