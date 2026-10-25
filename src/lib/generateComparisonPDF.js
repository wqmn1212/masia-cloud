import jsPDF from 'jspdf';
import { loadPdfFonts, imageToJpeg } from '@/lib/pdfFonts';
import { CURRENCY_SYMBOL, formatMoney } from '@/components/quotation/quoteCurrency';

// 견적 비교표 PDF (고객사 품의용, A4 가로). 공개 스냅샷만 쓰므로 공장명·원가·마진은 들어가지 않는다.
const PRIMARY = [0, 102, 255], INK = [23, 23, 25], MUTED = [110, 114, 124], LINE = [228, 228, 231], SOFT = [244, 244, 246];
const LOGO_URL = 'https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/b5bab8215_2x.png';
const W = 297, H = 210, M = 12, CW = W - M * 2, LABEL_W = 52;
const STATE_TEXT = { INCLUDED: '본체에 포함', NOT_INCLUDED: '포함 안 됨', UNKNOWN: '확인 중' };
const COND_LABEL = { warranty: '보증', power: '전원', packing: '포장', valid: '견적 유효기간', moq: 'MOQ' };
const money = (v, cur) => (v == null ? '-' : formatMoney(v, cur));
const unit = (v, cur) => (v == null ? '-' : cur === 'KRW' ? formatMoney(v, cur) : `${CURRENCY_SYMBOL[cur] || '$'}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: v < 10 ? 3 : 2 })}`);

