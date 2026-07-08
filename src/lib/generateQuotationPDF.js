import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const INCOTERMS_LABEL = {
  EXW: 'EXW (Ex Works)',
  FOB_SHANGHAI: 'FOB Shanghai',
  FOB_GUANGZHOU: 'FOB Guangzhou',
  CIF: 'CIF (Cost, Insurance & Freight)',
};

const fmtUSD = (v) => (v || v === 0) ? '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-';
const fmtCNY = (v) => (v || v === 0) ? '¥' + Number(v).toLocaleString() : '-';

const td = 'padding:8px;border:1px solid #e5e7eb;';

const CURRENCY_SYMBOL = { USD: '$', CNY: '¥', KRW: '₩' };
const fmtByCurrency = (v, cur) => {
  if (v == null && v !== 0) return '-';
  const sym = CURRENCY_SYMBOL[cur] || '$';
  return sym + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

function buildOptionRows(q) {
  const options = Array.isArray(q.quote_options) ? q.quote_options : [];
  return options.map((o, i) => {
    const unit = o.unit_price ?? o.unit_price_usd;
    const cur = o.unit_price != null ? (o.currency || 'USD') : 'USD';
    const total = o.total_usd ?? (Number(o.quantity) || 0) * (Number(unit) || 0);
    return `
      <tr>
        <td style="${td}text-align:center;">${i + 1}</td>
        <td style="${td}">${o.option_name || ''}</td>
        <td style="${td}">${o.specification || ''}</td>
        <td style="${td}text-align:right;">${o.quantity ?? '-'}</td>
        <td style="${td}text-align:right;">${fmtByCurrency(unit, cur)}${cur !== 'USD' ? ` <span style="color:#94a3b8;font-size:9px;">${cur}</span>` : ''}</td>
        <td style="${td}text-align:right;">${fmtUSD(total)}</td>
      </tr>`;
  }).join('');
}

function buildLegacyRows(q, fee) {
  const rows = [{
    no: 1,
    name: `${q.factory_name || ''} — 장비 본체 일체`,
    spec: '-',
    qty: 1, unit: q.factory_total_cost, total: q.factory_total_cost,
  }];
  if (Number(q.logistics_cost) > 0) {
    rows.push({ no: rows.length + 1, name: '물류비 (Logistics & Shipping)', spec: INCOTERMS_LABEL[q.incoterms] || '-', qty: 1, unit: q.logistics_cost, total: q.logistics_cost });
  }
  if (fee > 0) {
    rows.push({ no: rows.length + 1, name: '서비스 수수료 (Service Fee)', spec: q.masir_fee_type === 'PERCENT' ? `${q.masir_fee_value || 0}%` : 'Fixed', qty: '-', unit: '-', total: fee });
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
  let lineRows, totalLabelHtml, currencyLabel;

  if (hasOptions) {
    const totalUSD = q.options_total_usd ?? q.quote_options.reduce((s, o) => s + (o.total_usd ?? (Number(o.quantity) || 0) * (Number(o.unit_price ?? o.unit_price_usd) || 0)), 0);
    const totalKRW = usdToKrw ? Math.round(totalUSD * usdToKrw) : null;
    lineRows = buildOptionRows(q);
    currencyLabel = 'USD · US Dollar';
    totalLabelHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#2563eb; color:#fff; border-radius:8px;">
        <span style="font-weight:700; letter-spacing:0.3px;">TOTAL · 합계</span>
        <strong style="font-size:18px;">${fmtUSD(totalUSD)}</strong>
      </div>
      ${totalKRW ? `
      <div style="margin-top:8px; font-size:10.5px; color:#64748b; text-align:right; line-height:1.6;">
        참고 원화 환산: <strong style="color:#0f172a;">₩${totalKRW.toLocaleString()} KRW</strong><br/>
        당일 적용 환율: $1 = ₩${usdToKrw.toLocaleString()}${Number(q.exchange_rate_krw) > 0 ? ` · ¥1 = ₩${Number(q.exchange_rate_krw).toLocaleString()}` : ''}${q.exchange_rate_date ? ` (기준일: ${q.exchange_rate_date})` : ''}
      </div>` : ''}`;
  } else {
    const base = (Number(q.factory_total_cost) || 0) + (Number(q.logistics_cost) || 0);
    const fee = Number(q.masir_fee_amount_cny) || 0;
    const total = Number(q.final_client_price) || (base + fee);
    const krwRate = Number(q.exchange_rate_krw) || 0;
    const krwTotal = krwRate ? Math.round(total * krwRate) : null;
    lineRows = buildLegacyRows(q, fee);
    currencyLabel = 'CNY · 人民币';
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
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', -apple-system, sans-serif; color: #0f172a; padding: 40px; background: #fff; width: 794px; box-sizing: border-box;">
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
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600; width:18%;">견적서 번호</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; width:32%;">Q-${quoteId}</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600; width:18%;">발행일</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; width:32%;">${today}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600;">제품명</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb;">${q.product_name || '-'}</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600;">모델명</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb;">${q.model_name || '-'}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600;">인코텀즈</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb;">${INCOTERMS_LABEL[q.incoterms] || '-'}</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600;">통화 (Currency)</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb;">${currencyLabel}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:center; width:40px;">No.</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:left;">항목 (Item / Option)</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:left;">사양 (Specification)</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:right; width:55px;">수량</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:right; width:100px;">단가 (Unit)</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:right; width:110px;">금액 (Amount)</th>
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
        <div>3. 결제 조건 / Payment: 계약 시 30% 선급금, 출하 전 70% 잔금 (T/T)</div>
        <div>4. 납기 / Delivery: 발주 및 선급금 입금 확인 후 협의된 일정에 따름</div>
        <div>5. 원화(KRW) 환산 금액은 참고용이며, 실제 결제는 USD 기준으로 진행됩니다.</div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:28px; margin-bottom:32px;">
        <div>
          <div style="font-size:10px; color:#64748b; font-weight:600; margin-bottom:6px;">공급자 서명 · Supplier Signature</div>
          <div style="height:70px; border:1px dashed #cbd5e1; border-radius:6px; background:#fcfcfd;"></div>
          <div style="font-size:10.5px; margin-top:6px; color:#475569;">DONGGUAN AEGIS TRADE CO., LTD &nbsp;·&nbsp; Date: ____________________</div>
        </div>
        <div>
          <div style="font-size:10px; color:#64748b; font-weight:600; margin-bottom:6px;">고객사 확인 · Client Approval</div>
          <div style="height:70px; border:1px dashed #cbd5e1; border-radius:6px; background:#fcfcfd;"></div>
          <div style="font-size:10.5px; margin-top:6px; color:#475569;">${q.client_name || ''} &nbsp;·&nbsp; Date: ____________________</div>
        </div>
      </div>

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
    await new Promise((r) => setTimeout(r, 80));
    const target = container.firstElementChild;
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    } else {
      let position = 0;
      let heightLeft = imgHeight;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    const safe = (s) => String(s || '').replace(/[^\w\u3131-\uD79D一-龥]+/g, '_').slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`Quotation_${safe(q.quote_title || q.product_name || q.factory_name) || 'document'}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}