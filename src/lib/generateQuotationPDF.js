import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { INCOTERMS_LABEL } from '@/lib/incoterms';

const fmtUSD = (v) => (v || v === 0) ? '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-';
const fmtCNY = (v) => (v || v === 0) ? '¥' + Number(v).toLocaleString() : '-';

// html2canvas는 line-height가 없으면 텍스트를 셀 아래쪽으로 밀어 그리므로 명시적으로 지정
const CELL_V = 'line-height:1.35;vertical-align:middle;';
const td = `padding:7px 8px;border:1px solid #e5e7eb;${CELL_V}`;

const CURRENCY_SYMBOL = { USD: '$', CNY: '¥', KRW: '₩' };
const fmtByCurrency = (v, cur) => {
  if (v == null && v !== 0) return '-';
  const sym = CURRENCY_SYMBOL[cur] || '$';
  return sym + Number(v).toLocaleString(undefined, { maximumFractionDigits: cur === 'KRW' ? 0 : 2 });
};

// 고객 PDF: 수수료를 각 항목 금액에 비례 배분하여 수수료 포함 가격으로 표시 (수수료 항목 미노출)
function buildOptionRows(q, factor = 1, convert = (v) => v, cur = 'USD') {
  const options = Array.isArray(q.quote_options) ? q.quote_options : [];
  return options.map((o, i) => {
    const baseTotal = o.total_usd ?? (Number(o.quantity) || 0) * (Number(o.unit_price ?? o.unit_price_usd) || 0);
    // 항목별 마진율 적용 (고객 표시 가격)
    const withMargin = baseTotal * (1 + (Number(o.margin_percent) || 0) / 100);
    const total = convert(withMargin * factor);
    const qty = Number(o.quantity) || 0;
    const unit = qty > 0 ? total / qty : total;
    return `
      <tr>
        <td style="${td}text-align:center;">${i + 1}</td>
        <td style="${td}">${o.option_name || ''}</td>
        <td style="${td}">${o.specification || ''}</td>
        <td style="${td}text-align:right;">${o.quantity ?? '-'}</td>
        <td style="${td}text-align:right;">${fmtByCurrency(unit, cur)}</td>
        <td style="${td}text-align:right;">${fmtByCurrency(total, cur)}</td>
      </tr>`;
  }).join('');
}

// 고객 PDF: 공장명 미노출, 수수료는 제품 금액에 합산하여 표시
function buildLegacyRows(q, fee) {
  const productTotal = (Number(q.factory_total_cost) || 0) + fee;
  const rows = [{
    no: 1,
    name: q.product_name || '장비 본체 일체',
    spec: q.model_name || '-',
    qty: 1, unit: productTotal, total: productTotal,
  }];
  if (Number(q.logistics_cost) > 0) {
    rows.push({ no: rows.length + 1, name: '물류비 (Logistics & Shipping)', spec: INCOTERMS_LABEL[q.incoterms] || '-', qty: 1, unit: q.logistics_cost, total: q.logistics_cost });
  }
  return rows.map(r => `
    <tr>
      <td style="${td}text-align:center;">${r.no}</td>
      <td style="${td}">${r.name}</td>
      <td style="${td}">${r.spec}</td>
      <td style="${td}text-align:right;">${r.qty}</td>
      <td style="${td}text-align:right;">${typeof r.unit === 'number' ? fmtCNY(r.unit) : r.unit}</td>
      <td style="${td}text-align:right;">${fmtCNY(r.total)}</td>
    </tr>`).join('');
}

