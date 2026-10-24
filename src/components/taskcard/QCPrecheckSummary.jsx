import React from 'react';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import useQCPrecheck from './qcprecheck/useQCPrecheck';

// 사전 QC 점검 한 줄 요약 (오버뷰·견적 탭). 누르면 업무 탭의 점검 패널로 간다.
export default function QCPrecheckSummary({ card, onOpen }) {
  const { t } = useLanguage();
  const { record, summary, quoteChanged, loading } = useQCPrecheck(card);
  if (loading) return null;
  const open = summary.missing + summary.questions + summary.risks;
  const warn = !record || open > 0 || quoteChanged;
  const parts = !record ? [t('qcp.summaryNone')] : [
    `${t('qcp.todo')} ${summary.missing}`,
    summary.questions ? `${t('qcp.questions')} ${summary.questions}` : '',
    `${t('qcp.risks')} ${summary.risks}`,
    quoteChanged ? t('qcp.quoteChanged') : '',
  ].filter(Boolean);
  return (
    <button type="button" onClick={onOpen}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs ${warn ? 'bg-chart-3/10 text-chart-3' : 'bg-muted/50 text-muted-foreground'}`}>
      <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{t('qcp.summary')}</span>
      <span className="min-w-0 flex-1 truncate">{parts.join(' · ')}</span>
      <span className="hidden shrink-0 sm:inline">{t('qcp.goTasks')}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}