export async function generateComparisonPDF(snapshot, { cardTitle = '', clientName = '', choice = null } = {}) {
  const s = snapshot;
  const cur = s.base_currency;
  const opts = s.options;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  await loadPdfFonts(pdf);
  const color = (c) => pdf.setTextColor(...c);
  const font = (size, bold) => { pdf.setFont('Nanum', bold ? 'bold' : 'normal'); pdf.setFontSize(size); };
  let y = M;
  const colW = (CW - LABEL_W) / Math.max(1, opts.length);

  const header = async () => {
    const logo = await imageToJpeg(LOGO_URL, 700, { x: 0.29, y: 0.3, w: 0.42, h: 0.4 }).catch(() => null);
    if (logo) { const lh = 10; pdf.addImage(logo.data, 'JPEG', M, y - 1, lh * (logo.w / logo.h), lh); }
    font(17, true); color(PRIMARY); pdf.text('QUOTE COMPARISON', W - M, y + 5, { align: 'right' });
    font(8); color(MUTED); pdf.text('견적 비교표', W - M, y + 9.5, { align: 'right' });
    y += 13; pdf.setDrawColor(...PRIMARY); pdf.setLineWidth(0.6); pdf.line(M, y, W - M, y); y += 6;
  };
  await header();

  font(12, true); color(INK); pdf.text(s.title || cardTitle || '견적 비교', M, y);
  font(8); color(MUTED);
  const meta = [clientName && `고객사 ${clientName}`, `작성일 ${new Date().toLocaleDateString('ko-KR')}`, `비교표 v${s.version}`, `기준 통화 ${cur}`,
    s.fx?.usd_krw ? `환율 1 USD = ${Number(s.fx.usd_krw).toLocaleString('ko-KR')}원${s.fx.usd_cny ? ` / ${s.fx.usd_cny}위안` : ''}${s.fx.date ? ` (${s.fx.date})` : ''}` : ''].filter(Boolean).join('   ·   ');
  pdf.text(meta, W - M, y, { align: 'right' });
  y += 6;
  if (s.recommendation) {
    const lines = pdf.splitTextToSize(`담당자 의견: ${s.recommendation}`, CW - 8);
    const h = lines.length * 4.2 + 4;
    pdf.setFillColor(...SOFT); pdf.rect(M, y, CW, h, 'F'); pdf.setFillColor(...PRIMARY); pdf.rect(M, y, 1.2, h, 'F');
    font(8.5); color(INK); pdf.text(lines, M + 4, y + 5);
    y += h + 3;
  }

  const anyLanded = opts.some((o) => o.landed_total != null);
  const allSingle = opts.every((o) => Number(o.units) === 1);
  const rows = [
    { label: '', head: true, cells: opts.map((o) => `${o.label}${choice?.option_key === o.key ? '  (선택)' : ''}${o.factory_name ? `\n${o.factory_name}` : ''}${o.scope_diff ? '\n일부 품목이 빠져 단순 비교 어려움' : ''}`) },
    anyLanded && { label: '한국 도착 원가 (부가세 제외)', strong: true, cells: opts.map((o) => (o.landed_total != null ? money(o.landed_total, cur) + (s.best?.landed_per_unit === o.key ? '  · 가장 낮음' : '') : '물류비 확인 중')) },
    anyLanded && !allSingle && { label: '도착 원가 · 개당', cells: opts.map((o) => unit(o.landed_per_unit, cur)) },
    { label: '견적 금액 (견적서 기준)', strong: !anyLanded, cells: opts.map((o) => money(o.quote_total, o.quote_currency)) },
    allSingle
      ? { label: `견적 금액 (${cur} 환산)`, cells: opts.map((o) => money(o.total, cur)) }
      : { label: `견적 · 개당${s.qty_diff ? ' (수량 다름)' : ''}`, cells: opts.map((o) => `${unit(o.per_unit, cur)} × ${Number(o.units).toLocaleString()}`) },
    { label: '납기 (발주 후 출하)', cells: opts.map((o) => `${o.lead || '확인 중'}${s.best?.lead === o.key ? '  · 가장 빠름' : ''}`) },
    { label: '결제 (선금 / 잔금 %)', cells: opts.map((o) => o.payment || '-') },
    { label: '발주할 때 필요한 금액', cells: opts.map((o) => money(o.deposit, cur)) },
    { label: '거래 조건', cells: opts.map((o) => o.incoterms || '-') },
    { section: '품목' },
    ...s.rows.map((r) => ({
      label: `${r.label}${r.kind === 'OPTIONAL' ? ' (선택)' : r.kind === 'ONE_TIME' ? ' (일회성)' : ''}${r.spec_diff ? ' · 사양 다름' : ''}`,
      cells: opts.map((o) => {
        const c = r.cells[o.key];
        if (!c) return '-';
        if (c.alternatives) return c.alternatives.map((a) => `${a.name}: ${money(a.amount, cur)}`).join('\n');
        if (c.state !== 'PRICED') return STATE_TEXT[c.state] || '-';
        return `${money(c.amount, cur)}${c.spec ? `\n${c.spec}` : ''}`;
      }),
    })),
    { section: '조건' },
    ...Object.keys(COND_LABEL).filter((k) => opts.some((o) => o.conditions?.[k])).map((k) => ({ label: COND_LABEL[k], cells: opts.map((o) => `${o.conditions?.[k] || '-'}${k === 'power' && o.power_warn ? ' (한국 60Hz 확인 필요)' : ''}`) })),
    ...(s.extra_conditions || []).map((c) => ({ label: c.label, cells: opts.map((o) => o.extra?.[c.key] || '-') })),
  ].filter(Boolean);

  pdf.setLineWidth(0.2); pdf.setDrawColor(...LINE);
  for (const r of rows) {
    if (r.section) {
      if (y + 7 > H - M - 10) { pdf.addPage(); y = M; }
      pdf.setFillColor(...SOFT); pdf.rect(M, y, CW, 5.5, 'F'); font(7.5, true); color(MUTED); pdf.text(r.section, M + 2, y + 3.8); y += 5.5;
      continue;
    }
    font(r.head ? 9 : 8, r.head || r.strong);
    const cellLines = r.cells.map((t) => pdf.splitTextToSize(String(t ?? '-'), colW - 4).slice(0, 6));
    const labelLines = pdf.splitTextToSize(r.label, LABEL_W - 4);
    const h = Math.max(labelLines.length, ...cellLines.map((l) => l.length)) * 3.9 + 3;
    if (y + h > H - M - 10) { pdf.addPage(); y = M; }
    if (r.head) { pdf.setFillColor(...SOFT); pdf.rect(M, y, CW, h, 'F'); }
    font(7.5); color(MUTED); pdf.text(labelLines, M + 2, y + 4);
    cellLines.forEach((lines, i) => {
      const x = M + LABEL_W + colW * i;
      if (choice?.option_key === opts[i].key) { pdf.setFillColor(235, 243, 255); pdf.rect(x, y, colW, h, 'F'); }
      font(r.head ? 9 : 8, r.head || r.strong); color(INK);
      pdf.text(lines[0] || '', x + 2, y + 4);
      if (lines.length > 1) { font(7, false); color(r.head ? MUTED : INK); pdf.text(lines.slice(1), x + 2, y + 7.9); }
    });
    pdf.line(M, y + h, W - M, y + h);
    y += h;
  }

  y += 5;
  if (y > H - M - 10) { pdf.addPage(); y = M; }
  font(7); color(MUTED);
  pdf.text(pdf.splitTextToSize('· 도착 원가는 견적 금액에 한국 도착까지 구매자가 따로 내는 물류비·통관비·관세를 더한 예상 금액이며, 부가세는 제외했습니다(사업자 매입세액 공제). 실제 금액은 실측 부피·도착일 환율·세관 검사에 따라 달라질 수 있습니다.\n· 기준 통화 환산 금액은 참고용이며, 계약 금액은 각 견적서의 통화 기준입니다.\n· AEGIS Trade 견적 비교표', CW), M, y);
  pdf.save(`견적비교표_${(s.title || cardTitle || 'comparison').replace(/[\\/:*?"<>|]/g, '')}_v${s.version}.pdf`);
}
