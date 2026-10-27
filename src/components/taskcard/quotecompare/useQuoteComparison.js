import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import useLogisticsRates from '@/components/landedcost/useLogisticsRates';
import { buildSheet, clientView, computeSheet, sheetWarnings } from '@/lib/quoteCompare';

// 견적 비교표 공용 조회: 카드의 최신 비교표, 카드 견적, 물류 요율·환율.
// 견적 탭 패널·비교표 창·확정 창이 같이 쓴다. 금액은 저장하지 않고 견적에서 매번 다시 계산한다.
export default function useQuoteComparison(card) {
  const qc = useQueryClient();
  const key = ['quote-comparison', card.id];
  const sheetQ = useQuery({ queryKey: key, queryFn: () => base44.entities.QuoteComparison.filter({ card_id: card.id }, '-created_date', 10) });
  const quotesQ = useQuery({ queryKey: ['quotations-by-card', card.id], queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date') });
  const { rates, usdKrw, usdCny, rateDate } = useLogisticsRates();

  const records = sheetQ.data || [];
  const record = records.find((r) => r.status !== 'CLOSED') || null;
  const quotations = quotesQ.data || [];
  const byId = useMemo(() => Object.fromEntries(quotations.map((q) => [q.id, q])), [quotations]);
  // 위안 환율이 환율 기록에 없으면 가장 최근 견적의 환율을 쓴다
  const latestFx = useMemo(() => ({
    usd_krw: usdKrw || quotations.find((q) => Number(q.exchange_rate_usd) > 0)?.exchange_rate_usd || null,
    usd_cny: usdCny || quotations.find((q) => Number(q.exchange_rate_usd_cny) > 0)?.exchange_rate_usd_cny || null,
    date: rateDate || null,
  }), [usdKrw, usdCny, rateDate, quotations]);
  const fx = record?.fx?.usd_krw ? record.fx : latestFx;

  const computed = useMemo(() => (record ? computeSheet(record, byId, { rates, fx }) : null), [record, byId, rates, fx]);
  const published = record && record.status !== 'DRAFT';
  const warnings = useMemo(() => (computed ? sheetWarnings(computed, { publishedHashes: published ? record.source_hashes : null }) : []), [computed, published, record]);
  const stale = warnings.some((w) => w.code === 'STALE');

  const patchCache = (patch) => qc.setQueryData(key, (old = []) => old.map((r) => (r.id === record.id ? { ...r, ...patch } : r)));
  const save = async (patch) => {
    patchCache(patch);
    try { await base44.entities.QuoteComparison.update(record.id, patch); } finally { qc.invalidateQueries({ queryKey: key }); }
  };

  const create = async (ids, by) => {
    const chosen = ids.map((id) => byId[id]).filter(Boolean);
    const sheet = buildSheet({ quotations: chosen, title: card.title || '' });
    const created = await base44.entities.QuoteComparison.create({
      tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id || '', status: 'DRAFT', version: 0,
      fx: latestFx, ...sheet, created_by_name: by || '',
    });
    await qc.invalidateQueries({ queryKey: key });
    return created;
  };

  // 안 구성을 바꾸면 줄 맞추기를 다시 하고, 같은 견적의 안 이름·조건·포장 정보는 이어받는다
  const changeOptions = async (ids) => {
    const sheet = buildSheet({ quotations: ids.map((id) => byId[id]).filter(Boolean), title: record.title });
    const prev = Object.fromEntries((record.options || []).map((o) => [o.quotation_id, o]));
    const options = sheet.options.map((o) => {
      const p = prev[o.quotation_id];
      if (!p) return o;
      return { ...o, label: /^[A-E]안$/.test(p.label) ? o.label : p.label, show_factory_name: !!p.show_factory_name, cargo: p.cargo || {}, conditions: p.conditions || {}, extra: p.extra || {}, logistics_scope: p.logistics_scope || null };
    });
    await save({ options, rows: sheet.rows });
  };

  // AI 비서가 만든 초안(안만 있고 줄이 없는 비교표)은 처음 열 때 줄 맞추기를 한다
  const built = useRef(null);
  useEffect(() => {
    if (!record || record.status !== 'DRAFT' || (record.rows || []).length || !(record.options || []).length || quotesQ.isLoading || built.current === record.id) return;
    built.current = record.id;
    changeOptions(record.options.map((o) => o.quotation_id)).then(() => { if (!record.fx?.usd_krw) save({ fx: latestFx }); }).catch(() => { built.current = null; });
  }, [record, quotesQ.isLoading]);

  const refreshFx = () => save({ fx: latestFx });

  const publish = async (by) => {
    const version = (record.version || 0) + 1;
    const snapshot = clientView(computed, record, { version });
    const hashes = Object.fromEntries(computed.options.filter((o) => !o.missing).map((o) => [o.key, o.hash]));
    await save({
      status: record.status === 'CONFIRMED' ? 'CONFIRMED' : record.client_choice?.option_key && snapshot.options.some((o) => o.key === record.client_choice.option_key) ? 'CHOSEN' : 'PUBLISHED',
      version, client_snapshot: snapshot, source_hashes: hashes, published_at: new Date().toISOString(), published_by_name: by || '',
    });
    base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'comparison_published' }).catch(() => {});
    return snapshot;
  };

  const close = () => save({ status: 'CLOSED' });

  return {
    record, records, quotations, byId, computed, warnings, stale, fx, latestFx, rates,
    loading: sheetQ.isLoading || quotesQ.isLoading,
    create, save, changeOptions, refreshFx, publish, close,
    refresh: () => qc.invalidateQueries({ queryKey: key }),
  };
}
