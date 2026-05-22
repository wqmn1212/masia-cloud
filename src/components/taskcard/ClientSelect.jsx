import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';

export default function ClientSelect({ value, onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['companies-client'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name'),
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Company.create({ company_type: 'CLIENT', company_name: name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['companies-client'] });
      onChange({ id: created.id, name: created.company_name });
      setNewName('');
      setShowAdd(false);
    },
  });

  if (showAdd) {
    return (
      <div className="flex gap-1">
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="고객사명 입력"
          className="h-9 text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newName.trim()) createMutation.mutate(newName.trim()); } }}
        />
        <Button type="button" size="icon" className="h-9 w-9 shrink-0" onClick={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }} disabled={createMutation.isPending}>
          <Plus className="w-4 h-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setShowAdd(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <Select value={value || ''} onValueChange={(id) => {
        const c = clients.find(x => x.id === id);
        if (c) onChange({ id: c.id, name: c.company_name });
      }}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="고객사 선택" />
        </SelectTrigger>
        <SelectContent>
          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setShowAdd(true)} title="신규 고객사 추가">
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}