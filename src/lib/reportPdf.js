import jsPDF from 'jspdf';
import { loadPdfFonts } from '@/lib/pdfFonts';
import { REPORT_METRICS, monthLabel } from '@/lib/agreements';
import { SEVERITY, SPEC_DECISION } from '@/lib/qualitySpec';
import { MODES, SHIPMENT_STATUS } from '@/lib/shipments';
import { fileDate, safeName } from '@/lib/csv';

// 고객 사내 보고용 PDF (텍스트 기반, 한글 폰트 포함). 고객에게 보이는 데이터만 받아서 그린다.
const BLUE = [37, 99, 235], INK = [15, 23, 42], MUTED = [100, 116, 139], LINE = [229, 231, 235], SOFT = [241, 245, 249];
const W = 210, H = 297, M = 15, CW = W - M * 2;
const QC_RESULT = { PASS: '합격', CONDITIONAL_PASS: '조건부 합격', FAIL: '불합격' };
const QC_DECISION = { PENDING: '고객 확인 대기', APPROVED: '승인', ON_HOLD: '보류 요청' };
const STEP_STATUS = { done: '완료', pending: '예정', in_progress: '진행 중', skipped: '건너뜀' };
const CARD_STATUS = { TODO: '대기 중', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주 · 제작', DONE: '완료', CANCELLED: '취소' };

async function createDoc(title, subtitle) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await loadPdfFonts(pdf);
  const d = { pdf, y: M };
  d.color = (c) => pdf.setTextColor(...c);
  d.font = (size, bold) => { pdf.setFont('Nanum', bold ? 'bold' : 'normal'); pdf.setFontSize(size); };
  d.ensure = (h) => { if (d.y + h > H - M - 8) { pdf.addPage(); d.y = M; } };
  d.font(16, true); d.color(BLUE); pdf.text('AEGIS', M, d.y + 6);
  d.font(8); d.color(MUTED); pdf.text('중국 광둥성 현지 제조 관리', M + 22, d.y + 6);
  pdf.text(`작성일 ${fileDate()}`, W - M, d.y + 6, { align: 'right' });
  d.y += 10; pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.7); pdf.line(M, d.y, W - M, d.y); d.y += 8;
  d.font(15, true); d.color(INK); pdf.text(pdf.splitTextToSize(title, CW), M, d.y); d.y += 7;
  if (subtitle) { d.font(9); d.color(MUTED); pdf.text(subtitle, M, d.y); d.y += 6; }
  d.y += 2;
  return d;
}

function heading(d, text) {
  d.y += 3;
  d.ensure(14);
  d.font(11, true); d.color(INK); d.pdf.text(text, M, d.y + 4); d.y += 8;
}

function paragraph(d, text, size = 9.5) {
  if (!text) return;
  d.font(size); d.color(INK);
  for (const line of d.pdf.splitTextToSize(text, CW)) { d.ensure(5.5); d.pdf.text(line, M, d.y + 4); d.y += 5; }
  d.y += 2;
}

// columns: [{ label, width(mm), align }], rows: string[][]
function table(d, columns, rows) {
  const { pdf } = d;
  const pad = 1.8, lh = 4.4;
  const header = () => {
    d.ensure(9);
    pdf.setFillColor(...SOFT); pdf.rect(M, d.y, CW, 7, 'F');
    d.font(8, true); d.color(MUTED);
    let x = M;
    for (const c of columns) { pdf.text(c.label, c.align === 'right' ? x + c.width - pad : x + pad, d.y + 4.7, { align: c.align === 'right' ? 'right' : 'left' }); x += c.width; }
    d.y += 7;
  };
  header();
  d.font(8.5);
  for (const row of rows) {
    const cells = row.map((v, i) => pdf.splitTextToSize(String(v ?? ''), columns[i].width - pad * 2));
    const h = Math.max(...cells.map((c) => c.length)) * lh + pad * 2;
    if (d.y + h > H - M - 8) { pdf.addPage(); d.y = M; header(); d.font(8.5); }
    let x = M;
    d.color(INK);
    cells.forEach((lines, i) => {
      const c = columns[i];
      lines.forEach((line, k) => pdf.text(line, c.align === 'right' ? x + c.width - pad : x + pad, d.y + pad + 3.2 + k * lh, { align: c.align === 'right' ? 'right' : 'left' }));
      x += c.width;
    });
    d.y += h;
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.2); pdf.line(M, d.y, W - M, d.y);
  }
  d.y += 4;
}

function metricGrid(d, items) {
  const cols = 3, gap = 3, w = (CW - gap * (cols - 1)) / cols, h = 16;
  items.forEach((it, i) => {
    if (i % cols === 0) d.ensure(h + gap);
    const x = M + (i % cols) * (w + gap);
    d.pdf.setDrawColor(...LINE); d.pdf.setLineWidth(0.3); d.pdf.roundedRect(x, d.y, w, h, 1.5, 1.5, 'S');
    d.font(7.5); d.color(MUTED); d.pdf.text(it.label, x + 3, d.y + 5);
    d.font(13, true); d.color(INK); d.pdf.text(it.value, x + 3, d.y + 12);
    if (it.note) { d.font(7); d.color(MUTED); d.pdf.text(it.note, x + w - 3, d.y + 12, { align: 'right' }); }
    if (i % cols === cols - 1 || i === items.length - 1) d.y += h + gap;
  });
  d.y += 2;
}

