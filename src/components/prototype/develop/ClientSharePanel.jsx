import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Box, FileText, MessageSquare, MessagesSquare, Loader2, Check, Send, EyeOff, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/prototype/develop/DevBits';
import { base44 } from '@/api/base44Client';
import { userManualDraft, nameplateDraft } from '@/lib/devkit/meetingReport';
import { callRoom } from '@/lib/designRoomLive';
import { openDesignRoom } from '@/lib/designRoom';

const DOCS = [
  { key: 'nameplate', label: '명판·라벨 문구', draft: nameplateDraft, hint: '제품 바닥·뒷면에 찍을 문구입니다. □ 는 정해지면 채우세요.' },
  { key: 'manual', label: '사용설명서 초안', draft: userManualDraft, hint: '정격·구성품·사용법·주의 문구 초안입니다.' },
];
const when = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '');
const errText = (e) => e?.response?.data?.error || e?.message || String(e);

/** 직원 화면에서 쓰는 고객 공개 상태 (공개 내용·고객 결정·카드 공개 여부) */
export function useProtoClient(projectId) {
  return useQuery({
    queryKey: ['proto-client', projectId],
    queryFn: async () => (await base44.functions.invoke('protoClient', { action: 'staff_view', project_id: projectId })).data,
    enabled: !!projectId, staleTime: 20_000,
  });
}

