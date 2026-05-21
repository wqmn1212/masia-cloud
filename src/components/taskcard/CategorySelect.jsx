import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';

export default function CategorySelect({ value, onValueChange, placeholder = '장비 카테고리 선택' }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['machine-categories'],
    queryFn: () => base44.entities.MachineCategory.list('label_kr', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MachineCategory.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['machine-categories'] });
      onValueChange(created.key);
      setAdding(false);
      setNewLabel('');
    },
  });

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    // Generate key: try English-safe version, fallback to CAT_ + timestamp
    let key = newLabel.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    if (!key) key = 'CAT_' + Date.now();
    createMutation.mutate({ key, label_kr: newLabel.trim() });
  };

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input
          autoFocus
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 카테고리명 입력"
          className="h-9 text-sm"
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="shrink-0 h-9 px-3">
          {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '추가'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)} className="shrink-0 h-9 px-2">취소</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Select value={value || ''} onValueChange={onValueChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={isLoading ? '로딩 중...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {categories.filter(c => !!c.key).map((c) => (
            <SelectItem key={c.id} value={c.key}>{c.label_kr}</SelectItem>
          ))}
          {categories.length === 0 && !isLoading && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">카테고리를 추가해주세요</div>
          )}
        </SelectContent>
      </Select>
      <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setAdding(true)} title="카테고리 추가">
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}