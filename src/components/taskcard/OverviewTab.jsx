import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Lightbulb, Plus, CheckCircle2, CalendarDays, Loader2 } from 'lucide-react';
import CategorySelect from './CategorySelect';
import ClientSelect from './ClientSelect';
import FactoryMultiSelect from './FactoryMultiSelect';
import { saveBilingual, editBilingual } from '@/lib/saveBilingual';
import BilingualField from '@/components/language/BilingualField';
import ChineseContentEditor from '@/components/language/ChineseContentEditor';

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백 포장기',
  SLEEVE: '슬리브 라벨러',
  DESKTOP_LABELER: '탁상형 라벨러',
  TUBE_SEALER: '튜브 실링기',
};

export default function OverviewTab({ card, kbAlerts, viewLang = 'KR', user }) {
  const [form, setForm] = useState({
    __bilingualDirty: {}, title: card.title || '', title_cn: card.title_cn || '',
    hq_requirements_cn: card.hq_requirements_cn || '', agent_meeting_notes_cn: card.agent_meeting_notes_cn || '',
    client_name: card.client_name || '',
    client_id: card.client_id || '',
    factory_name: card.factory_name || '',
    factory_id: card.factory_id || '',
    candidate_factory_names: card.candidate_factory_names || [],
    candidate_factory_ids: card.candidate_factory_ids || [],
    target_machine_category: card.target_machine_category || '',
    hq_requirements: card.hq_requirements || '',
    agent_meeting_notes: card.agent_meeting_notes || '',
    priority: card.priority || 'MEDIUM',
    due_date: card.due_date || '',
  });
  const [candidateFactories, setCandidateFactories] = useState(
    (card.candidate_factory_names || []).map((name, i) => ({
      id: (card.candidate_factory_ids || [])[i] || name,
      name,
    }))
  );
  const queryClient = useQueryClient();
  const initialRender = useRef(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return saveBilingual('TaskCard', data, card.id);
    },
    onMutate: () => setAutoSaveStatus('saving'),
    onSuccess: (saved, submitted) => {
      setForm(current => {
        if (Object.keys(submitted).some(key => key in current && JSON.stringify(current[key]) !== JSON.stringify(submitted[key]))) return current;
        const next = { ...current };
        for (const field of ['title', 'hq_requirements', 'agent_meeting_notes']) {
          next[field] = saved[field] || '';
          next[`${field}_cn`] = saved[`${field}_cn`] || '';
        }
        if (JSON.stringify(next) === JSON.stringify(current)) return current;
        initialRender.current = true;
        return next;
      });
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['task-cards'] });
    },
    onError: () => setAutoSaveStatus('error'),
  });

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    setAutoSaveStatus('saving');
    const timer = window.setTimeout(() => {
      updateMutation.mutate({
        ...form,
        candidate_factory_names: candidateFactories.map(factory => factory.name),
        candidate_factory_ids: candidateFactories.map(factory => factory.id),
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [form, candidateFactories]);

  const addKbAlert = (suggestion) => {
    setForm(p => ({
      ...p,
      __bilingualDirty: { ...p.__bilingualDirty, hq_requirements: true },
      hq_requirements: p.hq_requirements
        ? `${p.hq_requirements}\n\n⚠️ [권장] ${suggestion}`
        : `⚠️ [권장] ${suggestion}`,
    }));
  };

  return (
    <div className="space-y-5">
      {/* KB Alerts */}
      {kbAlerts?.length > 0 && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 space-y-2">
          <p className="text-xs font-bold text-yellow-700 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> 과거 노하우 자동 추천
          </p>
          {kbAlerts.map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <p className="text-xs text-yellow-800 flex-1">{a.issue_case}: {a.solution_parameter?.slice(0, 80)}...</p>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0 border-yellow-400 text-yellow-700"
                onClick={() => addKbAlert(`${a.issue_case} — ${a.solution_parameter}`)}>
                <Plus className="w-2.5 h-2.5 mr-1" />추가
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">업무 제목 *</Label>
        <BilingualField record={form} field="title" onChange={(key, value) => setForm(p => editBilingual(p, key, value))} />
      </div>
      <div>
        <Label className="text-xs">장비 카테고리</Label>
        <CategorySelect
          value={form.target_machine_category}
          onValueChange={(v) => setForm(p => ({ ...p, target_machine_category: v }))}
        />
      </div>
      <div>
        <Label className="text-xs flex items-center gap-1"><CalendarDays className="w-3 h-3" /> 마감일</Label>
        <Input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm(p => ({ ...p, due_date: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs">우선순위</Label>
        <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">낮음</SelectItem>
            <SelectItem value="MEDIUM">보통</SelectItem>
            <SelectItem value="HIGH">높음</SelectItem>
            <SelectItem value="URGENT">긴급</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label className="text-xs">고객사</Label>
          <ClientSelect
            value={form.client_id}
            onChange={({ id, name }) => setForm(p => ({ ...p, client_id: id, client_name: name }))}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">HQ 요구사항</Label>
        <BilingualField record={form} field="hq_requirements" multiline rows={5} onChange={(key, value) => setForm(p => editBilingual(p, key, value))} />
      </div>

      <div>
        <Label className="text-xs">에이전트 미팅 노트 / 공장 특이사항</Label>
        <BilingualField record={form} field="agent_meeting_notes" multiline rows={4} onChange={(key, value) => setForm(p => editBilingual(p, key, value))} />
      </div>

      {/* 후보 공장 목록 */}
      <div>
        <Label className="text-xs">견적 요청 후보 공장 <span className="text-muted-foreground font-normal">(복수 선택)</span></Label>
        <FactoryMultiSelect
          selectedFactories={candidateFactories}
          onChange={setCandidateFactories}
        />
      </div>

      {/* 최종 확정 공장 */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> 최종 확정 공장
        </p>
        {candidateFactories.length > 0 ? (
          <Select
            value={form.factory_id || ''}
            onValueChange={(id) => {
              const f = candidateFactories.find(x => x.id === id);
              if (f) setForm(p => ({ ...p, factory_id: f.id, factory_name: f.name }));
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="후보 공장 중 최종 확정 선택" />
            </SelectTrigger>
            <SelectContent>
              {candidateFactories.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">위에서 후보 공장을 먼저 추가하세요</p>
        )}
        {form.factory_name && (
          <p className="text-xs text-primary font-medium">✓ {form.factory_name} 확정됨</p>
        )}
      </div>

      {viewLang === 'CN' && ['master', 'service', 'sub'].includes(user?.account_tier) && <ChineseContentEditor record={card} saving={updateMutation.isPending}
        fields={[{ key: 'title', label: '业务标题' }, { key: 'hq_requirements', label: 'HQ 要求事项', multiline: true }, { key: 'agent_meeting_notes', label: '代理会谈 / 工厂备注', multiline: true }]}
        onSave={data => updateMutation.mutate({ ...data, __manualChinese: true })} />}
      <div className="flex justify-end min-h-5" aria-live="polite">
        {autoSaveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />자동 저장 중...</span>
        )}
        {autoSaveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-accent"><CheckCircle2 className="w-3.5 h-3.5" />자동 저장됨</span>
        )}
        {autoSaveStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5" />자동 저장 실패</span>
        )}
      </div>
    </div>
  );
}