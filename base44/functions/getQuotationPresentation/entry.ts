import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// 고객 견적서 표시용 데이터만 반환한다.
// 원가·수수료·마진 필드는 서버 내부 계산에만 사용하고 절대 응답에 포함하지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { quotation_id } = await req.json();
    if (!quotation_id) return Response.json({ error: 'quotation_id 가 필요합니다' }, { status: 400 });

    // asServiceRole 로 RLS 를 우회하므로 등급을 명시적으로 검사한다 (client 등급 전면 차단)
    const ALLOWED = ['master', 'service', 'sub'];
    if (!ALLOWED.includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const q = await base44.asServiceRole.entities.Quotation.get(quotation_id);
    if (!q) return Response.json({ error: '견적서를 찾을 수 없습니다' }, { status: 404 });
    if (user.account_tier !== 'master' && q.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const usdToKrw = Number(q.exchange_rate_usd) || 0;
    const cnyToKrw = Number(q.exchange_rate_krw) || 0;
    const usdToCny = usdToKrw > 0 && cnyToKrw > 0 ? usdToKrw / cnyToKrw : 0;

    const options = Array.isArray(q.quote_options) ? q.quote_options : [];
    const baseOf = (o) =>
      o.total_usd ?? (Number(o.quantity) || 0) * (Number(o.unit_price ?? o.unit_price_usd) || 0);

    let lineItems = [];
    let totalDisplay = 0;
    let currency = 'USD';

    if (options.length > 0) {
      const feeUSD = usdToKrw > 0 && cnyToKrw > 0 ? ((Number(q.masir_fee_amount_cny) || 0) * cnyToKrw) / usdToKrw : 0;
      const withMarginUSD = options.reduce(
        (s, o) => s + baseOf(o) * (1 + (Number(o.margin_percent) || 0) / 100),
        0
      );
      const totalUSD = Number(q.final_price_usd) > 0 ? Number(q.final_price_usd) : withMarginUSD + feeUSD;
      const factor = withMarginUSD > 0 ? totalUSD / withMarginUSD : 1;

      const optCurs = [...new Set(options.map((o) => o.currency || 'USD'))];
      const inferred = optCurs.length === 1 ? optCurs[0] : 'USD';
      currency = ['USD', 'CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : inferred;
      const fromUSD = (v) =>
        currency === 'USD' ? v : currency === 'CNY' ? (usdToCny > 0 ? v * usdToCny : 0) : usdToKrw > 0 ? Math.round(v * usdToKrw) : 0;

      lineItems = options.map((o) => {
        const total = fromUSD(baseOf(o) * (1 + (Number(o.margin_percent) || 0) / 100) * factor);
        const qty = Number(o.quantity) || 0;
        return {
          option_name: o.option_name || '',
          specification: o.specification || '',
          quantity: o.quantity ?? null,
          unit_price_display: qty > 0 ? total / qty : total,
          total_display: total,
        };
      });
      totalDisplay = fromUSD(totalUSD);
    } else {
      // 레거시 경로: CNY 기준 (제품 금액에 수수료 합산, 물류비 별도 행)
      currency = 'CNY';
      const factoryCost = Number(q.factory_total_cost) || 0;
      const logistics = Number(q.logistics_cost) || 0;
      const fee = Number(q.masir_fee_amount_cny) || 0;
      const productTotal = factoryCost + fee;
      lineItems.push({
        option_name: q.product_name || '장비 본체 일체',
        specification: q.model_name || '-',
        quantity: 1,
        unit_price_display: productTotal,
        total_display: productTotal,
      });
      if (logistics > 0) {
        lineItems.push({
          option_name: '물류비 (Logistics & Shipping)',
          specification: q.incoterms || '-',
          quantity: 1,
          unit_price_display: logistics,
          total_display: logistics,
        });
      }
      totalDisplay = Number(q.final_client_price) || factoryCost + logistics + fee;
    }

    const issuer = q.quote_issuer === 'FACTORY' ? 'FACTORY' : 'AEGIS';

    return Response.json({
      id: q.id,
      quote_title: q.quote_title || '',
      product_name: q.product_name || '',
      model_name: q.model_name || '',
      client_name: q.client_name || '',
      incoterms: q.incoterms || '',
      advance_payment_percent: Number(q.advance_payment_percent) || 0,
      balance_payment_percent: Number(q.balance_payment_percent) || 0,
      shipping_days: Number(q.shipping_days) || 0,
      final_currency: currency,
      exchange_rate_date: q.exchange_rate_date || '',
      exchange_rate_usd: usdToKrw,
      exchange_rate_krw: cnyToKrw,
      quote_issuer: issuer,
      issuer_name: issuer === 'FACTORY' ? q.factory_name || '' : 'DONGGUAN AEGIS TRADE CO., LTD',
      remarks: q.remarks || '',
      product_image_url: q.product_image_url || '',
      line_items: lineItems,
      total_display: totalDisplay,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}