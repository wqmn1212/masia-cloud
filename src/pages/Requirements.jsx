import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, CheckCircle2, Clock, Loader2, ShieldCheck, Languages } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DropZone from '@/components/ui/drop-zone';

const STATUS_FLOW = ['PENDING', 'APPROVED', 'COMPLETED', 'VERIFIED'];

const STATUS_META = {
  PENDING:   { label: '검토 중',       icon: Clock,        color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  APPROVED:  { label: '반영 확정',     icon: CheckCircle2, color: 'bg-chart-3/15 text-chart-3',    dot: 'bg-chart-3' },
  COMPLETED: { label: '공장 세팅 완료', icon: Loader2,      color: 'bg-accent/15 text-accent',      dot: 'bg-accent' },
  VERIFIED:  { label: '실물 검증 완료', icon: ShieldCheck,  color: 'bg-primary/15 text-primary',    dot: 'bg-primary' },
};

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백',
  SLEEVE: '슬리브',
  DESKTOP_LABELER: '탁상 라벨러',
  TUBE_SEALER: '튜브 실링기',
};

const TRANSLATE_PROMPT = `당신은 기계 무역 전문 번역가입니다. 다음 한국어 요구사항을 중국어 기술 지시서로 번역하세요.
반드시 아래 전문 용어 매핑을 사용하세요:
- 슬리브 라벨러 → 套标机
- 단차 → 台阶/断差
- 스펀지 압착 모듈 → 海绵块组装置  
- 초음파 실링 → 超声波封口
- 드립백 → 滴漏包
- 튜브 실링기 → 管封机
출력: 중국어 기술 지시서만 출력 (한자+영문 혼합 허용)`;

const emptyForm = { title: '', description_kr: '', description_cn: '', machine_category: '', project_label: '', status: 'PENDING' };

