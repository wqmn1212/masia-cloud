import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

// selectedFactories: [{id, name}]
// onChange: (factories: [{id, name}]) => void
export default function FactoryMultiSelect({ selectedFactories = [], onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const queryClient = useQueryClient();

  const { data: factories = [] } = useQuery({
    queryKey: ['companies-factory'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }, 'company_name'),
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Company.create({ company_type: 'FACTORY', company_name: name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['companies-factory'] });
      addFactory({ id: created.id, name: created.company_name });
      setNewName('');
      setShowAdd(false);
    },
  });

  const addFactory = (factory) => {
    if (!selectedFactories.find(f => f.id === factory.id)) {
      onChange([...selectedFactories, factory]);
    }
  };

  const removeFactory = (id) => {
    onChange(selectedFactories.filter(f => f.id !== id));
  };

  const availableFactories = factories.filter(f => !selectedFactories.find(s => s.id === f.id));

  return (
    <div className="space-y-2">
      {/* 선택된 공장 태그 */}
      {selectedFactories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedFactories.map(f => (
            <Badge key={f.id} variant="secondary" className="gap-1 pr-1 text-xs">
              {f.name}
              <button type="button" onClick={() => removeFactory(f.id)} className="hover:text-destructive ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* 추가 UI */}
      {showAdd ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="공장명 입력"
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
      ) : (
        <div className="flex gap-1">
          <Select value="" onValueChange={(id) => {
            const f = factories.find(x => x.id === id);
            if (f) addFactory({ id: f.id, name: f.company_name });
          }}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={selectedFactories.length === 0 ? "공장 선택 (복수 가능)" : "공장 추가..."} />
            </SelectTrigger>
            <SelectContent>
              {availableFactories.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">모든 공장이 선택되었거나 등록된 공장이 없습니다</div>
              ) : (
                availableFactories.map(f => <SelectItem key={f.id} value={f.id}>{f.company_name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setShowAdd(true)} title="신규 공장 등록">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}