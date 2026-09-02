import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import LeadRow from '@/components/leads/LeadRow';
import LeadDetailDialog from '@/components/leads/LeadDetailDialog';
import { LEAD_STATUS } from '@/components/leads/leadMeta';

export default function Leads() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['manufacturing-leads'],
    queryFn: () => base44.entities.ManufacturingLead.list('-created_date', 300),
  });

  const save = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ManufacturingLead.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing-leads'] });
      toast({ title: '저장되었습니다' });
      setSelected(null);
    },
  });

  const counts = useMemo(() => {
    const c = { all: leads.length };
    LEAD_STATUS.forEach((s) => { c[s.key] = leads.filter((l) => l.status === s.key).length; });
    return c;
  }, [leads]);

  const visible = filter === 'all' ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">문의 접수</h1>
        <p className="text-sm text-muted-foreground mt-1">랜딩 페이지에서 접수된 제조 문의 · 신규 {counts.new || 0}건</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[{ key: 'all', label: '전체' }, ...LEAD_STATUS].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === s.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent text-muted-foreground border-border'
            }`}
          >
            {s.label}<span className="ml-1 opacity-70">({counts[s.key] || 0})</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="mt-4 font-semibold">접수된 문의가 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">랜딩 페이지 문의 폼으로 접수되면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">접수일</th>
                  <th className="px-4 py-2.5 font-medium">회사 / 담당자</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">카테고리</th>
                  <th className="px-4 py-2.5 font-medium hidden lg:table-cell">수량</th>
                  <th className="px-4 py-2.5 font-medium hidden lg:table-cell">첨부</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">담당</th>
                  <th className="px-4 py-2.5 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => <LeadRow key={l.id} lead={l} onClick={() => setSelected(l)} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LeadDetailDialog
        lead={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSave={(id, data) => save.mutate({ id, data })}
        saving={save.isPending}
      />
    </div>
  );
}