import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Plus, TriangleAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

// 불량 기록 보기: 이 카드에 남은 불량(언제·어떤 작업 중·무슨 불량·몇 건)과,
// 같은 팀의 다른 카드에서 난 비슷한 불량·QC 사례·고객 클레임. QC 검수 화면과 양산 탭이 쓴다.
// 불량은 AI 비서에게 불량 엑셀을 보내거나, 검사 성적서를 올리면(불합격) 쌓인다.
const call = async (body) => (await base44.functions.invoke('defectLog', body)).data;
const SOURCE = { DEFECT: ['불량 기록', 'bg-destructive/10 text-destructive'], CASE: ['QC 사례', 'bg-primary/10 text-primary'], CLAIM: ['고객 클레임', 'bg-warning/15 text-warning-text'] };
const ORIGIN = { ASSISTANT: 'AI 비서', INSPECTION: '검사 성적서', MANUAL: '직접 입력' };

export default function DefectInsights({ card, text = '', onAdd, showSimilar = true }) {
  const logsQ = useQuery({ queryKey: ['defect-logs', card.id], queryFn: () => call({ action: 'list', card_id: card.id }), staleTime: 30_000 });
  const query = [card.title, card.title_cn, text].filter(Boolean).join(' ');
  const simQ = useQuery({ queryKey: ['defect-similar', card.id, query], queryFn: () => call({ action: 'similar', card_id: card.id, text: query }), enabled: showSimilar && !!query.trim(), staleTime: 60_000 });
  const logs = logsQ.data?.logs || [];
  const similar = (simQ.data?.results || []).filter((r) => !(r.source === 'DEFECT' && r.same_card));
  if (!logs.length && !similar.length) {
    return logsQ.isLoading ? null : <p className="text-caption text-muted-foreground">이 카드에 불량 기록이 없고, 비슷한 과거 불량도 없습니다. 불량 엑셀을 AI 비서에게 보내면 여기에 쌓입니다.</p>;
  }
  return (
    <div className="space-y-3">
      {!!similar.length && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <p className="flex items-center gap-1.5 text-label font-semibold text-warning-text"><TriangleAlert className="h-4 w-4" />비슷한 과거 불량 {similar.length}건 — 이번 검수에서 확인하세요</p>
          <ul className="mt-2 space-y-2">{similar.map((r) => (
            <li key={`${r.source}-${r.line}`} className="flex flex-wrap items-start gap-2">
              <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-micro font-semibold ${SOURCE[r.source][1]}`}>{SOURCE[r.source][0]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-label">{r.line}</p>
                {r.prevention && <p className="text-caption text-muted-foreground">예방책: {r.prevention}</p>}
                <p className="text-micro text-muted-foreground">겹친 말: {r.matched.join(', ')}{r.same_card ? ' · 이 카드 이전 기록' : ''}</p>
              </div>
              {onAdd && <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-caption" onClick={() => onAdd(`${r.title} 확인`)}><Plus className="h-3.5 w-3.5" />검수 항목에 추가</Button>}
            </li>
          ))}</ul>
        </div>
      )}
      {!!logs.length && (
        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-label font-semibold"><History className="h-4 w-4 text-muted-foreground" />이 카드 불량 기록 {logs.length}건</p>
          <ul className="mt-2 divide-y">{logs.slice(0, 30).map((l) => (
            <li key={l.id} className="py-1.5">
              <p className="text-label">{l.line}</p>
              <p className="text-micro text-muted-foreground">{[l.serial_range && `시리얼 ${l.serial_range}`, l.description, ORIGIN[l.source], l.source_file, l.by].filter(Boolean).join(' · ')}</p>
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
