import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { saveBilingual } from '@/lib/saveBilingual';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';

const TYPE_LABEL = { ONLINE: '화상 미팅', OFFLINE: '대면 미팅', CALL: '전화', WECHAT: '위챗' };
const pick = (log, key) => (log[key] || log[`${key}_cn`] || '').trim();

// 고객에게 보낼 미팅 요약 초안 (한국어 원문 우선, 없으면 중국어)
export function meetingSummaryDraft(log) {
  const sections = [['논의 내용', pick(log, 'notes')], ['결정 사항', pick(log, 'decisions')], ['다음 진행', pick(log, 'next_steps')]]
    .filter(([, body]) => body)
    .map(([head, body]) => `■ ${head}\n${body}`);
  return [`[미팅 요약] ${log.meeting_date || ''} ${TYPE_LABEL[log.meeting_type] || ''}`.trim(), pick(log, 'title'), '', ...sections.flatMap((s) => [s, ''])]
    .join('\n').trim();
}

// 공장 미팅 요약을 다듬어 고객 문의 탭(고객 공개 채팅)으로 보낸다.
export default function MeetingShareDialog({ log, card, user, onClose }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!log) return;
    setText(meetingSummaryDraft(log));
    setChecked(false);
  }, [log]);

  const send = async () => {
    setSending(true);
    try {
      const message = text.trim().slice(0, 3000);
      await saveBilingual('CardChat', {
        tenant_id: card.tenant_id,
        card_id: card.id,
        sender_name: user?.full_name || '담당자',
        sender_email: user?.email || '',
        sender_role: user?.role === 'admin' ? 'HQ' : 'AGENT',
        message_text: message,
        message_text_cn: '',
        is_client_visible: true,
      });
      await base44.entities.MeetingLog.update(log.id, { client_shared_at: new Date().toISOString() });
      base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'chat_message', message }).catch(() => {});
      qc.invalidateQueries({ queryKey: ['card-chat', card.id] });
      qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] });
      toast({ title: '고객 문의 탭에 미팅 요약을 보냈습니다' });
      onClose();
    } catch (e) {
      toast({ title: '보내지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!log} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>고객에게 미팅 요약 공유</DialogTitle>
          <DialogDescription>고객 포털의 문의 탭에 담당자 메시지로 올라가고, 고객에게 알림이 갑니다.</DialogDescription>
        </DialogHeader>
        <Textarea rows={12} value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} className="text-sm" />
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
          <span>공장 이름·연락처·공장 단가 같은 내부 정보를 지웠습니다.</span>
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={sending} onClick={onClose}>취소</Button>
          <Button disabled={sending || !checked || !text.trim()} onClick={send} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}고객에게 보내기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
