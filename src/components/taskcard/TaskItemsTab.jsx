import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, CheckCircle2, Circle, Clock, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_META = {
  TODO:        { label: '대기',   icon: Circle,        className: 'text-muted-foreground' },
  IN_PROGRESS: { label: '진행 중', icon: Clock,         className: 'text-chart-3' },
  DONE:        { label: '완료',   icon: CheckCircle2,  className: 'text-primary' },
};

const PRIORITY_META = {
  LOW:    { label: '낙음',  className: 'bg-muted text-muted-foreground',              borderColor: '#94a3b8' },
  MEDIUM: { label: '보통',  className: 'bg-chart-3/15 text-chart-3',                 borderColor: '#f59e0b' },
  HIGH:   { label: '높음',  className: 'bg-destructive/15 text-destructive',          borderColor: '#f97316' },
  URGENT: { label: '긴급',  className: 'bg-destructive text-destructive-foreground', borderColor: '#ef4444' },
};

const STATUS_BORDER = { TODO: '#9ca3af', IN_PROGRESS: '#fbbf24', DONE: '#60a5fa' };

const emptyForm = { title: '', description: '', status: 'TODO', due_date: '', assignee_name: '', priority: 'MEDIUM' };

export default function TaskItemsTab({ card }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['task-items', card.id],
    queryFn: () => base44.entities.TaskItem.filter({ card_id: card.id }, 'created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskItem.create({ ...data, card_id: card.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-items', card.id] });
      setForm(emptyForm);
      setShowForm(false);
      toast({ title: '업무 추가 완료' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaskItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-items', card.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-items', card.id] });
      toast({ title: '업무 삭제됨' });
    },
  });

  const todoCount = items.filter(i => i.status === 'TODO').length;
  const inProgressCount = items.filter(i => i.status === 'IN_PROGRESS').length;
  const doneCount = items.filter(i => i.status === 'DONE').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border text-xs">
          <span className="font-semibold text-muted-foreground">총 {items.length}개</span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1"><Circle className="w-3 h-3 text-muted-foreground" /> 대기 {todoCount}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-chart-3" /> 진행 {inProgressCount}</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> 완료 {doneCount}</span>
          <div className="ml-auto flex-1 max-w-[120px] h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: items.length ? `${Math.round((doneCount / items.length) * 100)}%` : '0%' }}
            />
          </div>
          <span className="text-muted-foreground">{items.length ? Math.round((doneCount / items.length) * 100) : 0}%</span>
        </div>
      )}

      {/* Item list */}
      {isLoading && <p className="text-xs text-muted-foreground py-4 text-center">로딩 중...</p>}

      {!isLoading && items.length === 0 && !showForm && (
        <div className="text-center py-10 text-muted-foreground space-y-1">
          <p className="text-sm font-medium">등록된 세부 업무가 없습니다</p>
          <p className="text-xs">견적 요청, 부품 확인, 도색 변경 등의 업무를 추가하세요</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const st = STATUS_META[item.status] || STATUS_META.TODO;
          const StatusIcon = st.icon;
          const isExpanded = expandedId === item.id;

          return (
            <div key={item.id} className="rounded-xl border bg-card overflow-hidden"
              style={{ borderLeft: `4px solid ${PRIORITY_META[item.priority]?.borderColor || STATUS_BORDER[item.status] || '#e2e8f0'}` }}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Status toggle */}
                <button
                  onClick={() => {
                    const next = item.status === 'TODO' ? 'IN_PROGRESS' : item.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
                    updateMutation.mutate({ id: item.id, data: { status: next } });
                  }}
                  className="shrink-0"
                  title="클릭하여 상태 변경"
                >
                  <StatusIcon className={`w-4 h-4 ${st.className}`} />
                </button>

                {/* Title */}
                <span className={`flex-1 text-sm font-medium ${item.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.title}
                </span>

                {/* Meta badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.priority && item.priority !== 'MEDIUM' && (
                    <Badge className={`${PRIORITY_META[item.priority]?.className} border-0 text-[9px] h-4 px-1`}>
                      {PRIORITY_META[item.priority]?.label}
                    </Badge>
                  )}
                  {item.due_date && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />{item.due_date}
                    </span>
                  )}
                  {item.assignee_name && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {item.assignee_name}
                    </span>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="text-muted-foreground hover:text-foreground p-0.5">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t px-3 py-3 space-y-3 bg-muted/20">
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">상태</Label>
                      <Select value={item.status} onValueChange={(v) => updateMutation.mutate({ id: item.id, data: { status: v } })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">마감일</Label>
                      <Input type="date" defaultValue={item.due_date} className="h-7 text-xs"
                        onBlur={(e) => e.target.value !== item.due_date && updateMutation.mutate({ id: item.id, data: { due_date: e.target.value } })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">담당자</Label>
                      <Input defaultValue={item.assignee_name} placeholder="이름" className="h-7 text-xs"
                        onBlur={(e) => e.target.value !== item.assignee_name && updateMutation.mutate({ id: item.id, data: { assignee_name: e.target.value } })} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div>
            <Label className="text-xs">업무 제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="예: 견적 요청, 부품 확인, 도색 변경 협의"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">상세 내용</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="업무 상세 설명 (선택)"
              rows={2}
              className="text-xs"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">우선순위</Label>
              <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">마감일</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm(p => ({ ...p, due_date: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">담당자</Label>
              <Input value={form.assignee_name} onChange={(e) => setForm(p => ({ ...p, assignee_name: e.target.value }))} placeholder="이름" className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(emptyForm); }}>취소</Button>
            <Button size="sm" onClick={() => form.title && createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}>
              추가
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> 세부 업무 추가
        </Button>
      )}
    </div>
  );
}