const money = (v, cur = 'USD') =>
  v == null ? '-' : `${cur} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// 견적서 정보를 기반으로 표준 공급계약서 초안 본문을 생성한다.
export function buildStandardContract(q, { issuerName = 'AEGIS', contractDate } = {}) {
  const date = contractDate || new Date().toISOString().slice(0, 10);
  const product = q?.quote_title || q?.product_name || '견적서 기재 설비';
  const currency = q?.final_currency || 'USD';
  const amount = money(q?.final_price_usd, 'USD');
  const advance = q?.advance_payment_percent ?? 30;
  const balance = q?.balance_payment_percent ?? (100 - advance);
  const shippingDays = q?.shipping_days;
  const seller = q?.quote_issuer === 'FACTORY' ? (q?.factory_name || '공급자') : issuerName;

  const items = (q?.quote_options || [])
    .map((o, i) => `  ${i + 1}. ${o.option_name || '-'}${o.specification ? ` (${o.specification})` : ''} — 수량 ${o.quantity ?? 1}`)
    .join('\n');

  return [
    '공급계약서',
    '',
    `본 계약은 ${seller}(이하 "공급자")와 ${q?.client_name || '고객사'}(이하 "구매자") 간에 아래 설비의 공급에 관하여 ${date} 체결된다.`,
    '',
    '제1조 (계약의 목적 및 대상)',
    `공급자는 구매자에게 아래 설비를 공급하고, 구매자는 그 대금을 지급한다.`,
    `  - 품목: ${product}`,
    q?.model_name ? `  - 모델: ${q.model_name}` : null,
    items ? `  - 구성 내역:\n${items}` : null,
    '',
    '제2조 (계약 금액)',
    `계약 총액은 ${amount} 이며, 표시 통화는 ${currency} 로 한다. 계약 금액에는 견적서에 명시된 항목만 포함되고, 명시되지 않은 추가 요청 사항은 별도 협의한다.`,
    '',
    '제3조 (대금 지급 조건)',
    `구매자는 계약 체결 시 계약 총액의 ${advance}%를 선금으로 지급하고, 출하 전 잔금 ${balance}%를 지급한다. 송금 수수료는 송금인이 부담한다.`,
    '',
    '제4조 (인도 조건 및 납기)',
    `인도 조건은 ${q?.incoterms || '견적서 기재 조건'} (Incoterms 2020) 에 따른다.${shippingDays ? ` 납기는 선금 입금 확인일로부터 ${shippingDays}일 이내로 한다.` : ' 납기는 선금 입금 확인일로부터 기산한다.'}`,
    '',
    '제5조 (검수 및 인수)',
    '공급자는 출하 전 구매자 또는 구매자가 지정한 대리인의 검수를 수용하며, 검수 합격 후 선적한다. 구매자는 인도 후 7일 내 수량 및 외관 이상을 통지한다.',
    '',
    '제6조 (보증)',
    '공급자는 설치 완료일로부터 12개월간 제조상 결함에 대해 무상 수리 및 부품 교체를 제공한다. 단, 소모품 및 사용자 과실로 인한 손상은 제외한다.',
    '',
    '제7조 (기밀 유지)',
    '양 당사자는 본 계약 이행 과정에서 취득한 상대방의 도면, 사양, 거래 조건 등 일체의 정보를 상대방의 서면 동의 없이 제3자에게 누설하지 않는다.',
    '',
    '제8조 (분쟁 해결)',
    '본 계약에 관한 분쟁은 상호 협의로 해결하되, 협의가 이루어지지 않을 경우 대한민국 법을 준거법으로 하여 구매자 주소지 관할 법원에서 해결한다.',
    '',
    '특약 사항',
    '(조항 라이브러리에서 필요한 특약을 선택해 아래에 삽입하세요)',
    '',
    '',
    `계약일: ${date}`,
    '',
    `공급자: ${seller}                    (서명/인)`,
    `구매자: ${q?.client_name || ''}                    (서명/인)`,
  ].filter(Boolean).join('\n');
}