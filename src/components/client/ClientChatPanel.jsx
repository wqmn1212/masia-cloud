import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, Paperclip, X } from 'lucide-react';
import FileDropArea from '@/components/files/FileDropArea';
import { mergeFiles, toAttachmentPayload } from '@/lib/clientFileUpload';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import BilingualField from '@/components/language/BilingualField';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from '@/components/ui/use-toast';

export default function ClientChatPanel({ cardId, chats }) {
  const [draft, setDraft] = useState({ message_text: '', message_text_cn: '' });
  const { content } = useLanguage();
  const qc = useQueryClient();
  const [files, setFiles] = useState([]);
  const addFiles = (list) => {
    const r = mergeFiles(files, list);
    if (r.rejected.length) toast({ title: '일부 파일 제외', description: `${r.rejected.join(', ')} (최대 5건 · 10MB)`, variant: 'destructive' });
    setFiles(r.files);
  };

  const send = useMutation({
    mutationFn: async () => base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'chat', message: draft.message_text, message_cn: draft.message_text_cn, attachments: await toAttachmentPayload(files) }),
    onError: error => toast({ title: '전송 실패 / 发送失败', description: error.message, variant: 'destructive' }),
    onSuccess: (res) => {
      if (res.data?.translation_failed) { window.dispatchEvent(new CustomEvent('translation-unavailable')); toast({ title: '원문 저장됨 / 原文已保存', description: '자동 번역 미완료 / 自动翻译未完成' }); }
      setDraft({ message_text: '', message_text_cn: '' });
      setFiles([]);
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-shared-files', cardId] });
      qc.invalidateQueries({ queryKey: ['company-files'] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">아직 대화가 없습니다. 문의를 남겨보세요.</p>
        ) : (
          chats.map((c) => {
            const mine = c.sender_role === 'CLIENT';
            return (
              <div key={c.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-xl px-3 py-2', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <p className="text-[10px] opacity-70">{c.sender_name} · {c.created_date ? format(new Date(c.created_date), 'MM.dd HH:mm') : ''}</p>
                  <p className="text-sm whitespace-pre-wrap mt-0.5 leading-relaxed">{content(c, 'message_text')}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <FileDropArea onFiles={addFiles} disabled={send.isPending} className="border-t pt-3 space-y-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-muted rounded-full pl-2.5 pr-1 py-1 text-xs">
                {f.name}
                <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <label className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border cursor-pointer hover:bg-muted" title="파일 첨부 (드래그앤드롭 가능)">
            <Paperclip className="w-4 h-4" />
            <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <BilingualField record={draft} field="message_text" multiline rows={2} disabled={send.isPending}
            onChange={(key, value) => setDraft(prev => ({ ...prev, [key]: value }))} placeholder="메시지 / 消息 (파일을 끌어다 놓아 첨부)" />
          <Button size="icon" disabled={!(draft.message_text.trim() || draft.message_text_cn.trim() || files.length) || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </FileDropArea>
    </div>
  );
}