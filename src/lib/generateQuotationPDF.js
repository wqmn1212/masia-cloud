import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { INCOTERMS_LABEL } from '@/lib/incoterms';

// html2canvas는 line-height가 없으면 텍스트를 셀 아래쪽으로 밀어 그리므로 명시적으로 지정
const CELL_V = 'line-height:1.35;vertical-align:middle;';
const td = `padding:7px 8px;border:1px solid #e5e7eb;${CELL_V}`;

const CURRENCY_SYMBOL = { USD: '$', CNY: '¥', KRW: '₩' };
const CURRENCY_LABEL = { USD: 'USD · US Dollar', CNY: 'CNY · 人民币', KRW: 'KRW · 대한민국 원' };
const fmt = (v, cur) => {
  if (v == null) return '-';
  const sym = CURRENCY_SYMBOL[cur] || '$';
  return sym + Number(v).toLocaleString(undefined, { maximumFractionDigits: cur === 'KRW' ? 0 : 2 });
};

function buildRows(p) {
  return (p.line_items || []).map((r, i) => `
      <tr>
        <td style="${td}text-align:center;">${i + 1}</td>
        <td style="${td}">${r.option_name || ''}</td>
        <td style="${td}">${r.specification || ''}</td>
        <td style="${td}text-align:right;">${r.quantity ?? '-'}</td>
        <td style="${td}text-align:right;">${fmt(r.unit_price_display, p.final_currency)}</td>
        <td style="${td}text-align:right;">${fmt(r.total_display, p.final_currency)}</td>
      </tr>`).join('');
}

