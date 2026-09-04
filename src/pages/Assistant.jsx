import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ConversationList from '@/components/assistant/ConversationList';
import MessageBubble from '@/components/assistant/MessageBubble';
import ChatComposer from '@/components/assistant/ChatComposer';
import { Bot, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AGENT_NAME = 'chinasourcing_assistant';

export default function Assistant() {
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  const loadConversations = async () => {
    const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
    setConversations(list || []);
    return list || [];
  };

  const init = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadConversations();
      if (list.length > 0) await openConversation(list[0].id);
    } catch (e) {
      setError('대화를 불러오지 못했습니다. 다시 시도해 주세요.');
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (id) => {
    const conv = await base44.agents.getConversation(id);
    setConversation(conv);
    setMessages(conv.messages || []);
  };

  const startConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: `업무 상담 ${new Date().toLocaleDateString('ko-KR')}`, description: '중국소싱 AI 비서 대화' },
    });
    setConversation(conv);
    setMessages(conv.messages || []);
    await loadConversations();
    return conv;
  };

  const handleSend = async (text, fileUrls, fileNames) => {
    setSending(true);
    setError(null);
    try {
      let conv = conversation;
      if (!conv) conv = await startConversation();
      const content = fileNames?.length
        ? `${text}${text ? '\n\n' : ''}첨부 파일: ${fileNames.join(', ')}`
        : text;
      await base44.agents.addMessage(conv, {
        role: 'user',
        content,
        ...(fileUrls?.length ? { file_urls: fileUrls } : {}),
      });
    } catch (e) {
      setError('메시지를 보내지 못했습니다. 다시 시도해 주세요.');
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">AI 업무 비서</h1>
          <p className="text-xs text-muted-foreground">진행 중인 업무 카드와 파일을 분석하고, 첨부 파일을 알맞은 카드에 등록합니다.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <ConversationList
          conversations={conversations}
          activeId={conversation?.id}
          onSelect={openConversation}
          onNew={startConversation}
        />
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </span>
                <Button size="sm" variant="outline" onClick={init}>다시 시도</Button>
              </div>
            )}
            {loading ? (
              <div className="flex justify-center pt-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : messages.length === 0 ? (
              <div className="max-w-md mx-auto text-center pt-10 space-y-2">
                <Bot className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  "지금 진행 중인 업무 정리해줘", "이 견적서 파일 알맞은 카드에 등록해줘" 처럼 요청해 보세요.
                </p>
              </div>
            ) : (
              messages.map((m, i) => <MessageBubble key={i} message={m} />)
            )}
            <div ref={endRef} />
          </div>
          <ChatComposer onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </div>
  );
}