function finish(d, filename) {
  const { pdf } = d;
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    d.font(7); d.color(MUTED);
    pdf.text('AEGIS Cloud에서 만든 보고용 자료입니다. 최신 내용은 고객 포털에서 확인해 주세요.', M, H - 8);
    pdf.text(`${i} / ${pages}`, W - M, H - 8, { align: 'right' });
  }
  pdf.save(filename);
}

export async function generateMonthlyReportPDF(report, companyName = '') {
  const d = await createDoc(`${monthLabel(report.month)} 업무 리포트`, [companyName, 'AEGIS 월간 업무 리포트'].filter(Boolean).join(' · '));
  const m = report.metrics || {};
  metricGrid(d, REPORT_METRICS.map(([key, label, unit]) => ({
    label, value: `${m[key] ?? 0}${unit}`,
    note: key === 'qc_reports' && m.qc_reports ? `합격 ${m.qc_pass || 0} · 조건부 ${m.qc_conditional || 0} · 불합격 ${m.qc_fail || 0}` : '',
  })));
  if (report.highlights) { heading(d, '이번 달 주요 내용'); paragraph(d, report.highlights); }
  if (report.cards?.length) {
    heading(d, '프로젝트별 진행');
    table(d, [{ label: '프로젝트', width: 52 }, { label: '단계', width: 24 }, { label: '이번 달 완료', width: 54 }, { label: '다음 일정', width: 50 }],
      report.cards.map((c) => [c.title, c.status, (c.done_steps || []).join(', ') || '-', c.next_step ? `${c.next_step}${c.next_date ? ` (${c.next_date})` : ''}` : '-']));
  }
  if (report.next_plan) { heading(d, '다음 달 계획'); paragraph(d, report.next_plan); }
  finish(d, `AEGIS_MonthlyReport_${companyName ? `${safeName(companyName)}_` : ''}${report.month}.pdf`);
}

// detail = getClientCardDetail 응답 (고객에게 공개된 데이터만 들어 있다)
export async function generateProjectSummaryPDF(detail) {
  const c = detail.card;
  const d = await createDoc(c.title, `프로젝트 진행 요약 · ${CARD_STATUS[c.status] || c.status}${c.delivery_date ? ` · 예정 납품일 ${c.delivery_date}` : ''}`);
  const steps = detail.milestones || [];
  if (steps.length) {
    heading(d, '진행 단계');
    table(d, [{ label: '단계', width: 62 }, { label: '예정일', width: 26 }, { label: '완료일', width: 26 }, { label: '상태', width: 20 }, { label: '비고', width: 46 }],
      steps.map((s) => [s.label, s.planned_date || '-', s.actual_date || '-', STEP_STATUS[s.status] || s.status, s.delay_reason || '']));
  }
  const spec = detail.quality_spec;
  if (spec) {
    heading(d, `품질 기준서 v${spec.version} · ${(SPEC_DECISION[spec.decision] || SPEC_DECISION.PENDING).label}`);
    paragraph(d, `${spec.aql_level || ''} · AQL 치명 ${spec.aql_critical ?? '-'} / 중결함 ${spec.aql_major ?? '-'} / 경결함 ${spec.aql_minor ?? '-'}${spec.sampling_note ? `\n${spec.sampling_note}` : ''}`, 8.5);
    table(d, [{ label: '등급', width: 20 }, { label: '항목', width: 45 }, { label: '합격 기준', width: 115 }],
      spec.items.map((i) => [SEVERITY[i.severity]?.label || '', i.label, i.standard]));
  }
  for (const r of (detail.qc_reports || []).slice(0, 3)) {
    heading(d, `${r.inspection_type === 'SAMPLE' ? '샘플 검수' : '출고 전 검수'} · ${QC_RESULT[r.qc_result] || r.qc_result} · ${(r.published_at || '').slice(0, 10)}`);
    if (r.checklist?.length) table(d, [{ label: '검수 항목', width: 70 }, { label: '결과', width: 22 }, { label: '메모', width: 88 }], r.checklist.map((i) => [i.label, QC_RESULT[i.status] || (i.status === 'PENDING' ? '확인 중' : i.status), i.note]));
    paragraph(d, [r.comments, `고객 판단: ${QC_DECISION[r.decision] || r.decision}${r.decision_note ? ` (${r.decision_note})` : ''}`].filter(Boolean).join('\n'), 8.5);
  }
  for (const s of detail.shipments || []) {
    heading(d, `${s.label || '선적'} · ${SHIPMENT_STATUS[s.status] || s.status}`);
    table(d, [{ label: '운송', width: 36 }, { label: '구간', width: 50 }, { label: '출항', width: 26 }, { label: '도착', width: 26 }, { label: 'B/L · 운송장', width: 42 }],
      [[[MODES[s.mode], s.carrier].filter(Boolean).join(' · ') || '-', [s.port_from, s.port_to].filter(Boolean).join(' → ') || '-', s.atd || s.etd || '-', s.ata || s.eta || '-', s.tracking_no || '-']]);
    paragraph(d, `서류: ${s.docs.map((x) => `${x.label} ${x.status === 'MISSING' ? '준비 중' : x.status === 'NA' ? '해당 없음' : '준비됨'}`).join(', ')}${s.client_note ? `\n${s.client_note}` : ''}`, 8.5);
  }
  finish(d, `AEGIS_ProjectSummary_${safeName(c.title)}_${fileDate()}.pdf`);
}
