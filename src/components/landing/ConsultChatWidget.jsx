import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getChatSessionId, peekChatSessionId } from '@/lib/publicChatSession';
import { cn } from '@/lib/utils';

const COPY = {
  ko: {
    title: '실시간 상담',
    sub: '궁금한 점을 바로 물어보세요. 답변은 이 창에 쌓이니 나중에 다시 열어 확인하실 수 있어요.',
    faqTitle: '자주 묻는 질문',
    leaveMsg: '직접 문의하기',
    name: '이름', contact: '연락처 (전화 또는 이메일)', message: '메시지',
    messagePh: '무엇이 궁금하신가요?',
    send: '보내기', sending: '전송 중...',
    sent: '문의가 접수되었습니다. 담당자 답변은 이 창에 표시됩니다.',
    inputPh: '메시지를 입력하세요',
    error: '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    you: '나', staff: '담당자',
  },
  en: {
    title: 'Live consultation',
    sub: 'Ask anything — replies land in this window, so you can reopen it anytime to check.',
    faqTitle: 'Frequently asked',
    leaveMsg: 'Leave a message',
    name: 'Name', contact: 'Contact (phone or email)', message: 'Message',
    messagePh: 'What would you like to know?',
    send: 'Send', sending: 'Sending...',
    sent: 'Your message has been received. Replies will appear in this window.',
    inputPh: 'Type a message',
    error: 'Something went wrong. Please try again shortly.',
    you: 'You', staff: 'Staff',
  },
  zh: {
    title: '在线咨询',
    sub: '有任何问题都可以直接询问，回复会显示在这个窗口，可随时重新打开查看。',
    faqTitle: '常见问题',
    leaveMsg: '直接留言咨询',
    name: '姓名', contact: '联系方式（电话或邮箱）', message: '留言内容',
    messagePh: '您想了解什么？',
    send: '发送', sending: '发送中...',
    sent: '您的留言已收到，回复会显示在此窗口。',
    inputPh: '请输入消息',
    error: '发送失败，请稍后重试。',
    you: '我', staff: '客服',
  },
};

const FAQ = [
  {
    q: ['최소 주문 수량(MOQ)이 있나요?', 'Is there a minimum order quantity?', '是否有最小起订量（MOQ）？'],
    a: [
      '품목마다 다릅니다. 기성품은 대부분 소량도 가능하고, 금형이 필요한 주문제작 품목은 공장별 MOQ가 있어 문의 시 정확히 안내드립니다.',
      'It depends on the item. Off-the-shelf items usually allow small quantities; tooled made-to-order items carry a factory MOQ, which we confirm when you inquire.',
      '因品类而异。现货品类大多支持小批量；需要开模的定制品类会有工厂 MOQ，我们会在您咨询时准确告知。',
    ],
  },
  {
    q: ['샘플 제작이 가능한가요?', 'Can you make a sample first?', '可以先制作样品吗？'],
    a: [
      '네, 대부분 양산 전 샘플/T0를 진행합니다. 샘플 비용과 기간은 품목·사양에 따라 견적 시 함께 안내드립니다.',
      'Yes, we run a sample or T0 before mass production for most items. Sample cost and lead time are quoted together with your request.',
      '可以，大多数品类在量产前会先出样品/T0。样品费用与周期会在报价时一并告知。',
    ],
  },
  {
    q: ['평균 리드타임은 얼마나 되나요?', 'What is the typical lead time?', '平均交期是多久？'],
    a: [
      '평균 약 32일이며 품목·수량·옵션에 따라 달라집니다. 정확한 일정은 사양 확인 후 견적서에 명시해 드립니다.',
      'On average about 32 days, varying by item, quantity and options. The exact schedule is stated in your quotation once specs are confirmed.',
      '平均约 32 天，具体因品类、数量与选项而异。确认规格后会在报价单中注明准确交期。',
    ],
  },
  {
    q: ['결제 조건은 어떻게 되나요?', 'What are the payment terms?', '付款条件是怎样的？'],
    a: [
      '일반적으로 계약 시 선금, 출하 전 잔금 구조이며, 모든 조건은 계약서 작성 후 진행됩니다. 세부 비율은 견적 시 안내드립니다.',
      'Typically a deposit at contract signing and the balance before shipment, all fixed in a written contract. Exact ratios are shared with your quotation.',
      '通常为签约时付定金、出货前付尾款，所有条款均在签订合同后执行。具体比例会在报价时说明。',
    ],
  },
  {
    q: ['불량이나 문제가 생기면 어떻게 하나요?', 'What if there is a defect or issue?', '如果出现不良或问题怎么办？'],
    a: [
      '계약서에 불량 처리 기준을 명시하고, 납품 후에도 ChinaSourcing Cloud 계정에서 A/S 접수와 처리 현황을 확인하실 수 있습니다.',
      'Defect handling is fixed in the contract, and after delivery you can file and track A/S requests from your ChinaSourcing Cloud account.',
      '合同中会明确不良处理标准，交付后也可通过 ChinaSourcing Cloud 账号提交并跟踪售后处理进度。',
    ],
  },
];

const tx = (arr, lang) => (Array.isArray(arr) ? arr[{ ko: 0, en: 1, zh: 2 }[lang] ?? 0] : arr);

