import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const INCOTERMS_LABEL = {
  EXW: 'EXW (Ex Works)',
  FOB_SHANGHAI: 'FOB Shanghai',
  FOB_GUANGZHOU: 'FOB Guangzhou',
  CIF: 'CIF (Cost, Insurance & Freight)',
};

const CAT_LABEL = {
  DRIP_BAG: '드립백 포장기 (Drip Bag Packaging Machine)',
  SLEEVE: '슬리브 라벨러 (Sleeve Labeler)',
  DESKTOP_LABELER: '탁상형 라벨러 (Desktop Labeler)',
  TUBE_SEALER: '튜브 실링기 (Tube Sealer)',
};

const fmtCNY = (v) => (v || v === 0) ? '¥' + Number(v).toLocaleString() : '-';

function buildHTML(q) {
  const today = new Date().toLocaleDateString('ko-KR');
  const quoteId = (q.id || '').slice(-8).toUpperCase() || '00000000';
  const base = (Number(q.factory_total_cost) || 0) + (Number(q.logistics_cost) || 0);
  const fee = Number(q.masir_fee_amount_cny) || 0;
  const total = Number(q.final_client_price) || (base + fee);

  const krwRate = Number(q.exchange_rate_krw) || 0;
  const usdRate = Number(q.exchange_rate_usd) || 0;
  const krwTotal = krwRate ? Math.round(total * krwRate) : null;
  const usdTotal = (krwRate && usdRate) ? ((total * krwRate) / usdRate).toFixed(2) : null;

  // Line items
  let lineRows = '';
  if (Array.isArray(q.line_items) && q.line_items.length) {
    lineRows = q.line_items.map((li, i) => `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${i + 1}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${li.item_name_ko || li.item_name_cn || ''}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${li.specification || ''}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${li.quantity ?? '-'}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${fmtCNY(li.unit_price_cny)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${fmtCNY(li.total_cny)}</td>
      </tr>`).join('');
  } else {
    const rows = [];
    rows.push({
      no: 1,
      name: `${q.factory_name || ''} — 장비 본체 일체`,
      spec: CAT_LABEL[q.machine_category] || q.machine_category || '-',
      qty: 1, unit: q.factory_total_cost, total: q.factory_total_cost,
    });
    if (Number(q.logistics_cost) > 0) {
      rows.push({
        no: rows.length + 1,
        name: '물류비 (Logistics & Shipping)',
        spec: INCOTERMS_LABEL[q.incoterms] || q.incoterms || '-',
        qty: 1, unit: q.logistics_cost, total: q.logistics_cost,
      });
    }
    if (fee > 0) {
      rows.push({
        no: rows.length + 1,
        name: '서비스 수수료 (MASIA Service Fee)',
        spec: q.masir_fee_type === 'PERCENT' ? `${q.masir_fee_value || 0}% of subtotal` : '고정 (Fixed)',
        qty: '-', unit: '-', total: fee,
      });
    }
    lineRows = rows.map(r => `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${r.no}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${r.name}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${r.spec}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${r.qty}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${typeof r.unit === 'number' ? fmtCNY(r.unit) : r.unit}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${fmtCNY(r.total)}</td>
      </tr>`).join('');
  }

  return `
    <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', -apple-system, sans-serif; color: #0f172a; padding: 40px; background: #fff; width: 794px; box-sizing: border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#2563eb,#14b8a6); border-radius:10px; display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">M</div>
            <div>
              <div style="font-size:22px; font-weight:800; letter-spacing:-0.5px; line-height:1;">MASIA CLOUD</div>
              <div style="font-size:10px; color:#64748b; margin-top:3px;">B2B Sourcing &amp; Trade Platform</div>
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px; font-weight:800; color:#2563eb; line-height:1;">QUOTATION</div>
          <div style="font-size:11px; color:#64748b; margin-top:6px;">견적서 · 报价单</div>
        </div>
      </div>

      <div style="display:flex; gap:16px; margin-bottom:20px;">
        <div style="flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:#f8fafc;">
          <div style="font-size:10px; color:#64748b; font-weight:600; letter-spacing:0.5px; margin-bottom:4px;">TO · 수신처</div>
          <div style="font-size:15px; font-weight:700;">${q.client_name || '-'}</div>
        </div>
        <div style="flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:#f8fafc;">
          <div style="font-size:10px; color:#64748b; font-weight:600; letter-spacing:0.5px; margin-bottom:4px;">FROM · 공급자</div>
          <div style="font-size:15px; font-weight:700;">${q.factory_name || '-'}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
        <tr>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600; width:25%;">견적서 번호</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; width:25%;">Q-${quoteId}</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600; width:25%;">발행일</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; width:25%;">${today}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600;">인코텀즈 (Incoterms)</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb;">${INCOTERMS_LABEL[q.incoterms] || '-'}</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb; background:#f1f5f9; font-weight:600;">통화 (Currency)</td>
          <td style="padding:8px 10px; border:1px solid #e5e7eb;">CNY · 人民币</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:center; width:40px;">No.</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:left;">품목 (Item)</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:left;">규격 (Specification)</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:right; width:60px;">수량</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:right; width:100px;">단가 (Unit)</th>
            <th style="padding:10px 8px; border:1px solid #1e293b; text-align:right; width:110px;">금액 (Amount)</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-bottom:24px;">
        <div style="width:340px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #e5e7eb;">
            <span style="color:#64748b;">Subtotal · 소계</span><strong>${fmtCNY(base)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #e5e7eb;">
            <span style="color:#64748b;">Service Fee · 수수료</span><strong>${fmtCNY(fee)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#2563eb; color:#fff; border-radius:8px; margin-top:8px;">
            <span style="font-weight:700; letter-spacing:0.3px;">TOTAL · 합계</span>
            <strong style="font-size:18px;">${fmtCNY(total)}</strong>
          </div>
          ${(usdTotal || krwTotal) ? `
          <div style="margin-top:8px; font-size:10px; color:#64748b; text-align:right; line-height:1.5;">
            ${usdTotal ? `≈ $${Number(usdTotal).toLocaleString()} USD` : ''}${(usdTotal && krwTotal) ? ' · ' : ''}${krwTotal ? `₩${krwTotal.toLocaleString()} KRW` : ''}
            ${q.exchange_rate_date ? `<br/>환율 기준일: ${q.exchange_rate_date}` : ''}
          </div>` : ''}
        </div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:14px; background:#fafafa; font-size:10.5px; color:#475569; line-height:1.7; margin-bottom:28px;">
        <div style="color:#0f172a; font-size:11px; font-weight:700; margin-bottom:6px;">계약 조건 · Terms &amp; Conditions</div>
        <div>1. 인코텀즈 / Incoterms: ${INCOTERMS_LABEL[q.incoterms] || '별도 협의'}</div>
        <div>2. 견적 유효기간 / Validity: 발행일로부터 30일 (30 days from issue date)</div>
        <div>3. 결제 조건 / Payment: 계약 시 30% 선급금, 출하 전 70% 잔금 (T/T)</div>
        <div>4. 납기 / Delivery: 발주 및 선급금 입금 확인 후 협의된 일정에 따름</div>
        <div>5. 본 견적서는 MASIA CLOUD를 통해 발행되었으며, 명시된 금액에는 서비스 수수료가 포함되어 있습니다.</div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:28px; margin-bottom:32px;">
        <div>
          <div style="font-size:10px; color:#64748b; font-weight:600; margin-bottom:6px;">공급자 서명 · Supplier Signature</div>
          <div style="height:70px; border:1px dashed #cbd5e1; border-radius:6px; background:#fcfcfd;"></div>
          <div style="font-size:10.5px; margin-top:6px; color:#475569;">${q.factory_name || ''} &nbsp;·&nbsp; Date: ____________________</div>
        </div>
        <div>
          <div style="font-size:10px; color:#64748b; font-weight:600; margin-bottom:6px;">고객사 확인 · Client Approval</div>
          <div style="height:70px; border:1px dashed #cbd5e1; border-radius:6px; background:#fcfcfd;"></div>
          <div style="font-size:10.5px; margin-top:6px; color:#475569;">${q.client_name || ''} &nbsp;·&nbsp; Date: ____________________</div>
        </div>
      </div>

      <div style="padding-top:14px; border-top:2px solid #2563eb; text-align:center; font-size:9.5px; color:#64748b;">
        <strong style="color:#2563eb;">MASIA CLOUD</strong> · B2B Sourcing &amp; Trade Platform · Generated automatically on ${today}
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
    pdf.save(`Quotation_${safe(q.factory_name) || 'document'}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}