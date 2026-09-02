import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { LEAD_STATUS } from '@/components/leads/leadMeta';
import LeadRow from '@/components/leads/LeadRow';
import LeadDetailDialog from '@/components/leads/LeadDetailDialog';

export default function Leads() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['manufacturing-leads'],
    queryFn: () => base44.entities.ManufacturingLead.list('-created_date', 300),
  });

  const counts = useMemo(() => {
    const c = { ALL: leads.length };
    LEAD_STATUS.forEach((s) => { c[s.key] = 0; });
    leads.forEach((l) => { if (c[l.status] !== undefined) c[l.status]++; });
    return c;
  }, [leads]);

  const visible = filter === 'ALL' ? leads : leads.filter((l) => l.status === filter);
  const selected = leads.find((l) => l.id === selectedId) || null;

  const save = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ManufacturingLead.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing-leads'] });
      toast({ title: '저장되었습니다' });
      setSelectedId(null);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">문의 접수</h1>
        <p className="text-sm text-muted-foreground mt-1">랜딩 페이지에서 접수된 제조 문의 · 신규 {counts.new || 0}건</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[{ key: 'ALL', label: '전체' }, ...LEAD_STATUS].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent text-muted-foreground border-border'
            }`}
          >
            {f.label}<span className="ml-1 opacity-70">({counts[f.key] || 0})</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">접수된 문의가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>접수일</TableHead>
                  <TableHead>회사명</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>수량</TableHead>
                  <TableHead>첨부</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((l) => <LeadRow key={l.id} lead={l} onClick={() => setSelectedId(l.id)} />)}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <LeadDetailDialog
        lead={selected}
        open={!!selected}
        onClose={() => setSelectedId(null)}
        saving={save.isPending}
        onSave={(data) => save.mutate({ id: selected.id, data })}
      />
    </div>
  );
}