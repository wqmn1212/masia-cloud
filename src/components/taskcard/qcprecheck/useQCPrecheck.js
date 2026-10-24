import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { detectComponents, evaluatePrecheck, mergeDecisions, quotationHash, summarize } from '@/lib/qcPrecheck';

// 사전 QC 점검 공용 조회: 최신 점검 기록, 카드의 최신 견적, QC 사례, 카드 장비 분류 이름.
// 패널(업무 탭)·요약(오버뷰·견적 탭)·생산 착수 줄이 같이 쓴다.
export default function useQCPrecheck(card) {
  const qc = useQueryClient();
  const key = ['qc-precheck', card.id];
  const precheckQ = useQuery({ queryKey: key, queryFn: () => base44.entities.QCPrecheck.filter({ card_id: card.id }, '-version', 1) });
  const quotesQ = useQuery({ queryKey: ['quotations-by-card', card.id], queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date') });
  const casesQ = useQuery({ queryKey: ['qc-cases'], queryFn: () => base44.entities.QCKnowledgeLog.list('-created_date', 200), staleTime: 60_000 });
  const catsQ = useQuery({ queryKey: ['machine-categories'], queryFn: () => base44.entities.MachineCategory.list('label_kr', 100), staleTime: 300_000 });

  const record = precheckQ.data?.[0] || null;
  const quotation = (quotesQ.data || []).find((q) => q.status !== 'CANCELLED') || quotesQ.data?.[0] || null;
  const cases = casesQ.data || [];
  const categoryLabel = (catsQ.data || []).find((c) => c.key && c.key === card.target_machine_category)?.label_kr || '';
  const currentHash = quotationHash(quotation);
  const quoteChanged = !!record && !!quotation && record.quotation_hash !== currentHash;
  const summary = summarize(record?.items || []);

  // 견적·카드에서 구성품을 다시 찾아 새 점검 버전을 만든다 (이전 사양 입력·결정은 이어받음)
  const run = async (by) => {
    const { components } = detectComponents({ quotation, card, categoryLabel, previous: record?.components || [] });
    const items = mergeDecisions(evaluatePrecheck({ components, cases }), record?.items || []);
    const created = await base44.entities.QCPrecheck.create({
      tenant_id: card.tenant_id, card_id: card.id, quotation_id: quotation?.id || '', quotation_hash: currentHash,
      version: (record?.version || 0) + 1, components, items, ai_status: 'NONE', created_by_name: by || '',
    });
    await qc.invalidateQueries({ queryKey: key });
    return created;
  };

  // 사양·구성품이 바뀌면 규칙을 다시 돌려 같은 기록에 저장
  const saveComponents = async (components) => {
    const items = mergeDecisions(evaluatePrecheck({ components, cases }), record?.items || []);
    await base44.entities.QCPrecheck.update(record.id, { components, items });
    await qc.invalidateQueries({ queryKey: key });
  };

  const saveItems = async (items) => {
    await base44.entities.QCPrecheck.update(record.id, { items });
    await qc.invalidateQueries({ queryKey: key });
  };

  const preview = !record ? detectComponents({ quotation, card, categoryLabel }) : null;
  return { record, quotation, cases, categoryLabel, quoteChanged, summary, preview, run, saveComponents, saveItems, loading: precheckQ.isLoading || quotesQ.isLoading, refresh: () => qc.invalidateQueries({ queryKey: key }) };
}
