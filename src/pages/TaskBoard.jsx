import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, MessageSquare, Paperclip, LayoutGrid } from 'lucide-react';
import CardModal from '@/components/taskcard/CardModal';
import CategorySelect from '@/components/taskcard/CategorySelect';

const COLUMNS = [
  { id: 'TODO',        label: '대기 중',    color: 'bg-muted/60',         dotColor: 'bg-muted-foreground' },
  { id: 'IN_PROGRESS', label: '소싱 중',    color: 'bg-chart-3/10',       dotColor: 'bg-chart-3' },
  { id: 'REVIEW',      label: '견적 검토',  color: 'bg-accent/10',        dotColor: 'bg-accent' },
  { id: 'PRODUCTION',  label: '발주·제작', color: 'bg-chart-4/10',       dotColor: 'bg-chart-4' },
  { id: 'DONE',        label: '완료',       color: 'bg-primary/10',       dotColor: 'bg-primary' },
];

const PRIORITY_META = {
  LOW:    { label: '낮음',   className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: '보통',   className: 'bg-chart-3/15 text-chart-3' },
  HIGH:   { label: '높음',   className: 'bg-destructive/15 text-destructive' },
  URGENT: { label: '긴급',   className: 'bg-destructive text-destructive-foreground' },
};

const CAT_LABEL = {
  DRIP_BAG: '드립백', SLEEVE: '슬리브', DESKTOP_LABELER: '탁상 라벨러', TUBE_SEALER: '튜브 실링기',
};

function useCategoryLabel(key) {
  return CAT_LABEL[key] || key || '';
}

const emptyForm = {
  title: '', status: 'TODO', target_machine_category: '',
  client_name: '', factory_name: '', priority: 'MEDIUM',
};

export default function TaskBoard() {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCard, setSelectedCard] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categoryList = [] } = useQuery({
    queryKey: ['machine-categories'],
    queryFn: () => base44.entities.MachineCategory.list('label_kr', 100),
  });
  const catMap = React.useMemo(() => {
    const m = { DRIP_BAG: '드립백', SLEEVE: '슬리브', DESKTOP_LABELER: '탁상 라벨러', TUBE_SEALER: '튜브 실링기' };
    categoryList.forEach(c => { if (c.key) m[c.key] = c.label_kr; });
    return m;
  }, [categoryList]);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['task-cards'],
    queryFn: () => base44.entities.TaskCard.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskCard.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-cards'] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast({ title: '카드 생성 완료' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.TaskCard.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-cards'] }),
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const card = cards.find(c => c.id === draggableId);
    if (card && card.status !== newStatus) {
      updateStatusMutation.mutate({ id: draggableId, status: newStatus });
    }
  };

  const columnCards = (colId) => cards.filter(c => c.status === colId);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" /> 소싱 칸반 보드
          </h1>
          <p className="text-sm text-muted-foreground mt-1">업무 카드 기반 HQ ↔ 에이전트 협업 플랫폼</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />신규 카드 생성
        </Button>
      </div>

      {/* Status Summary Widget */}
      <div className="grid grid-cols-5 gap-2">
        {COLUMNS.map((col) => {
          const count = columnCards(col.id).length;
          const total = cards.length || 1;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={col.id} className={`rounded-xl border p-3 space-y-2 ${col.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-medium">{col.label}</span>
                </div>
                <span className="text-lg font-bold">{count}</span>
              </div>
              <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${col.dotColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{pct}% 점유</p>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '600px' }}>
          {COLUMNS.map((col) => {
            const colCards = columnCards(col.id);
            return (
              <div key={col.id} className="flex-shrink-0 w-64">
                {/* Column header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${col.color} border border-border border-b-0`}>
                  <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">{colCards.length}</Badge>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[500px] p-2 rounded-b-xl border border-border border-t-0 space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-primary/5' : col.color
                      }`}
                    >
                      {isLoading && colCards.length === 0 && (
                        <div className="space-y-2">
                          {[1,2].map(i => <div key={i} className="h-20 rounded-xl bg-muted/60 animate-pulse" />)}
                        </div>
                      )}

                      {colCards.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => setSelectedCard(card)}
                              className={`bg-card rounded-xl border p-3 cursor-pointer space-y-2 transition-shadow ${
                                snap.isDragging ? 'shadow-xl ring-2 ring-primary/40' : 'hover:shadow-md'
                              }`}
                            >
                              {/* Priority + category */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {card.priority && card.priority !== 'MEDIUM' && (
                                  <Badge className={`${PRIORITY_META[card.priority]?.className} border-0 text-[9px] h-4 px-1`}>
                                    {PRIORITY_META[card.priority]?.label}
                                  </Badge>
                                )}
                                {card.target_machine_category && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1">{catMap[card.target_machine_category] || card.target_machine_category}</Badge>
                                )}
                              </div>

                              <p className="text-sm font-medium leading-snug line-clamp-2">{card.title}</p>

                              {(card.client_name || card.factory_name) && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {card.client_name}{card.client_name && card.factory_name && ' · '}{card.factory_name}
                                </p>
                              )}

                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                                <MessageSquare className="w-3 h-3" />
                                <span>채팅</span>
                                <Paperclip className="w-3 h-3 ml-1" />
                                <span>파일</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Create Card Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>신규 소싱 카드 생성</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label className="text-xs">업무 제목 *</Label>
              <Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="예: (주)카페로스팅 드립백 포장기 소싱" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">장비 카테고리</Label>
                <CategorySelect
                  value={form.target_machine_category}
                  onValueChange={(v) => setForm(p => ({ ...p, target_machine_category: v }))}
                />
              </div>
              <div>
                <Label className="text-xs">우선순위</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">고객사</Label>
                <Input value={form.client_name} onChange={(e) => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="고객사명" />
              </div>
              <div>
                <Label className="text-xs">공장 (선택)</Label>
                <Input value={form.factory_name} onChange={(e) => setForm(p => ({ ...p, factory_name: e.target.value }))} placeholder="공장명" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
              <Button type="submit" disabled={createMutation.isPending}>생성</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          open={!!selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}