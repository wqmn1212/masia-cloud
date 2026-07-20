import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 무료 공개 환율 API (키 불필요) — USD 기준 환율 조회
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result !== 'success' || !data.rates?.KRW || !data.rates?.CNY) {
      return Response.json({ error: '환율 조회에 실패했습니다' }, { status: 502 });
    }

    const krw = data.rates.KRW;
    const cny = data.rates.CNY;
    const record = {
      rate_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
      usd_krw: Math.round(krw * 100) / 100,
      cny_krw: Math.round((krw / cny) * 100) / 100,
      usd_cny: Math.round(cny * 1000) / 1000,
      source: 'open.er-api.com',
    };

    const existing = await base44.asServiceRole.entities.ExchangeRate.filter({ rate_date: record.rate_date });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ExchangeRate.update(existing[0].id, record);
    } else {
      await base44.asServiceRole.entities.ExchangeRate.create(record);
    }

    return Response.json({ success: true, ...record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});