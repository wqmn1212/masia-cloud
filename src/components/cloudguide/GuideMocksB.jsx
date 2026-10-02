import React from 'react';
import { FileText } from 'lucide-react';
import { tx } from '@/lib/landingContent';

const TABS = [['개요', 'Overview', '概要'], ['견적', 'Quote', '报价'], ['파일', 'Files', '文件'], ['채팅', 'Chat', '沟通'], ['QC', 'QC', 'QC']];

export function MockDetail({ lang }) {
  return (
    <div>
      <div className="font-bold text-[14px]">드립백 포장기 견적</div>
      <div className="flex gap-1 mt-2 border-b border-landing-line">
        {TABS.map((t, i) => <span key={i} className={`px-2.5 py-1.5 ${i === 1 ? 'border-b-2 border-landing-brand text-landing-brand font-bold' : 'text-landing-muted'}`}>{tx(t, lang)}</span>)}
      </div>
      <div className="mt-3 rounded-md border border-landing-line p-3 space-y-1.5">
        <div className="flex justify-between"><span className="text-landing-muted">{tx(['견적서', 'Quotation', '报价单'], lang)}</span><span className="font-semibold">드립백 포장기 견적서</span></div>
        <div className="flex justify-between"><span className="text-landing-muted">{tx(['출하', 'Ships in', '出货'], lang)}</span><span>30{tx(['일', ' days', '天'], lang)}</span></div>
        <div className="flex items-center gap-1.5 pt-1 text-landing-brand"><FileText size={13} />PDF</div>
      </div>
    </div>
  );
}

export function MockChat() {
  return (
    <div className="space-y-2">
      <div className="max-w-[80%] rounded-lg bg-landing-page px-3 py-2"><div className="text-[10px] text-landing-muted">AEGIS 담당자</div>견적서를 공유드렸습니다. 견적 탭에서 확인해 주세요.</div>
      <div className="max-w-[80%] ml-auto rounded-lg bg-landing-brand text-white px-3 py-2"><div className="text-[10px] opacity-80">김데모</div>납기를 2주 앞당길 수 있을까요?</div>
      <div className="mt-2 rounded-md border border-landing-line px-3 py-2 text-landing-muted3">메시지 입력…</div>
    </div>
  );
}