export default function Requirements() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [translating, setTranslating] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['requirements'],
    queryFn: () => base44.entities.ProjectRequirement.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProjectRequirement.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['requirements'] }); setCreateOpen(false); setForm(emptyForm); toast({ title: '요구사항 등록 완료' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectRequirement.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['requirements'] }); setEditItem(null); setCreateOpen(false); toast({ title: '업데이트 완료' }); },
  });

  const handleTranslate = async () => {
    if (!form.description_kr) return;
    setTranslating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${TRANSLATE_PROMPT}\n\n한국어 원문:\n${form.description_kr}`,
    });
    setForm(p => ({ ...p, description_cn: result }));
    setTranslating(false);
  };

  const handleEvidenceUpload = async (reqId, file) => {
    setUploadingEvidence(reqId);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.ProjectRequirement.update(reqId, {
      evidence_file_url: file_url,
      status: 'VERIFIED',
      agent_checked_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['requirements'] });
    setUploadingEvidence(null);
    toast({ title: '실물 증빙 업로드 완료 — 실물 검증 완료 상태로 변경됨' });
  };

  const handleAdvanceStatus = async (req) => {
    const idx = STATUS_FLOW.indexOf(req.status);
    if (idx >= STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[idx + 1];
    // COMPLETED → VERIFIED requires evidence upload
    if (nextStatus === 'VERIFIED') return;
    const updateData = { status: nextStatus };
    // Auto-translate on APPROVED
    if (nextStatus === 'APPROVED' && req.description_kr && !req.description_cn) {
      const cn = await base44.integrations.Core.InvokeLLM({
        prompt: `${TRANSLATE_PROMPT}\n\n한국어 원문:\n${req.description_kr}`,
      });
      updateData.description_cn = cn;
    }
    updateMutation.mutate({ id: req.id, data: updateData });
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...emptyForm, ...item });
    setCreateOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editItem) updateMutation.mutate({ id: editItem.id, data: form });
    else createMutation.mutate(form);
  };

  const filtered = filterStatus === 'ALL' ? requirements : requirements.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">3자 요구사항 트래커</h1>
          <p className="text-sm text-muted-foreground mt-1">고객 → HQ 승인 → 에이전트 세팅 → 실물 검증 4단계 추적</p>
        </div>
        <Button onClick={() => { setEditItem(null); setForm(emptyForm); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />요구사항 등록
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', ...STATUS_FLOW].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s === 'ALL' ? '전체' : STATUS_META[s].label}
            {s !== 'ALL' && (
              <span className="ml-1.5 opacity-70">{requirements.filter(r => r.status === s).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Kanban-style list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-24 animate-pulse bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="mt-4 font-semibold text-muted-foreground">등록된 요구사항이 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const meta = STATUS_META[req.status] || STATUS_META.PENDING;
            const statusIdx = STATUS_FLOW.indexOf(req.status);
            const canAdvance = statusIdx < STATUS_FLOW.length - 1 && req.status !== 'COMPLETED';
            const needsEvidence = req.status === 'COMPLETED';

            return (
              <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Progress dots */}
                    <div className="hidden md:flex items-center gap-1 pt-1">
                      {STATUS_FLOW.map((s, i) => (
                        <React.Fragment key={s}>
                          <div className={`w-2.5 h-2.5 rounded-full ${i <= statusIdx ? STATUS_META[s].dot : 'bg-border'}`} />
                          {i < STATUS_FLOW.length - 1 && <div className={`w-4 h-0.5 ${i < statusIdx ? 'bg-primary' : 'bg-border'}`} />}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm">{req.title}</p>
                          {req.project_label && <p className="text-xs text-muted-foreground">{req.project_label}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {req.machine_category && (
                            <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[req.machine_category] || req.machine_category}</Badge>
                          )}
                          <Badge className={`${meta.color} border-0 text-[10px]`}>{meta.label}</Badge>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{req.description_kr}</p>

                      {req.description_cn && (
                        <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border">
                          <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            <Languages className="w-3 h-3" /> 중문 기술 지시서
                          </p>
                          <p className="text-xs text-foreground/80">{req.description_cn}</p>
                        </div>
                      )}

                      {req.evidence_file_url && (
                        <a href={req.evidence_file_url} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline">
                          <ShieldCheck className="w-3 h-3" /> 실물 증빙 파일 확인
                        </a>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col items-center gap-2 md:w-36">
                      {canAdvance && (
                        <Button size="sm" className="w-full text-xs h-8" onClick={() => handleAdvanceStatus(req)}
                          disabled={updateMutation.isPending}>
                          {req.status === 'PENDING' ? '승인하기' : '완료 처리'}
                        </Button>
                      )}

                      {needsEvidence && (
                        <DropZone
                          onFile={(file) => handleEvidenceUpload(req.id, file)}
                          uploading={uploadingEvidence === req.id}
                          accept="image/*,video/*"
                          compact
                          label="실물 증빙 업로드"
                          className="w-full"
                        />
                      )}

                      <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => openEdit(req)}>수정</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? '요구사항 수정' : '신규 요구사항 등록'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">프로젝트 (공장명/고객사)</Label>
                <Input value={form.project_label || ''} onChange={(e) => setForm(p => ({ ...p, project_label: e.target.value }))} placeholder="예: DBM-5000 / (주)카페로스팅" />
              </div>
              <div>
                <Label className="text-xs">장비 카테고리</Label>
                <Select value={form.machine_category || ''} onValueChange={(v) => setForm(p => ({ ...p, machine_category: v }))}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">요구사항 제목 *</Label>
              <Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="예: 단차 구간 스펀지 압착 모듈 추가" />
            </div>

            <div>
              <Label className="text-xs">한국어 요구사항 상세 *</Label>
              <Textarea value={form.description_kr} onChange={(e) => setForm(p => ({ ...p, description_kr: e.target.value }))} required rows={3} placeholder="고객사 요구사항을 한국어로 상세 작성하세요" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">중문 기술 지시서 (AI 번역)</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleTranslate} disabled={translating || !form.description_kr}>
                  {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                  AI 자동 번역
                </Button>
              </div>
              <Textarea value={form.description_cn || ''} onChange={(e) => setForm(p => ({ ...p, description_cn: e.target.value }))} rows={3} placeholder="AI 번역 또는 직접 입력" />
            </div>

            {editItem && (
              <div>
                <Label className="text-xs">상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditItem(null); }}>취소</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editItem ? '수정 저장' : '등록'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}