export default function ConsultChatWidget({ lang = 'ko' }) {
  const c = COPY[lang] || COPY.ko;
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [timeline, setTimeline] = useState([]); // { id, role: 'visitor'|'staff'|'faq', text, ts }
  const [started, setStarted] = useState(false); // 방문자가 첫 메시지를 보냈는지
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const loadHistory = async (sid) => {
    if (!sid) return;
    try {
      const res = await base44.functions.invoke('getPublicChat', { session_id: sid });
      const data = res.data || {};
      if (data.thread) {
        setStarted(true);
        setName((n) => n || data.thread.visitor_name || '');
        setTimeline((prev) => {
          const fromServer = (data.messages || []).map((m) => ({
            id: m.id,
            role: m.sender_role === 'STAFF' ? 'staff' : 'visitor',
            text: m.message_text,
            ts: m.created_date,
          }));
          const faqOnly = prev.filter((t) => t.role === 'faq' || t.role === 'faq-answer');
          return [...fromServer, ...faqOnly].sort((a, b) => new Date(a.ts) - new Date(b.ts));
        });
      }
    } catch (_e) { /* 조용히 무시 — 위젯이 방문 경험을 막지 않도록 */ }
  };

  // 페이지 로드 시 기존 세션이 있으면 조용히 미확인 답변 여부만 확인
  useEffect(() => {
    const sid = peekChatSessionId();
    if (!sid) return;
    base44.functions.invoke('getPublicChat', { session_id: sid }).then((res) => {
      const data = res.data || {};
      if (data.thread) {
        setStarted(true);
        const lastStaff = [...(data.messages || [])].reverse().find((m) => m.sender_role === 'STAFF');
        if (lastStaff) setHasUnread(true);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const sid = peekChatSessionId();
    setHasUnread(false);
    if (sid) loadHistory(sid);
    const interval = setInterval(() => { if (sid) loadHistory(sid); }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [timeline]);

  const askFaq = (item) => {
    setTimeline((prev) => [
      ...prev,
      { id: `faq-${Date.now()}`, role: 'faq', text: tx(item.q, lang), ts: new Date().toISOString() },
      { id: `faq-a-${Date.now()}`, role: 'faq-answer', text: tx(item.a, lang), ts: new Date(Date.now() + 1).toISOString() },
    ]);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const sid = getChatSessionId();
      await base44.functions.invoke('sendPublicChat', {
        session_id: sid,
        message: text,
        visitor_name: name.trim(),
        visitor_contact: contact.trim(),
      });
      setTimeline((prev) => [...prev, { id: `local-${Date.now()}`, role: 'visitor', text, ts: new Date().toISOString() }]);
      setDraft('');
      setStarted(true);
    } catch (_err) {
      setError(c.error);
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[90] w-14 h-14 rounded-full bg-landing-ink hover:bg-landing-brand-hover text-white shadow-[0_10px_30px_rgba(23,23,25,.3)] flex items-center justify-center transition-colors"
        aria-label={c.title}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && hasUnread && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-landing-brand border-2 border-white" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[90] w-[92vw] max-w-[360px] h-[520px] max-h-[75vh] bg-white rounded-2xl shadow-[0_20px_60px_rgba(23,23,25,.25)] border border-landing-line flex flex-col overflow-hidden">
          <div className="px-4 py-3.5 border-b border-landing-line bg-landing-page/60 flex-none">
            <h3 className="text-[14.5px] font-extrabold text-landing-ink">{c.title}</h3>
            <p className="text-[11.5px] text-landing-muted2 mt-0.5 leading-snug">{c.sub}</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
            {timeline.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-landing-muted2 uppercase tracking-wide px-0.5">{c.faqTitle}</p>
                {FAQ.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => askFaq(item)}
                    className="w-full text-left text-[12.5px] font-semibold px-3 py-2 rounded-lg border border-landing-line2 text-landing-ink2 hover:border-landing-brand hover:text-landing-brand transition-colors"
                  >
                    {tx(item.q, lang)}
                  </button>
                ))}
              </div>
            )}
            {timeline.map((t) => {
              const mine = t.role === 'visitor';
              const isFaq = t.role === 'faq' || t.role === 'faq-answer';
              return (
                <div key={t.id} className={cn('flex', mine || t.role === 'faq' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[82%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
                      mine || t.role === 'faq' ? 'bg-landing-ink text-white' : isFaq ? 'bg-landing-tint text-landing-ink' : 'bg-landing-page text-landing-ink'
                    )}
                  >
                    {!isFaq && (
                      <p className={cn('text-[10px] mb-0.5', mine ? 'text-white/60' : 'text-landing-muted2')}>
                        {mine ? c.you : c.staff}
                      </p>
                    )}
                    {t.text}
                  </div>
                </div>
              );
            })}
            {timeline.length > 0 && !started && (
              <p className="text-[11px] text-landing-muted2 text-center pt-1">{c.leaveMsg}</p>
            )}
          </div>

          <div className="border-t border-landing-line p-3 flex-none space-y-2">
            {!started && (
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.name}
                  className="border border-landing-line3 rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none bg-landing-input focus:border-landing-brand focus:bg-white transition-colors"
                />
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={c.contact}
                  className="border border-landing-line3 rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none bg-landing-input focus:border-landing-brand focus:bg-white transition-colors"
                />
              </div>
            )}
            <div className="flex gap-1.5 items-end">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={c.inputPh}
                className="flex-1 border border-landing-line3 rounded-lg px-2.5 py-2 text-[13px] outline-none bg-landing-input focus:border-landing-brand focus:bg-white transition-colors resize-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || !draft.trim()}
                aria-label={c.send}
                className="flex-none w-9 h-9 rounded-lg bg-landing-ink hover:bg-landing-brand-hover disabled:opacity-50 text-white flex items-center justify-center transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-[11.5px] text-landing-danger">{error}</p>}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
