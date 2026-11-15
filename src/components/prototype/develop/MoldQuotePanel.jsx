import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Factory, Loader2, Copy, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { factoryLink } from '@/lib/factoryRequest';
import { errorText } from '@/lib/prototypeApi';

// 금형 견적 요청: 금형 업체용 묶음(STEP·설계 조건)을 공장 업로드 링크의 참고 파일로 붙이고, 견적서·질문 답변을 받는다
const ITEMS = [
  { kind: 'QUOTE', label_ko: '금형·사출 견적서 (금형비·사출 단가·수량별)', label_cn: '模具及注塑报价单（模具费、注塑单价、按数量）' },
  { kind: 'ANSWER', label_ko: '캐비티 수 · 금형강 · 금형 수명', label_cn: '模穴数 · 模具钢材 · 模具寿命（模次）' },
  { kind: 'ANSWER', label_ko: '금형 제작 기간 · T1 샘플 날짜', label_cn: '模具制作周期 · T1 试模样品日期' },
  { kind: 'ANSWER', label_ko: '설계 변경 제안 (구배·살두께·슬라이드·게이트 위치)', label_cn: '设计修改建议（拔模角、壁厚、滑块、浇口位置）' },
];

export default function MoldQuotePanel({ project, buildZip, summary, base, disabled }) {
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState(project.card_id || '');
  const [factory, setFactory] = useState('');
  const [days, setDays] = useState(10);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const { data: cards = [] } = useQuery({ queryKey: ['moldQuoteCards'], queryFn: () => base44.entities.TaskCard.list('-updated_date', 50), enabled: open && !project.card_id });

  const send = async () => {
    if (!cardId) { toast({ title: '견적을 묶을 업무 카드를 고르세요' }); return; }
    setBusy(true);
    try {
      const zip = await buildZip();
      const name = `${base}-mold-quote-package.zip`;
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: new File([zip], name, { type: 'application/zip' }) });
      const message = `您好，请根据附件（STEP 三维模型 + 设计条件说明）提供模具及注塑报价。\n注塑件 ${summary.count} 个，材料 ${summary.materials}，总重约 ${summary.weight} g。\n请注明：模具费（每个零件）、模穴数、模具钢材与寿命、注塑单价（按 1000/3000/10000 数量）、交期（工作日）、付款条件、报价有效期、是否含税。\n如对拔模角、壁厚、滑块有修改建议，请在问题中回答。谢谢！`;
      const { data } = await base44.functions.invoke('manageFactoryRequest', { action: 'create', card_id: cardId, items: ITEMS, days, message_cn: message, factory_name: factory, ref_files: [{ name, uri: file_uri, size: zip.length, note_cn: 'STEP 三维模型 + 设计条件说明' }] });
      if (data?.error) throw new Error(data.error);
      if (!project.card_id) await base44.entities.ProtoProject.update(project.id, { card_id: cardId }).catch(() => {});
      setDone({ link: factoryLink(window.location.origin, data.token), pin: data.pin, expires_at: data.expires_at });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy(false);
  };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast({ title: '복사했습니다' }); } catch { toast({ title: '복사하지 못했습니다', variant: 'destructive' }); } };

  if (!open) return <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}><Factory className="w-4 h-4" />공장에 금형 견적 요청</Button>;
  return (
    <div className="w-full rounded-lg border p-3 space-y-2">
      <p className="text-label font-semibold">공장에 금형 견적 요청</p>
      {done ? (
        <div className="space-y-1.5 text-caption">
          <p>공장 링크를 만들었습니다. 링크와 PIN 을 공장에 보내세요 (기한 {done.expires_at?.slice(0, 10)}). 견적서가 올라오면 업무 카드의 공장 요청에서 확인합니다.</p>
          <div className="flex items-center gap-2"><code className="truncate rounded bg-secondary px-2 py-1">{done.link}</code><Button size="sm" variant="outline" onClick={() => copy(done.link)}><Copy className="w-3.5 h-3.5" />링크</Button></div>
          <div className="flex items-center gap-2"><code className="rounded bg-secondary px-2 py-1 tabular-nums">PIN {done.pin}</code><Button size="sm" variant="outline" onClick={() => copy(`${done.link}\nPIN ${done.pin}`)}><Copy className="w-3.5 h-3.5" />링크+PIN</Button></div>
        </div>
      ) : (
        <>
          <p className="text-micro text-muted-foreground">금형 업체용 묶음(조립·부품별 STEP, 설계 조건)을 참고 파일로 붙이고, 견적서와 질문 3개(캐비티·금형강·수명 / 기간·T1 / 설계 변경 제안)를 받습니다. 공장 화면은 중국어로 나옵니다.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {project.card_id ? <p className="text-caption text-muted-foreground sm:col-span-1">업무 카드: 연결됨</p> : (
              <select aria-label="업무 카드" value={cardId} onChange={(e) => setCardId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-caption">
                <option value="">업무 카드 고르기</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
            <Input aria-label="공장 이름" value={factory} onChange={(e) => setFactory(e.target.value)} placeholder="공장 이름 (선택)" className="h-9 text-caption" />
            <Input aria-label="기한 (일)" type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value) || 10)} className="h-9 text-caption" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={send} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}링크 만들기</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>닫기</Button>
          </div>
        </>
      )}
    </div>
  );
}