// 고객 공유: 3D·동작 시뮬레이션 공개, 명판·설명서 초안 확인 요청, 고객이 3D 에 남긴 위치 의견
export default function ClientSharePanel({ project, dev, concept }) {
  const qc = useQueryClient();
  const { data, isLoading } = useProtoClient(project.id);
  const [busy, setBusy] = useState('');
  const [texts, setTexts] = useState({});
  const share = data?.share || {};
  const review = data?.review || {};
  const card = data?.card;
  const run = async (key, body, ok) => {
    setBusy(key);
    try {
      const res = await base44.functions.invoke('protoClient', { project_id: project.id, ...body });
      if (res.data?.error) throw new Error(res.data.error);
      await qc.invalidateQueries({ queryKey: ['proto-client', project.id] });
      toast({ title: ok, description: res.data?.notified === false ? '업무 카드가 고객 비공개라 알림은 보내지 않았습니다' : undefined });
    } catch (e) { toast({ title: errText(e), variant: 'destructive' }); }
    setBusy('');
  };
  const parts = concept?.preview?.parts || [];
  const shareModel = () => run('model', { action: 'share_model', snapshot: { dev, parts, render_url: concept?.preview?.render_url || '', title: concept?.preview?.title || project.title, overall_mm: concept?.preview?.overall_mm, tour: concept?.preview?.tour || null } }, share.model?.on ? '고객 화면의 3D·시뮬레이션을 지금 설계로 바꿨습니다' : '3D·동작 시뮬레이션을 고객에게 공개했습니다');
  // 3D 실시간 리뷰 방: 지금 설계로 방을 만들거나(이미 있으면 모형만 갱신) 새 탭으로 연다
  const openRoom = async () => {
    setBusy('room');
    const r = await callRoom({ action: 'create', project_id: project.id, snapshot: { dev, parts, render_url: concept?.preview?.render_url || '', title: concept?.preview?.title || project.title, overall_mm: concept?.preview?.overall_mm, tour: concept?.preview?.tour || null } });
    setBusy('');
    if (r.error) toast({ title: r.error, variant: 'destructive' }); else openDesignRoom(r.room.id);
  };
  const comments = [...(review.comments || [])].reverse();
  const open = comments.filter((c) => !c.resolved).length;

  if (!project.card_id) return <Card title="고객 공유" icon={Users}><p className="text-caption text-muted-foreground">업무 카드에 묶인 시제품만 고객 포털에 공개할 수 있습니다. 워크벤치 맨 위 “카드 연결” 에서 업무 카드를 고르세요.</p></Card>;
  return (
    <Card title="고객 공유" icon={Users} tag={open ? `새 의견 ${open}` : undefined}>
      <p className="text-caption text-muted-foreground">업무 카드 고객의 포털 “개발” 탭에 보입니다. 원가·부품 번호·내부 메모는 공개되지 않습니다.</p>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
        <>
          {card && !card.has_client && <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text"><CircleAlert className="w-4 h-4" />업무 카드에 고객사가 정해지지 않았습니다.</p>}
          {card && card.has_client && !card.client_visible && <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text"><CircleAlert className="w-4 h-4" />업무 카드가 고객 비공개입니다. 카드 “지금” 탭에서 고객 공개를 켜야 고객이 봅니다.</p>}

          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex flex-wrap items-center gap-2 text-label font-semibold"><Box className="w-4 h-4 text-primary" />3D·동작 시뮬레이션
              <span className={`rounded-full px-2 py-0.5 text-micro ${share.model?.on ? 'bg-success/15 text-success-text' : 'bg-muted text-muted-foreground'}`}>{share.model?.on ? `공개 중 · ${when(share.model.at)}` : '공개 안 함'}</span></p>
            <p className="text-caption text-muted-foreground">고객 화면은 “시연” 으로 열려 작동 순서를 자동으로 보여 주고, 버튼·조명을 직접 눌러 볼 수 있습니다 (설계 숫자는 “상세” 탭). 공개한 때의 설계로 보이며, 설계를 바꾸면 “갱신”을 누르세요.{!parts.length && ' 컨셉 3D 가 없어 기본 상자 모형으로 보입니다.'}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={shareModel} disabled={!!busy || !(dev.features || []).length}>{busy === 'model' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{share.model?.on ? '지금 설계로 갱신' : '고객에게 공개'}</Button>
              {share.model?.on && <Button size="sm" variant="ghost" onClick={() => run('off', { action: 'share_model', on: false }, '3D 공개를 멈췄습니다')} disabled={!!busy}><EyeOff className="w-4 h-4" />공개 중단</Button>}
              <Button size="sm" variant="outline" onClick={openRoom} disabled={!!busy || !(dev.features || []).length}>{busy === 'room' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessagesSquare className="w-4 h-4" />}3D 실시간 리뷰 방</Button>
            </div>
          </div>

          {DOCS.map((d) => {
            const cur = share.docs?.[d.key];
            const text = texts[d.key] ?? cur?.text ?? d.draft(project, dev);
            const answers = review.docs?.[d.key] || [];
            const last = cur && answers.find((a) => a.version === cur.version);
            return (
              <div key={d.key} className="space-y-2 rounded-lg border p-3">
                <p className="flex flex-wrap items-center gap-2 text-label font-semibold"><FileText className="w-4 h-4 text-primary" />{d.label}
                  {cur && <span className={`rounded-full px-2 py-0.5 text-micro ${last?.decision === 'APPROVED' ? 'bg-success/15 text-success-text' : last ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-text'}`}>v{cur.version} {last?.decision === 'APPROVED' ? '고객 승인' : last ? '수정 요청' : '고객 확인 대기'}</span>}</p>
                <p className="text-caption text-muted-foreground">{d.hint}</p>
                <Textarea aria-label={d.label} value={text} onChange={(e) => setTexts((t) => ({ ...t, [d.key]: e.target.value }))} rows={6} className="font-mono text-caption" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => run(d.key, { action: 'share_doc', doc: d.key, text }, `${d.label} v${(cur?.version || 0) + 1} 확인을 요청했습니다`)} disabled={!!busy || !text.trim() || text === cur?.text}>{busy === d.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{cur ? `고친 내용으로 다시 요청 (v${cur.version + 1})` : '고객에게 확인 요청'}</Button>
                  {!cur && <span className="text-micro text-muted-foreground">워크벤치 설계로 채운 초안입니다. 고친 뒤 보내세요.</span>}
                </div>
                {answers.length > 0 && (
                  <ul className="space-y-1 text-caption">{[...answers].reverse().map((a, i) => <li key={i} className="rounded bg-secondary px-2 py-1"><span className={a.decision === 'APPROVED' ? 'text-success-text' : 'text-destructive'}>v{a.version} {a.decision === 'APPROVED' ? '승인' : '수정 요청'}</span> · {a.by} · {when(a.at)}{a.note && <span className="block text-foreground">{a.note}</span>}</li>)}</ul>
                )}
              </div>
            );
          })}

          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center gap-2 text-label font-semibold"><MessageSquare className="w-4 h-4 text-primary" />고객 3D 의견 {comments.length > 0 && <span className="text-micro font-normal text-muted-foreground">{open}건 처리 전</span>}</p>
            {comments.length === 0 ? <p className="text-caption text-muted-foreground">아직 없습니다. 고객이 3D 에서 부품을 눌러 남긴 의견이 여기에 모입니다.</p> : (
              <ul className="space-y-1.5">{comments.map((c) => (
                <li key={c.id} className={`flex flex-wrap items-start gap-2 rounded-lg px-3 py-2 text-caption ${c.resolved ? 'bg-muted text-muted-foreground' : 'bg-warning/10'}`}>
                  <div className="min-w-0 flex-1"><p><span className="font-semibold">{c.part_name || '전체'}</span> · {c.text}</p><p className="text-micro text-muted-foreground">{c.by} · {when(c.at)}{c.resolved && ` · 처리 ${c.resolved_by}`}</p></div>
                  <Button size="sm" variant={c.resolved ? 'ghost' : 'outline'} className="h-7" onClick={() => run(`c-${c.id}`, { action: 'resolve_comment', comment_id: c.id, resolved: !c.resolved }, c.resolved ? '처리 표시를 거뒀습니다' : '처리했다고 표시했습니다')} disabled={!!busy}><Check className="w-3.5 h-3.5" />{c.resolved ? '되돌리기' : '처리함'}</Button>
                </li>
              ))}</ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
