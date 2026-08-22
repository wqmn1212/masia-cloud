import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Library, CornerDownLeft, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { CLAUSE_CATEGORIES, DEFAULT_CLAUSES } from '@/lib/contractClauses';
import ClauseRow from './ClauseRow';
import ClauseFormDialog from './ClauseFormDialog';

export default function ClauseLibraryPanel({ onInsert }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: clauses = [] } = useQuery({
    queryKey: ['contract-clauses'],
    queryFn: () => base44.entities.ContractClause.list('-is_favorite', 300),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contract-clauses'] });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.ContractClause.update(editing.id, data)
      : base44.entities.ContractClause.create(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); setEditing(null); },
  });

  const favoriteMutation = useMutation({
    mutationFn: (clause) => base44.entities.ContractClause.update(clause.id, { is_favorite: !clause.is_favorite }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContractClause.delete(id),
    onSuccess: () => { invalidate(); setSelected([]); },
  });

  const seedMutation = useMutation({
    mutationFn: () => base44.entities.ContractClause.bulkCreate(DEFAULT_CLAUSES),
    onSuccess: () => { invalidate(); toast({ title: '기본 특약 조항을 등록했습니다.' }); },
  });

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const insert = () => {
    const picked = clauses.filter(c => selected.includes(c.id));
    if (picked.length === 0) return;
    onInsert(picked);
    picked.forEach(c => base44.entities.ContractClause.update(c.id, { usage_count: (c.usage_count || 0) + 1 }));
    setSelected([]);
    toast({ title: `${picked.length}개 조항을 계약서에 삽입했습니다.` });
  };

  const filtered = clauses.filter(c => {
    const byCat = filter === 'ALL' || c.category === filter;
    const q = search.trim().toLowerCase();
    const bySearch = !q || `${c.title} ${c.body}`.toLowerCase().includes(q);
    return byCat && bySearch;
  });

  return (
    <Card className="h-fit">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">공통 조항 라이브러리</p>
          </div>
          <div className="flex gap-1">
            {clauses.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Download className="w-3.5 h-3.5 mr-1" />기본 조항
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />추가
            </Button>
          </div>
        </div>

        <Input placeholder="조항 검색" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="flex gap-1.5 flex-wrap">
          {['ALL', ...Object.keys(CLAUSE_CATEGORIES)].map(cat => (
            <Button key={cat} size="sm" variant={filter === cat ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(cat)}>
              {cat === 'ALL' ? '전체' : CLAUSE_CATEGORIES[cat]}
            </Button>
          ))}
        </div>

        <Button className="w-full" disabled={selected.length === 0} onClick={insert}>
          <CornerDownLeft className="w-4 h-4 mr-2" />선택 조항 삽입 ({selected.length})
        </Button>

        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">등록된 조항이 없습니다.</p>
          ) : filtered.map(c => (
            <ClauseRow
              key={c.id}
              clause={c}
              checked={selected.includes(c.id)}
              onToggle={toggle}
              onEdit={(clause) => { setEditing(clause); setDialogOpen(true); }}
              onDelete={(id) => deleteMutation.mutate(id)}
              onToggleFavorite={(clause) => favoriteMutation.mutate(clause)}
            />
          ))}
        </div>
      </CardContent>

      <ClauseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clause={editing}
        onSubmit={(data) => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />
    </Card>
  );
}