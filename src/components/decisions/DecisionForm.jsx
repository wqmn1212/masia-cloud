import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { CATEGORY_LABELS, STATUS_META } from './decisionMeta';

const EMPTY = {
  topic: '', category: 'OTHER', decision: '', rationale: '',
  alternatives: [], status: 'CONFIRMED', reverse_reason: '',
  decided_by: '', decided_at: '', source_ref: '', impact_note: '', card_id: '',
};

export default function DecisionForm({ open, onClose, onSave, initial, cards = [], fixedCardId }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...(initial || {}), card_id: fixedCardId || initial?.card_id || '' });
  }, [open, initial, fixedCardId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAlt = (i, k, v) => setForm(f => ({ ...f, alternatives: f.alternatives.map((a, idx) => idx === i ? { ...a, [k]: v } : a) }));

  const submit = () => {
    if (!form.topic.trim() || !form.decision.trim()) return;
    const data = { ...form, alternatives: form.alternatives.filter(a => a.option?.trim()) };
    if (!data.card_id) delete data.card_id;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? '결정 기록 수정' : '결정 기록 추가'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">결정 주제 *</Label>
              <Input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="예: N30 전극 표면 마감" />
            </div>
            <div>
              <Label className="text-xs">분류</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!fixedCardId && (
            <div>
              <Label className="text-xs">연결 카드 (선택)</Label>
              <Select value={form.card_id || 'none'} onValueChange={v => set('card_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="없음" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">확정 내용 *</Label>
            <Textarea rows={2} value={form.decision} onChange={e => set('decision', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">근거</Label>
            <Textarea rows={2} value={form.rationale} onChange={e => set('rationale', e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">기각된 대안</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => setForm(f => ({ ...f, alternatives: [...f.alternatives, { option: '', reject_reason: '' }] }))}>
                <Plus className="w-3 h-3 mr-1" />대안 추가
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {form.alternatives.map((alt, i) => (
                <div key={i} className="border rounded-md p-2 space-y-1.5 relative">
                  <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setForm(f => ({ ...f, alternatives: f.alternatives.filter((_, idx) => idx !== i) }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <Input className="h-8 text-xs pr-8" placeholder="대안 내용" value={alt.option} onChange={e => setAlt(i, 'option', e.target.value)} />
                  <Textarea rows={2} className="text-xs" placeholder="기각 사유" value={alt.reject_reason} onChange={e => setAlt(i, 'reject_reason', e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">상태</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">결정일</Label>
              <Input type="date" value={form.decided_at} onChange={e => set('decided_at', e.target.value)} />
            </div>
          </div>

          {(form.status === 'REVERSED' || form.status === 'SUPERSEDED') && (
            <div>
              <Label className="text-xs">번복 사유</Label>
              <Textarea rows={2} value={form.reverse_reason} onChange={e => set('reverse_reason', e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">결정자</Label>
              <Input value={form.decided_by} onChange={e => set('decided_by', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">근거 문서·회의록</Label>
              <Input value={form.source_ref} onChange={e => set('source_ref', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">영향 (원가·납기·인증)</Label>
              <Input value={form.impact_note} onChange={e => set('impact_note', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={submit} disabled={!form.topic.trim() || !form.decision.trim()}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}