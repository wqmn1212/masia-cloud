import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CLAUSE_CATEGORIES } from '@/lib/contractClauses';

const EMPTY = { category: 'ETC', title: '', body: '' };

export default function ClauseFormDialog({ open, onOpenChange, clause, onSubmit, isPending }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    setForm(clause ? { category: clause.category || 'ETC', title: clause.title || '', body: clause.body || '' } : EMPTY);
  }, [clause, open]);

  const change = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw]">
        <DialogHeader>
          <DialogTitle>{clause ? '조항 수정' : '조항 추가'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div>
            <Label>분류</Label>
            <Select value={form.category} onValueChange={(v) => change('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CLAUSE_CATEGORIES).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>조항 제목</Label>
            <Input value={form.title} onChange={(e) => change('title', e.target.value)} required />
          </div>
          <div>
            <Label>조항 본문</Label>
            <Textarea value={form.body} onChange={(e) => change('body', e.target.value)} rows={6} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={isPending}>저장</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}