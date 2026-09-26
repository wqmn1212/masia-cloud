// 카드당 1건의 정산 원장(FinancialLedger)을 입금 확인 상태에 맞춰 자동 생성·갱신한다.
const LEDGER_INCOTERMS = ['EXW', 'FOB_SHANGHAI', 'FOB_GUANGZHOU', 'CIF'];
const QUOTE_PRIORITY = ['ACCEPTED', 'SENT', 'APPROVED', 'REVIEW', 'DRAFT'];

const num = (value) => Number(value) || 0;
const round = (value) => Math.round(value * 100) / 100;

function pickQuotation(quotes) {
  if (!quotes.length) return null;
  return [...quotes].sort((a, b) => {
    const pa = QUOTE_PRIORITY.indexOf(a.status), pb = QUOTE_PRIORITY.indexOf(b.status);
    const ra = pa < 0 ? 99 : pa, rb = pb < 0 ? 99 : pb;
    if (ra !== rb) return ra - rb;
    return String(b.updated_date || '').localeCompare(String(a.updated_date || ''));
  })[0];
}

// 견적의 최종 제안가·원가를 USD 기준 원장 금액으로 변환한다.
function amountsFromQuote(quote) {
  if (!quote) return {};
  const rate = num(quote.exchange_rate_usd_cny);
  const toUsd = (cny) => (rate > 0 ? cny / rate : 0);
  const sale = num(quote.final_price_usd) || toUsd(num(quote.final_client_price));
  const cost = num(quote.options_total_usd) || toUsd(num(quote.factory_total_cost));
  const result = {
    client_to_factory_usd: round(sale),
    factory_base_cost_usd: round(cost),
    expected_kickback_usd: round(sale - cost),
    logistics_cost_usd: round(num(quote.logistics_estimated_usd)),
  };
  if (rate > 0) result.exchange_rate = rate;
  if (LEDGER_INCOTERMS.includes(quote.incoterms)) result.incoterms = quote.incoterms;
  if (quote.product_name || quote.model_name) result.machine_description = [quote.product_name, quote.model_name].filter(Boolean).join(' ');
  return result;
}

function statusFromStages(stages, current) {
  const approved = (type) => stages.some(s => s.stage_type === type && s.approval_status === 'APPROVED');
  if (approved('BALANCE_PAYMENT')) return current === 'PAID_OUT' ? 'PAID_OUT' : 'SETTLED';
  if (approved('DOWN_PAYMENT')) return 'KICKBACK_RECEIVED';
  return 'PENDING';
}

function paidNote(stages) {
  const date = (type) => stages.find(s => s.stage_type === type && s.approval_status === 'APPROVED')?.paid_date;
  const parts = [];
  if (date('DOWN_PAYMENT')) parts.push(`선금 입금 ${date('DOWN_PAYMENT')}`);
  if (date('BALANCE_PAYMENT')) parts.push(`잔금 입금 ${date('BALANCE_PAYMENT')}`);
  return parts.join(' · ');
}

export async function syncCardLedger(svc, card) {
  const stages = await svc.entities.PaymentStage.filter({ card_id: card.id });
  const [ledger] = await svc.entities.FinancialLedger.filter({ card_id: card.id }, '-created_date', 1);
  const status = statusFromStages(stages, ledger?.status);
  // 입금 확인 이력이 없는 카드에는 원장을 새로 만들지 않는다.
  if (!ledger && status === 'PENDING') return null;

  const quotes = await svc.entities.Quotation.filter({ card_id: card.id }, '-updated_date', 20);
  const amounts = amountsFromQuote(pickQuotation(quotes));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const base = {
    tenant_id: card.tenant_id,
    card_id: card.id,
    factory_id: card.factory_id || '',
    factory_name: card.factory_name || ledger?.factory_name || '미지정',
    client_id: card.client_id || '',
    client_name: card.client_name || ledger?.client_name || '미지정',
    status,
    note_2: paidNote(stages),
  };

  if (!ledger) {
    return await svc.entities.FinancialLedger.create({
      ...amounts,
      ...base,
      project_date: card.advance_paid_date || today,
      masir_fee_type: 'PERCENT',
    });
  }
  // 이미 입력된 금액은 덮어쓰지 않고, 비어 있는 금액만 견적에서 채운다.
  const fill = Object.fromEntries(Object.entries(amounts).filter(([key]) => !ledger[key]));
  return await svc.entities.FinancialLedger.update(ledger.id, { ...fill, ...base });
}