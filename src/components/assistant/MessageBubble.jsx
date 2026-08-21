import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
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

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseResults(toolCall.results);
  const running = ['pending', 'running', 'in_progress'].includes(toolCall.status);
  const failed = isFailed(toolCall, parsed);
  const dp = toolCall.display_projection || {};
  const hidden = dp.hide_details && dp.details_redacted;
  const label = running ? (dp.active_label || '작업 중') : failed ? (dp.error_label || '실패') : (dp.label || toolCall.name);

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => !hidden && setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        {running ? <Loader2 className="w-3 h-3 animate-spin" /> : failed ? <X className="w-3 h-3 text-destructive" /> : <Check className="w-3 h-3 text-accent" />}
        <span className="font-medium">{label}</span>
        {!hidden && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
      </button>
      {expanded && !hidden && (
        <div className="mt-1.5 space-y-1.5 rounded-md bg-muted p-2 font-mono text-[11px] overflow-x-auto">
          <div>
            <p className="text-muted-foreground">Parameters:</p>
            <pre className="whitespace-pre-wrap break-all">{(() => {
              try { return JSON.stringify(JSON.parse(toolCall.arguments_string || '{}'), null, 2); }
              catch { return toolCall.arguments_string; }
            })()}</pre>
          </div>
          {parsed && (
            <div>
              <p className="text-muted-foreground">Result:</p>
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
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-2.5',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
      )}>
        {message.file_urls?.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.file_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs underline break-all">
                <Paperclip className="w-3 h-3 flex-shrink-0" />
                {decodeURIComponent(url.split('/').pop())}
              </a>
            ))}
          </div>
        )}
        {message.content && (isUser
          ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-headings:mt-2 prose-p:my-1.5">{message.content}</ReactMarkdown>
        )}
        {message.tool_calls?.map((toolCall, idx) => <FunctionDisplay key={idx} toolCall={toolCall} />)}
      </div>
    </div>
  );
}