function buildHTML(q) {
  const today = new Date().toLocaleDateString('ko-KR');
  const quoteId = (q.id || '').slice(-8).toUpperCase() || '00000000';
  const hasOptions = Array.isArray(q.quote_options) && q.quote_options.length > 0;

  const usdToKrw = Number(q.exchange_rate_usd) || 0;
  const adv = Number(q.advance_payment_percent) || 30;
  const bal = Number(q.balance_payment_percent) || (100 - adv);
  const shipDays = Number(q.shipping_days) || 0;
  let lineRows, totalLabelHtml, currencyLabel, settleCur = 'USD';

  if (hasOptions) {
    const baseUSD = q.options_total_usd ?? q.quote_options.reduce((s, o) => s + (o.total_usd ?? (Number(o.quantity) || 0) * (Number(o.unit_price ?? o.unit_price_usd) || 0)), 0);
    const cnyToKrw = Number(q.exchange_rate_krw) || 0;
    const usdToCny = (usdToKrw > 0 && cnyToKrw > 0) ? usdToKrw / cnyToKrw : 0;
    const feeUSD = (usdToKrw > 0 && cnyToKrw > 0) ? (Number(q.masir_fee_amount_cny) || 0) * cnyToKrw / usdToKrw : 0;
    // 항목별 마진 포함 합계 — 전체 수수료는 마진 포함 금액에 비례 배분
    const withMarginUSD = q.quote_options.reduce((s, o) => {
      const b = o.total_usd ?? (Number(o.quantity) || 0) * (Number(o.unit_price ?? o.unit_price_usd) || 0);
      return s + b * (1 + (Number(o.margin_percent) || 0) / 100);
    }, 0);
    const totalUSD = Number(q.final_price_usd) > 0 ? Number(q.final_price_usd) : withMarginUSD + feeUSD;
    const factor = withMarginUSD > 0 ? totalUSD / withMarginUSD : 1;

    // 견적 작성 시 선택한 최종 메인 통화로 모든 옵션 단가와 합계를 환산
    const optCurs = [...new Set(q.quote_options.map(o => o.currency || 'USD'))];
    const inferredCurrency = optCurs.length === 1 ? optCurs[0] : 'USD';
    const primary = ['USD', 'CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : inferredCurrency;
    settleCur = primary;
    const fromUSD = (v, cur) =>
      cur === 'USD' ? v
      : cur === 'CNY' ? (usdToCny > 0 ? v * usdToCny : 0)
      : (usdToKrw > 0 ? Math.round(v * usdToKrw) : 0);

    lineRows = buildOptionRows(q, factor, (v) => fromUSD(v, primary), primary);
    currencyLabel = primary === 'USD' ? 'USD · US Dollar' : primary === 'CNY' ? 'CNY · 人民币' : 'KRW · 대한민국 원';

    const totalPrimary = fromUSD(totalUSD, primary);
    const refParts = ['USD', 'CNY', 'KRW']
      .filter(c => c !== primary)
      .map(c => ({ c, v: fromUSD(totalUSD, c) }))
      .filter(r => r.v > 0)
      .map(r => `<strong style="color:#0f172a;">${fmtByCurrency(r.v, r.c)} ${r.c}</strong>`);
    const rateParts = [];
    if (usdToKrw > 0) rateParts.push(`$1 = ₩${usdToKrw.toLocaleString()}`);
    if (cnyToKrw > 0) rateParts.push(`¥1 = ₩${cnyToKrw.toLocaleString()}`);
    if (usdToCny > 0) rateParts.push(`$1 = ¥${usdToCny.toFixed(3)}`);

    totalLabelHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#2563eb; color:#fff; border-radius:8px; line-height:1.2;">
        <span style="font-weight:700; letter-spacing:0.3px; line-height:1.2;">TOTAL · 합계</span>
        <strong style="font-size:18px; line-height:1.2;">${fmtByCurrency(totalPrimary, primary)}</strong>
      </div>
      ${refParts.length || rateParts.length ? `
      <div style="margin-top:8px; font-size:10.5px; color:#64748b; text-align:right; line-height:1.6;">
        ${refParts.length ? `참고 환산: ${refParts.join(' · ')}<br/>` : ''}
        ${rateParts.length ? `당일 적용 환율: ${rateParts.join(' · ')}${q.exchange_rate_date ? ` (기준일: ${q.exchange_rate_date})` : ''}` : ''}
      </div>` : ''}`;
  } else {
    const base = (Number(q.factory_total_cost) || 0) + (Number(q.logistics_cost) || 0);
    const fee = Number(q.masir_fee_amount_cny) || 0;
    const total = Number(q.final_client_price) || (base + fee);
    const krwRate = Number(q.exchange_rate_krw) || 0;
    const krwTotal = krwRate ? Math.round(total * krwRate) : null;
    lineRows = buildLegacyRows(q, fee);
    currencyLabel = 'CNY · 人民币';
    settleCur = 'CNY';
    totalLabelHtml = `
      <div style="display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #e5e7eb;">
        <span style="color:#64748b;">Subtotal · 소계</span><strong>${fmtCNY(base)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#2563eb; color:#fff; border-radius:8px; margin-top:8px;">
        <span style="font-weight:700; letter-spacing:0.3px;">TOTAL · 합계</span>
        <strong style="font-size:18px;">${fmtCNY(total)}</strong>
      </div>
      ${krwTotal ? `<div style="margin-top:8px; font-size:10px; color:#64748b; text-align:right;">≈ ₩${krwTotal.toLocaleString()} KRW</div>` : ''}`;
  }

  return `
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', -apple-system, sans-serif; color: #0f172a; padding: 40px; background: #fff; width: 794px; box-sizing: border-box; line-height:1.4;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#2563eb,#14b8a6); border-radius:10px; display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">A</div>
            <div>
              <div style="font-size:19px; font-weight:800; letter-spacing:-0.3px; line-height:1.2;">DONGGUAN AEGIS TRADE CO., LTD</div>
              <div style="font-size:10px; color:#64748b; margin-top:3px;">Industrial Machinery Sourcing &amp; Trade</div>
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px; font-weight:800; color:#2563eb; line-height:1;">QUOTATION</div>
          <div style="font-size:11px; color:#64748b; margin-top:6px;">견적서 · 报价单</div>
        </div>
      </div>

      ${q.quote_title ? `<div style="font-size:16px; font-weight:700; margin-bottom:16px; text-align:center; padding:10px; background:#f1f5f9; border-radius:8px;">${q.quote_title}</div>` : ''}

      ${q.product_image_url ? `
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${q.product_image_url}" crossorigin="anonymous" style="max-height:200px; max-width:70%; border:1px solid #e5e7eb; border-radius:8px; object-fit:contain;" />
        ${q.product_name ? `<div style="font-size:10px; color:#64748b; margin-top:6px;">${q.product_name}${q.model_name ? ` · ${q.model_name}` : ''}</div>` : ''}
      </div>` : ''}

      <div style="display:flex; gap:16px; margin-bottom:20px;">
        <div style="flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:#f8fafc;">
          <div style="font-size:10px; color:#64748b; font-weight:600; letter-spacing:0.5px; margin-bottom:4px;">TO · 수신처 (고객사)</div>
          <div style="font-size:15px; font-weight:700;">${q.client_name || '-'}</div>
        </div>
        <div style="flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:#f8fafc;">
          <div style="font-size:10px; color:#64748b; font-weight:600; letter-spacing:0.5px; margin-bottom:4px;">FROM · 발행처</div>
          <div style="font-size:13px; font-weight:700;">DONGGUAN AEGIS TRADE CO., LTD</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
        <tr>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; background:#f1f5f9; font-weight:600; width:18%;">견적서 번호</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; width:32%;">Q-${quoteId}</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; background:#f1f5f9; font-weight:600; width:18%;">발행일</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; width:32%;">${today}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; background:#f1f5f9; font-weight:600;">제품명</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle;">${q.product_name || '-'}</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; background:#f1f5f9; font-weight:600;">모델명</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle;">${q.model_name || '-'}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; background:#f1f5f9; font-weight:600;">인코텀즈</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle;">${INCOTERMS_LABEL[q.incoterms] || '-'}</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle; background:#f1f5f9; font-weight:600;">통화 (Currency)</td>
          <td style="padding:7px 10px; border:1px solid #e5e7eb; line-height:1.35; vertical-align:middle;">${currencyLabel}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:9px 8px; border:1px solid #1e293b; line-height:1.35; vertical-align:middle; text-align:center; width:40px;">No.</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; line-height:1.35; vertical-align:middle; text-align:left;">항목 (Item / Option)</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; line-height:1.35; vertical-align:middle; text-align:left;">사양 (Specification)</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; line-height:1.35; vertical-align:middle; text-align:right; width:55px;">수량</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; line-height:1.35; vertical-align:middle; text-align:right; width:100px;">단가 (Unit)</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; line-height:1.35; vertical-align:middle; text-align:right; width:110px;">금액 (Amount)</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-bottom:24px;">
        <div style="width:340px; font-size:12px;">
          ${totalLabelHtml}
        </div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:14px; background:#fafafa; font-size:10.5px; color:#475569; line-height:1.7; margin-bottom:28px;">
        <div style="color:#0f172a; font-size:11px; font-weight:700; margin-bottom:6px;">계약 조건 · Terms &amp; Conditions</div>
        <div>1. 인코텀즈 / Incoterms: ${INCOTERMS_LABEL[q.incoterms] || '별도 협의'}</div>
        <div>2. 견적 유효기간 / Validity: 발행일로부터 30일 (30 days from issue date)</div>
        <div>3. 결제 조건 / Payment: 계약 시 선금 ${adv}%, 출하 전 잔금 ${bal}% (T/T)</div>
        <div>4. 납기 / Delivery: ${shipDays > 0 ? `발주 및 선금 입금 확인 후 ${shipDays}일 이내 출하 (${shipDays} days after order confirmation)` : '발주 및 선금 입금 확인 후 협의된 일정에 따름'}</div>
        <div>5. 참고 환산 금액은 참고용이며, 실제 결제는 ${settleCur} 기준으로 진행됩니다.</div>
      </div>

      ${q.remarks ? `
      <div style="border:1px solid #fde68a; border-radius:8px; padding:14px; background:#fffbeb; font-size:10.5px; color:#475569; line-height:1.7; margin-bottom:28px;">
        <div style="color:#0f172a; font-size:11px; font-weight:700; margin-bottom:6px;">비고 · Remarks</div>
        <div style="white-space:pre-wrap;">${q.remarks}</div>
      </div>` : ''}

      <div style="padding-top:14px; border-top:2px solid #2563eb; text-align:center; font-size:9.5px; color:#64748b;">
        <strong style="color:#2563eb;">DONGGUAN AEGIS TRADE CO., LTD</strong> · Generated automatically on ${today}
      </div>
    </div>
  `;
}

export async function generateQuotationPDF(q) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.background = '#fff';
  container.innerHTML = buildHTML(q);
  document.body.appendChild(container);

  try {
    await Promise.all(Array.from(container.querySelectorAll('img')).map(img =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })
    ));
    await new Promise((r) => setTimeout(r, 80));
    const root = container.firstElementChild;
    const blocks = Array.from(root.children);

    // A4 비율의 페이지 컨테이너 (794px = 210mm 기준)
    const PAGE_W = 794;
    const PAGE_H = Math.round((PAGE_W * 297) / 210); // ≈ 1123px
    const PAD = 40;
    const USABLE = PAGE_H - PAD * 2;

    // 블록 높이를 측정해 페이지별로 그룹핑 (블록이 페이지 경계에서 잘리지 않도록)
    const pagesBlocks = [[]];
    let used = 0;
    for (const block of blocks) {
      const style = window.getComputedStyle(block);
      const h = block.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      if (used + h > USABLE && pagesBlocks[pagesBlocks.length - 1].length > 0) {
        pagesBlocks.push([]);
        used = 0;
      }
      pagesBlocks[pagesBlocks.length - 1].push(block);
      used += h;
    }

    // 각 페이지를 실제 A4 크기 컨테이너로 재구성
    const pageDivs = pagesBlocks.map((list) => {
      const page = document.createElement('div');
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px;box-sizing:border-box;background:#fff;overflow:hidden;font-family:'Noto Sans KR','Malgun Gothic',-apple-system,sans-serif;color:#0f172a;line-height:1.4;`;
      list.forEach((b) => page.appendChild(b));
      container.appendChild(page);
      return page;
    });
    root.remove();

    // 페이지 단위로 캡처 → PDF 한 페이지에 정확히 매핑
    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < pageDivs.length; i++) {
      const canvas = await html2canvas(pageDivs[i], {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }

    const safe = (s) => String(s || '').replace(/[^\w\u3131-\uD79D一-龥]+/g, '_').slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`Quotation_${safe(q.quote_title || q.product_name || q.factory_name) || 'document'}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}