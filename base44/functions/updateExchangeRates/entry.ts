import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// 매일 09시 KST 워크플로우(DailyExchangeRates)가 호출 — 로그인 세션이 없는 스케줄러 호출이라
// 인증을 강제할 수 없음. 대신 짧은 시간 내 재조회를 막아 공개 함수 URL 남용(외부 API 스팸 호출,
// 불필요한 쓰기 반복)을 방지한다.
const THROTTLE_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rateDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    const existing = await base44.asServiceRole.entities.ExchangeRate.filter({ rate_date: rateDate });
    const current = existing[0];
    if (current?.updated_date) {
      const elapsed = Date.now() - new Date(current.updated_date).getTime();
      if (elapsed < THROTTLE_MS) {
        return Response.json({ success: true, throttled: true, ...current });
      }
    }

    // 무료 공개 환율 API (키 불필요) — USD 기준 환율 조회
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result !== 'success' || !data.rates?.KRW || !data.rates?.CNY) {
      return Response.json({ error: '환율 조회에 실패했습니다' }, { status: 502 });
    }

    const krw = data.rates.KRW;
    const cny = data.rates.CNY;
    const record = {
      rate_date: rateDate,
      usd_krw: Math.round(krw * 100) / 100,
      cny_krw: Math.round((krw / cny) * 100) / 100,
      usd_cny: Math.round(cny * 1000) / 1000,
      source: 'open.er-api.com',
    };

    if (current) {
      await base44.asServiceRole.entities.ExchangeRate.update(current.id, record);
    } else {
      await base44.asServiceRole.entities.ExchangeRate.create(record);
    }

    return Response.json({ success: true, ...record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});