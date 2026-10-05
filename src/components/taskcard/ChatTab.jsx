import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import DropZone from '@/components/ui/drop-zone';
import { saveBilingual } from '@/lib/saveBilingual';
import { cnOrKo } from '@/lib/contentLanguage';
import BilingualField from '@/components/language/BilingualField';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/lib/LanguageContext';

const ROLE_COLOR = {
  HQ: 'bg-primary text-primary-foreground',
  AGENT: 'bg-muted text-foreground',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatTab({ card, user, viewLang = 'KR' }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ message_text: '', message_text_cn: '' });
  const [uploading, setUploading] = useState(false);
  const [toClient, setToClient] = useState(false);
  const canSendToClient = card.client_visible === true && !!card.client_id;
  const fileInputRef = useRef();
  const bottomRef = useRef();
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['card-chat', card.id],
    queryFn: () => base44.entities.CardChat.filter({ card_id: card.id }, 'created_date', 200),
    refetchInterval: 3000,
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.CardChat.subscribe((event) => {
      if (event.data?.card_id === card.id) {
        queryClient.invalidateQueries({ queryKey: ['card-chat', card.id] });
      }
    });
    return unsub;
  }, [card.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (msg) => {
      return saveBilingual('CardChat', { ...msg, tenant_id: card.tenant_id });
    },
    onSuccess: (_saved, msg) => {
      queryClient.invalidateQueries({ queryKey: ['card-chat', card.id] });
      if (msg.is_client_visible) base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'chat_message', message: msg.message_text || msg.message_text_cn }).catch(() => {});
    },
    onError: error => toast({ title: '전송 실패 / 发送失败', description: error.message, variant: 'destructive' }),
  });

  const handleSend = () => {
    if (sendMutation.isPending || !(draft.message_text.trim() || draft.message_text_cn.trim())) return;
    sendMutation.mutate({
      card_id: card.id,
      sender_name: user?.full_name || '사용자',
      sender_email: user?.email || '',
      sender_role: user?.role === 'admin' ? 'HQ' : 'AGENT',
      message_text: draft.message_text.trim(), message_text_cn: draft.message_text_cn.trim(),
      is_client_visible: toClient,
    }, { onSuccess: () => { setDraft({ message_text: '', message_text_cn: '' }); setToClient(false); } });
  };

  const handleFileAttach = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    sendMutation.mutate({
      card_id: card.id,
      sender_name: user?.full_name || '사용자',
      sender_email: user?.email || '',
      sender_role: user?.role === 'admin' ? 'HQ' : 'AGENT',
      message_text: `📎 ${file.name}`,
      file_url,
      file_name: file.name,
    });
    setUploading(false);
  };

  const isMyMsg = (msg) => msg.sender_email === user?.email;

  return (
    <DropZone onFile={handleFileAttach} uploading={uploading} className="flex flex-col h-[420px]">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-1 pb-2">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground pt-8">아직 메시지가 없습니다. 먼저 말을 걸어보세요!</div>
        )}
        {messages.map((msg) => {
          const mine = isMyMsg(msg);
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${ROLE_COLOR[msg.sender_role] || 'bg-muted'}`}>
                {msg.sender_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className={`max-w-[72%] space-y-1 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && <p className="text-[10px] text-muted-foreground px-1">{msg.sender_name} · {msg.sender_role}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-snug ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                  {cnOrKo(msg, 'message_text', viewLang === 'CN' ? 'zh' : 'ko')}
                  {msg.file_url && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                       className={`block text-xs mt-1 underline ${mine ? 'text-primary-foreground/80' : 'text-primary'}`}>
                      📎 {msg.file_name || '첨부파일'}
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  {msg.is_client_visible && msg.sender_role !== 'CLIENT' && <span className="mr-1 rounded bg-accent/15 px-1 text-accent font-semibold">고객 공개</span>}
                  {formatTime(msg.created_date)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canSendToClient && (
        <label className="border-t pt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={toClient} onCheckedChange={setToClient} />
          고객에게 보내기 {toClient && <span className="text-accent font-semibold">(고객 문의 탭에 표시되고 메일이 발송됩니다)</span>}
        </label>
      )}
      <div className={`${canSendToClient ? 'pt-2' : 'border-t pt-3'} flex items-center gap-2`}>
        <button onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-foreground transition-colors" disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileAttach(e.target.files[0])} />
        <BilingualField record={draft} field="message_text" disabled={sendMutation.isPending}
          onChange={(key, value) => setDraft(prev => ({ ...prev, [key]: value }))}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
          placeholder={viewLang === 'CN' ? '输入消息…' : '메시지를 입력하세요…'} className="text-sm" />
        <Button size="icon" onClick={handleSend} disabled={!(draft.message_text.trim() || draft.message_text_cn.trim()) || sendMutation.isPending} className="shrink-0">
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </DropZone>
  );
}