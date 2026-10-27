import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, X, Loader2, ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

const parseResults = (results) => {
  if (!results) return null;
  if (typeof results !== 'string') return results;
  try { return JSON.parse(results); } catch { return results; }
};

const isFailed = (toolCall, parsed) =>
  ['failed', 'error'].includes(toolCall.status) ||
  (typeof toolCall.results === 'string' && /error|failed/i.test(toolCall.results)) ||
  (parsed && parsed.success === false);

// 도구 이름 대신 사람이 읽는 말로 (진행 중 / 끝)
const FN_LABELS = {
  assistantDestCost: ['도착 비용 정산서 처리 중', '도착 비용 정산서 처리'],
  assistantStatus: ['현황 확인 중', '현황 확인'],
  assistantDraft: ['초안 만드는 중', '초안 만들기'],
  assistantCreateQuotation: ['견적 등록 중', '견적 등록'],
  parseQuotationExcel: ['견적서 파일 읽는 중', '견적서 파일 읽기'],
};
const ENTITY_LABELS = {
  TaskCard: '업무 카드', CardAttachment: '카드 파일', CardFolder: '카드 폴더', TaskItem: '할 일', Company: '회사',
  Quotation: '견적', MeetingLog: '미팅 기록', AIProposal: 'AI 제안', DecisionLog: '결정 기록', Shipment: '선적',
  QuoteComparison: '견적 비교표', LandedCostRecord: '도착 원가', Contract: '계약서',
};
// 같은 함수라도 단계마다 다른 말로
const STEP_LABELS = {
  'assistantDestCost:find': ['선적 찾는 중', '선적 찾기'],
  'assistantDestCost:parse': ['정산서 읽는 중', '정산서 읽기'],
  'assistantDestCost:apply': ['도착 비용 기록 중', '도착 비용 기록'],
  'assistantDraft:comparison': ['비교표 초안 만드는 중', '비교표 초안 만들기'],
  'assistantDraft:contract': ['계약서 초안 만드는 중', '계약서 초안 만들기'],
};
const parseArgs = (s) => { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } };
const toolLabel = (name = '', running, argsString) => {
  const fn = Object.keys(FN_LABELS).find((k) => name.includes(k));
  if (fn) {
    const a = parseArgs(argsString);
    const step = STEP_LABELS[`${fn}:${a.action || a.kind}`];
    return (step || FN_LABELS[fn])[running ? 0 : 1];
  }
  const ent = Object.keys(ENTITY_LABELS).sort((a, b) => b.length - a.length).find((k) => name.includes(k));
  if (!ent) return running ? '작업 중' : name;
  const write = /create|update|delete|write/i.test(name);
  return `${ENTITY_LABELS[ent]} ${write ? (running ? '저장 중' : '저장') : (running ? '조회 중' : '조회')}`;
};

// 사이트 글자 역할(body·label)에 맞춘 마크다운. 비서는 미리보기를 표로 보낸다.
const MD = {
  p: (props) => <p className="my-1.5 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="my-1.5 list-disc space-y-0.5 pl-5" {...props} />,
  ol: (props) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5" {...props} />,
  h1: (props) => <p className="mb-1 mt-3 font-semibold first:mt-0" {...props} />,
  h2: (props) => <p className="mb-1 mt-3 font-semibold first:mt-0" {...props} />,
  h3: (props) => <p className="mb-1 mt-3 font-semibold first:mt-0" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => <a className="font-medium text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
  code: (props) => <code className="rounded bg-muted px-1 py-0.5 text-label" {...props} />,
  blockquote: (props) => <blockquote className="my-2 border-l-2 border-warning pl-3 text-warning-text" {...props} />,
  table: (props) => <div className="my-2 overflow-x-auto rounded-lg border"><table className="w-full text-label" {...props} /></div>,
  thead: (props) => <thead className="bg-muted/60 text-muted-foreground" {...props} />,
  th: ({ style, ...props }) => <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium" style={style} {...props} />,
  td: ({ style, ...props }) => <td className="border-t px-2.5 py-1.5 align-top tabular-nums" style={style} {...props} />,
};

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseResults(toolCall.results);
  const running = ['pending', 'running', 'in_progress'].includes(toolCall.status);
  const failed = isFailed(toolCall, parsed);
  const dp = toolCall.display_projection || {};
  const hidden = dp.hide_details && dp.details_redacted;
  const label = running ? (dp.active_label || toolLabel(toolCall.name, true, toolCall.arguments_string)) : failed ? (dp.error_label || `${toolLabel(toolCall.name, false, toolCall.arguments_string)} 실패`) : (dp.label || toolLabel(toolCall.name, false, toolCall.arguments_string));

  return (
    <div className="text-label">
      <button
        onClick={() => !hidden && setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        {running ? <Loader2 className="w-3 h-3 animate-spin" /> : failed ? <X className="w-3 h-3 text-destructive" /> : <Check className="w-3 h-3 text-primary" />}
        <span className="font-medium">{label}</span>
        {!hidden && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
      </button>
      {expanded && !hidden && (
        <div className="mt-1.5 space-y-1.5 rounded-md bg-muted p-2 font-mono text-caption overflow-x-auto">
          <div>
            <p className="text-muted-foreground">보낸 값</p>
            <pre className="whitespace-pre-wrap break-all">{(() => {
              try { return JSON.stringify(JSON.parse(toolCall.arguments_string || '{}'), null, 2); }
              catch { return toolCall.arguments_string; }
            })()}</pre>
          </div>
          {parsed && (
            <div>
              <p className="text-muted-foreground">결과</p>
              <pre className="whitespace-pre-wrap break-all">{typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  // 첨부 링크를 따로 보여 주므로 본문 끝의 '첨부 파일:' 줄은 뺀다
  const content = isUser && message.file_urls?.length ? message.content?.replace(/\n*첨부 파일: [^\n]*$/, '') : message.content;
  const tools = message.tool_calls || [];
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-2.5',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
      )}>
        {message.file_urls?.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.file_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-label underline break-all">
                <Paperclip className="w-3 h-3 flex-shrink-0" />
                {decodeURIComponent(url.split('/').pop())}
              </a>
            ))}
          </div>
        )}
        {tools.length > 0 && (
          <div className={cn('space-y-1', content && 'mb-2 border-b pb-2')}>
            {tools.map((toolCall, idx) => <FunctionDisplay key={idx} toolCall={toolCall} />)}
          </div>
        )}
        {content && (isUser
          ? <p className="text-body whitespace-pre-wrap">{content}</p>
          : <div className="text-body"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{content}</ReactMarkdown></div>
        )}
      </div>
    </div>
  );
}