// 서버(getQuotationPresentation)에서 계산된 고객 표시가만 사용한다 — 원가·수수료·마진 필드는 조회하지 않는다.
function buildHTML(p) {
  const today = new Date().toLocaleDateString('ko-KR');
  const quoteId = (p.id || '').slice(-8).toUpperCase() || '00000000';
  const cur = p.final_currency || 'USD';
  const adv = p.advance_payment_percent || 30;
  const bal = p.balance_payment_percent || (100 - adv);
  const shipDays = p.shipping_days || 0;
  const issuer = p.issuer_name || 'DONGGUAN AEGIS TRADE CO., LTD';

  const rateParts = [];
  if (p.exchange_rate_usd > 0) rateParts.push(`$1 = ₩${Number(p.exchange_rate_usd).toLocaleString()}`);
  if (p.exchange_rate_krw > 0) rateParts.push(`¥1 = ₩${Number(p.exchange_rate_krw).toLocaleString()}`);

  return `
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', -apple-system, sans-serif; color: #0f172a; padding: 40px; background: #fff; width: 794px; box-sizing: border-box; line-height:1.4;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#2563eb,#14b8a6); border-radius:10px; display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">${issuer.slice(0, 1)}</div>
            <div>
              <div style="font-size:19px; font-weight:800; letter-spacing:-0.3px; line-height:1.2;">${issuer}</div>
              <div style="font-size:10px; color:#64748b; margin-top:3px;">Industrial Machinery Sourcing &amp; Trade</div>
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px; font-weight:800; color:#2563eb; line-height:1;">QUOTATION</div>
          <div style="font-size:11px; color:#64748b; margin-top:6px;">견적서 · 报价单</div>
        </div>
      </div>

      ${p.quote_title ? `<div style="font-size:16px; font-weight:700; margin-bottom:16px; text-align:center; padding:12px 10px 10px; background:#f1f5f9; border-radius:8px; line-height:1.4; ${CELL_V}">${p.quote_title}</div>` : ''}

      ${p.product_image_url ? `
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${p.product_image_url}" crossorigin="anonymous" style="max-height:200px; max-width:70%; border:1px solid #e5e7eb; border-radius:8px; object-fit:contain;" />
        ${p.product_name ? `<div style="font-size:10px; color:#64748b; margin-top:6px;">${p.product_name}${p.model_name ? ` · ${p.model_name}` : ''}</div>` : ''}
      </div>` : ''}

      <div style="display:flex; gap:16px; margin-bottom:20px; align-items:stretch;">
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; border:1px solid #e5e7eb; border-radius:8px; padding:13px 12px 11px; background:#f8fafc;">
          <div style="font-size:10px; color:#64748b; font-weight:600; letter-spacing:0.5px; margin-bottom:4px; line-height:1.5; ${CELL_V}">TO · 수신처 (고객사)</div>
          <div style="font-size:15px; font-weight:700; line-height:1.4; ${CELL_V}">${p.client_name || '-'}</div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; border:1px solid #e5e7eb; border-radius:8px; padding:13px 12px 11px; background:#f8fafc;">
          <div style="font-size:10px; color:#64748b; font-weight:600; letter-spacing:0.5px; margin-bottom:4px; line-height:1.5; ${CELL_V}">FROM · 발행처</div>
          <div style="font-size:13px; font-weight:700; line-height:1.4; ${CELL_V}">${issuer}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
        <tr>
          <td style="${td}background:#f1f5f9; font-weight:600; width:18%;">견적서 번호</td>
          <td style="${td}width:32%;">Q-${quoteId}</td>
          <td style="${td}background:#f1f5f9; font-weight:600; width:18%;">발행일</td>
          <td style="${td}width:32%;">${today}</td>
        </tr>
        <tr>
          <td style="${td}background:#f1f5f9; font-weight:600;">제품명</td>
          <td style="${td}">${p.product_name || '-'}</td>
          <td style="${td}background:#f1f5f9; font-weight:600;">모델명</td>
          <td style="${td}">${p.model_name || '-'}</td>
        </tr>
        <tr>
          <td style="${td}background:#f1f5f9; font-weight:600;">인코텀즈</td>
          <td style="${td}">${INCOTERMS_LABEL[p.incoterms] || '-'}</td>
          <td style="${td}background:#f1f5f9; font-weight:600;">통화 (Currency)</td>
          <td style="${td}">${CURRENCY_LABEL[cur] || cur}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:9px 8px; border:1px solid #1e293b; ${CELL_V} text-align:center; width:40px;">No.</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; ${CELL_V} text-align:left;">항목 (Item / Option)</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; ${CELL_V} text-align:left;">사양 (Specification)</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; ${CELL_V} text-align:right; width:55px;">수량</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; ${CELL_V} text-align:right; width:100px;">단가 (Unit)</th>
            <th style="padding:9px 8px; border:1px solid #1e293b; ${CELL_V} text-align:right; width:110px;">금액 (Amount)</th>
          </tr>
        </thead>
        <tbody>${buildRows(p)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-bottom:24px;">
        <div style="width:340px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#2563eb; color:#fff; border-radius:8px; line-height:1.2;">
            <span style="font-weight:700; letter-spacing:0.3px; line-height:1.2;">TOTAL · 합계</span>
            <strong style="font-size:18px; line-height:1.2;">${fmt(p.total_display, cur)}</strong>
          </div>
          ${rateParts.length ? `
          <div style="margin-top:8px; font-size:10.5px; color:#64748b; text-align:right; line-height:1.6;">
            당일 적용 환율: ${rateParts.join(' · ')}${p.exchange_rate_date ? ` (기준일: ${p.exchange_rate_date})` : ''}
          </div>` : ''}
        </div>
      </div>

      <div style="display:flex; flex-direction:column; justify-content:center; border:1px solid #e5e7eb; border-radius:8px; padding:15px 14px 13px; background:#fafafa; font-size:10.5px; color:#475569; line-height:1.7; margin-bottom:28px; ${CELL_V.replace('line-height:1.35;', '')}">
        <div style="color:#0f172a; font-size:11px; font-weight:700; margin-bottom:6px; line-height:1.5;">계약 조건 · Terms &amp; Conditions</div>
        <div>1. 인코텀즈 / Incoterms: ${INCOTERMS_LABEL[p.incoterms] || '별도 협의'}</div>
        <div>2. 견적 유효기간 / Validity: 발행일로부터 30일 (30 days from issue date)</div>
        <div>3. 결제 조건 / Payment: 계약 시 선금 ${adv}%, 출하 전 잔금 ${bal}% (T/T)</div>
        <div>4. 납기 / Delivery: ${shipDays > 0 ? `발주 및 선금 입금 확인 후 ${shipDays}일 이내 출하 (${shipDays} days after order confirmation)` : '발주 및 선금 입금 확인 후 협의된 일정에 따름'}</div>
        <div>5. 실제 결제는 ${cur} 기준으로 진행됩니다.</div>
      </div>

      ${p.remarks ? `
      <div style="display:flex; flex-direction:column; justify-content:center; border:1px solid #fde68a; border-radius:8px; padding:15px 14px 13px; background:#fffbeb; font-size:10.5px; color:#475569; line-height:1.7; margin-bottom:28px; vertical-align:middle;">
        <div style="color:#0f172a; font-size:11px; font-weight:700; margin-bottom:6px; line-height:1.5;">비고 · Remarks</div>
        <div style="white-space:pre-wrap; line-height:1.7; vertical-align:middle;">${p.remarks}</div>
      </div>` : ''}

      <div style="display:flex; align-items:center; justify-content:center; padding-top:16px; padding-bottom:2px; border-top:2px solid #2563eb; text-align:center; font-size:9.5px; color:#64748b; line-height:1.6; ${CELL_V}">
        <span style="line-height:1.6;"><strong style="color:#2563eb;">${issuer}</strong> · Generated automatically on ${today}</span>
      </div>
    </div>
  `;
}

export async function generateQuotationPDF(quotation) {
  const quotationId = typeof quotation === 'string' ? quotation : quotation?.id;
  const res = await base44.functions.invoke('getQuotationPresentation', { quotation_id: quotationId });
  const p = res.data;
  if (!p || p.error) throw new Error(p?.error || '견적서 표시 정보를 불러올 수 없습니다');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.background = '#fff';
  container.innerHTML = buildHTML(p);
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

    const pageDivs = pagesBlocks.map((list) => {
      const page = document.createElement('div');
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px;box-sizing:border-box;background:#fff;overflow:hidden;font-family:'Noto Sans KR','Malgun Gothic',-apple-system,sans-serif;color:#0f172a;line-height:1.4;`;
      list.forEach((b) => page.appendChild(b));
      container.appendChild(page);
      return page;
    });
    root.remove();

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
    pdf.save(`Quotation_${safe(p.quote_title || p.product_name || p.client_name) || 'document'}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}