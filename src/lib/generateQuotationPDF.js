import jsPDF from 'jspdf';
import { base44 } from '@/api/base44Client';
import { INCOTERMS_LABEL } from '@/lib/incoterms';
import { loadPdfFonts, imageToJpeg } from '@/lib/pdfFonts';

// 텍스트 기반 PDF — 글자·표는 실제 텍스트로, 제품 사진만 압축 이미지로 넣는다.
const SYM = { USD: '$', CNY: '¥', KRW: '₩' };
const LABEL = { USD: 'USD · US Dollar', CNY: 'CNY · Chinese Yuan', KRW: 'KRW · 대한민국 원' };
const fmt = (v, cur, digits = 2) => v == null ? '-' : (SYM[cur] || '$') + Number(v).toLocaleString(undefined, { maximumFractionDigits: cur === 'KRW' ? 0 : digits });
const BLUE = [37, 99, 235], INK = [15, 23, 42], MUTED = [100, 116, 139], LINE = [229, 231, 235], SOFT = [241, 245, 249];
const LOGO_URL = 'https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/b5bab8215_2x.png';
const W = 210, H = 297, M = 15, CW = W - M * 2;

export async function generateQuotationPDF(quotation) {
  const quotationId = typeof quotation === 'string' ? quotation : quotation?.id;
  const res = await base44.functions.invoke('getQuotationPresentation', { quotation_id: quotationId });
  const p = res.data;
  if (!p || p.error) throw new Error(p?.error || '견적서 표시 정보를 불러올 수 없습니다');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await loadPdfFonts(pdf);
  let y = M;
  const color = (c) => pdf.setTextColor(...c);
  const font = (size, bold) => { pdf.setFont('Nanum', bold ? 'bold' : 'normal'); pdf.setFontSize(size); };
  const ensure = (h) => { if (y + h > H - M) { pdf.addPage(); y = M; } };

  const cur = p.final_currency || 'USD';
  const issuer = p.issuer_name || 'DONGGUAN AEGIS TRADE CO., LTD';
  const today = new Date().toLocaleDateString('ko-KR');
  const quoteId = (p.id || '').slice(-8).toUpperCase() || '00000000';
  const adv = p.advance_payment_percent || 30;
  const bal = p.balance_payment_percent || (100 - adv);
  const shipDays = p.shipping_days || 0;

  // 헤더
  const logo = await imageToJpeg(LOGO_URL, 700, { x: 0.29, y: 0.3, w: 0.42, h: 0.4 }).catch(() => null);
  if (logo) {
    const lh = 12, lw = lh * (logo.w / logo.h);
    pdf.addImage(logo.data, 'JPEG', M, y - 1, lw, lh);
  } else {
    font(13, true); color(INK); pdf.text(issuer, M, y + 5);
  }
  font(20, true); color(BLUE); pdf.text('QUOTATION', W - M, y + 7, { align: 'right' });
  font(8); color(MUTED); pdf.text('견적서', W - M, y + 11.5, { align: 'right' });
  y += 15; pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.8); pdf.line(M, y, W - M, y); y += 7;

  if (p.quote_title) {
    pdf.setFillColor(...SOFT); pdf.roundedRect(M, y, CW, 10, 2, 2, 'F');
    font(12, true); color(INK); pdf.text(p.quote_title, W / 2, y + 6.5, { align: 'center', maxWidth: CW - 6 });
    y += 14;
  }

  if (p.product_image_url) {
    const img = await imageToJpeg(p.product_image_url).catch(() => null);
    if (img) {
      const ih = Math.min(55, (img.h / img.w) * CW * 0.7), iw = ih * (img.w / img.h);
      pdf.addImage(img.data, 'JPEG', (W - iw) / 2, y, iw, ih);
      y += ih + 2;
      if (p.product_name) { font(7.5); color(MUTED); pdf.text(`${p.product_name}${p.model_name ? ` · ${p.model_name}` : ''}`, W / 2, y + 3, { align: 'center' }); y += 5; }
      y += 4;
    }
  }

  // 수신/발행처
  const half = (CW - 5) / 2;
  [['TO · 수신처 (고객사)', p.client_name || '-'], ['FROM · 발행처', issuer]].forEach(([lab, val], i) => {
    const x = M + i * (half + 5);
    pdf.setFillColor(248, 250, 252); pdf.setDrawColor(...LINE); pdf.setLineWidth(0.2); pdf.roundedRect(x, y, half, 15, 2, 2, 'FD');
    font(7, true); color(MUTED); pdf.text(lab, x + 4, y + 5.5);
    font(10.5, true); color(INK); pdf.text(val, x + 4, y + 11, { maxWidth: half - 8 });
  });
  y += 20;

  // 정보 표
  const info = [['견적서 번호', `Q-${quoteId}`, '발행일', today], ['제품명', p.product_name || '-', '모델명', p.model_name || '-'], ['인코텀즈', INCOTERMS_LABEL[p.incoterms] || '-', '통화 (Currency)', LABEL[cur] || cur]];
  const iw = [30, 60, 30, 60];
  font(8);
  info.forEach((row) => {
    let x = M;
    row.forEach((v, i) => {
      if (i % 2 === 0) { pdf.setFillColor(...SOFT); pdf.rect(x, y, iw[i], 8, 'F'); }
      pdf.setDrawColor(...LINE); pdf.rect(x, y, iw[i], 8);
      font(8, i % 2 === 0); color(INK); pdf.text(String(v), x + 2, y + 5.3, { maxWidth: iw[i] - 4 });
      x += iw[i];
    });
    y += 8;
  });
  y += 6;

  // 항목 표
  const cols = [{ w: 10, a: 'center', t: 'No.' }, { w: 50, t: '항목 (Item / Option)' }, { w: 52, t: '사양 (Specification)' }, { w: 16, a: 'right', t: '수량' }, { w: 25, a: 'right', t: '단가 (Unit)' }, { w: 27, a: 'right', t: '금액 (Amount)' }];
  const drawRow = (cells, head) => {
    font(8, head);
    const lines = cells.map((c, i) => pdf.splitTextToSize(String(c ?? ''), cols[i].w - 4));
    const h = Math.max(...lines.map((l) => l.length)) * 3.8 + 4;
    ensure(h);
    let x = M;
    cols.forEach((c, i) => {
      if (head) { pdf.setFillColor(30, 41, 59); pdf.rect(x, y, c.w, h, 'F'); pdf.setTextColor(255, 255, 255); } else color(INK);
      pdf.setDrawColor(...(head ? [30, 41, 59] : LINE)); pdf.rect(x, y, c.w, h);
      const tx = c.a === 'right' ? x + c.w - 2 : c.a === 'center' ? x + c.w / 2 : x + 2;
      pdf.text(lines[i], tx, y + 5, { align: c.a || 'left' });
      x += c.w;
    });
    y += h;
  };
  drawRow(cols.map((c) => c.t), true);
  (p.line_items || []).forEach((r, i) => drawRow([i + 1, r.option_name, r.specification, r.quantity ?? '-', fmt(r.unit_price_display, cur, 5), fmt(r.total_display, cur)]));
  y += 6;

  // 합계 + 참고 환산
  ensure(26);
  const tx = W - M - 90;
  pdf.setFillColor(...BLUE); pdf.roundedRect(tx, y, 90, 11, 2, 2, 'F');
  font(9, true); pdf.setTextColor(255, 255, 255); pdf.text('TOTAL · 합계', tx + 4, y + 7);
  font(13, true); pdf.text(fmt(p.total_display, cur), W - M - 4, y + 7.5, { align: 'right' });
  y += 15;
  const usd = p.total_usd != null ? p.total_usd : null;
  const refs = [];
  if (usd != null) {
    if (cur !== 'USD') refs.push(fmt(usd, 'USD'));
    if (cur !== 'CNY' && p.exchange_rate_usd_cny > 0) refs.push(fmt(usd * p.exchange_rate_usd_cny, 'CNY'));
    if (cur !== 'KRW' && p.exchange_rate_usd > 0) refs.push(fmt(usd * p.exchange_rate_usd, 'KRW'));
  }
  const rates = [];
  if (p.exchange_rate_usd_cny > 0) rates.push(`$1 = ¥${Number(p.exchange_rate_usd_cny).toLocaleString()}`);
  if (p.exchange_rate_usd > 0) rates.push(`$1 = ₩${Number(p.exchange_rate_usd).toLocaleString()}`);
  font(7.5); color(MUTED);
  if (refs.length) { pdf.text(`참고 환산: ${refs.join(' · ')}`, W - M, y, { align: 'right' }); y += 4.5; }
  if (rates.length) { pdf.text(`적용 환율: ${rates.join(' · ')}${p.exchange_rate_date ? ` (기준일: ${p.exchange_rate_date})` : ''}`, W - M, y, { align: 'right' }); y += 4.5; }
  y += 6;

  // 박스 섹션 (계약 조건 / 비고)
  const box = (title, text, fill, border) => {
    font(8);
    const lines = pdf.splitTextToSize(text, CW - 8);
    const h = lines.length * 4.2 + 12;
    ensure(h);
    pdf.setFillColor(...fill); pdf.setDrawColor(...border); pdf.roundedRect(M, y, CW, h, 2, 2, 'FD');
    font(8.5, true); color(INK); pdf.text(title, M + 4, y + 6);
    font(8); color([71, 85, 105]); pdf.text(lines, M + 4, y + 11.5, { lineHeightFactor: 1.5 });
    y += h + 6;
  };
  box('계약 조건 · Terms & Conditions', [
    `1. 인코텀즈 / Incoterms: ${INCOTERMS_LABEL[p.incoterms] || '별도 협의'}`,
    '2. 견적 유효기간 / Validity: 발행일로부터 30일 (30 days from issue date)',
    `3. 결제 조건 / Payment: 계약 시 선금 ${adv}%, 출하 전 잔금 ${bal}% (T/T)`,
    `4. 납기 / Delivery: ${shipDays > 0 ? `발주 및 선금 입금 확인 후 ${shipDays}일 이내 출하 (${shipDays} days after order confirmation)` : '발주 및 선금 입금 확인 후 협의된 일정에 따름'}`,
    `5. 실제 결제는 ${cur} 기준으로 진행됩니다.`,
  ].join('\n'), [250, 250, 250], LINE);
  if (p.remarks) box('비고 · Remarks', p.remarks, [255, 251, 235], [253, 230, 138]);

  // 푸터
  ensure(10);
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.5); pdf.line(M, y, W - M, y);
  font(7.5); color(MUTED); pdf.text(`${issuer} · Generated automatically on ${today}`, W / 2, y + 5, { align: 'center' });

  const safe = (s) => String(s || '').replace(/[^\w\u3131-\uD79D一-龥]+/g, '_').slice(0, 40);
  pdf.save(`Quotation_${safe(p.quote_title || p.product_name || p.client_name) || 'document'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}