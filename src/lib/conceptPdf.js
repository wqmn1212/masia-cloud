import { base44 } from '@/api/base44Client';
import { createDoc, heading, paragraph, table, metricGrid, finish, M, CW } from '@/lib/reportPdf';
import { imageToJpeg } from '@/lib/pdfFonts';
import { conceptSnapshot } from '@/lib/conceptSnapshot';
import { CONCEPT_LAYERS, CONCEPT_DISCLAIMER, MOLD_CATEGORIES } from '@/lib/concept';
import { REVIEW_VERDICT, SEVERITY } from '@/lib/prototype';
import { fileDate, safeName } from '@/lib/csv';

const LOGO_URL = 'https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/b5bab8215_2x.png';
const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** 이 시제품에 연결된 업무 카드의 고객사 이름 (없으면 빈 값) */
export async function conceptClientName(project) {
  if (!project?.card_id) return '';
  try { return (await base44.entities.TaskCard.get(project.card_id))?.client_name || ''; } catch { return ''; }
}
const sev = (s) => (SEVERITY[s] || SEVERITY.MEDIUM).label;
const bullets = (d, title, items) => { if (items?.length) { heading(d, title); paragraph(d, items.map((x) => `· ${x}`).join('\n'), 8.5); } };

// 이미지들을 한 줄에 나란히 (비율 유지)
function imageRow(d, images) {
  if (!images.length) return;
  const gap = 4, w = (CW - gap * (images.length - 1)) / images.length;
  const h = Math.min(100, ...images.map((im) => w * im.h / im.w));
  d.ensure(h + 8);
  images.forEach((im, i) => {
    const iw = Math.min(w, h * im.w / im.h);
    d.pdf.addImage(im.data, 'JPEG', M + i * (w + gap) + (w - iw) / 2, d.y, iw, iw * im.h / im.w);
  });
  d.y += h + 3;
  d.font(7.5); d.color([100, 116, 139]);
  images.forEach((im, i) => d.pdf.text(im.caption, M + i * (w + gap) + w / 2, d.y + 2, { align: 'center' }));
  d.y += 7;
}

/** 컨셉 스튜디오 결과를 고객 미팅용 PDF 로 저장한다 (프리뷰 + 실행한 회로·사출 검토) */
export async function generateConceptPDF(concept, project, clientName = '') {
  const p = concept.preview;
  const size = p.overall_mm;
  const logo = await imageToJpeg(LOGO_URL, 700, { x: 0.29, y: 0.3, w: 0.42, h: 0.4 }).catch(() => null);
  const d = await createDoc(concept.title || project.title,
    [clientName && `고객사 ${clientName}`, `제품 컨셉 제안 · v${concept.version_no}`, size && `약 ${size.x} × ${size.z} × ${size.y} mm`].filter(Boolean).join(' · '),
    logo);

  const images = [{ ...conceptSnapshot(p.parts), caption: '3D 컨셉 형상' }];
  if (p.render_url) {
    const render = await imageToJpeg(p.render_url, 1200).catch(() => null);
    const rv = p.render_version ?? concept.version_no;
    if (render) images.push({ ...render, caption: rv !== concept.version_no ? `AI 렌더 이미지 (v${rv} 형상 기준, 분위기 참고용)` : 'AI 렌더 이미지 (분위기 참고용)' });
  }
  imageRow(d, images);
  paragraph(d, p.summary);
  paragraph(d, `※ ${CONCEPT_DISCLAIMER.preview}`, 8);

  heading(d, `구성 부품 ${p.parts.length}`);
  table(d, [{ label: '부품', width: 44 }, { label: '구분', width: 22 }, { label: '역할', width: 80 }, { label: '예상 재질', width: 34 }],
    p.parts.map((x) => [x.name, CONCEPT_LAYERS[x.layer] || '기타', x.role, x.material]));
  bullets(d, '디자인 메모', p.design_notes);
  bullets(d, '형상에 둔 가정', p.assumptions);
  bullets(d, '실제 설계에서 확인할 것', p.unverified);

  const c = concept.circuit;
  if (c) {
    const calc = c.calc || {};
    d.ensure(40);
    heading(d, `회로 검토${c.stale ? ' (이전 버전 형상 기준)' : ''}`);
    paragraph(d, c.summary);
    metricGrid(d, [
      { label: '공급 전압', value: `${calc.supply_voltage_v ?? c.inputs?.supply_voltage_v ?? '-'} V` },
      { label: '최대 전류 (계산)', value: `${calc.peak_current_a ?? '-'} A` }, { label: '평균 전류 (계산)', value: `${calc.avg_current_a ?? '-'} A` },
      { label: '최대 전력 (계산)', value: `${calc.peak_power_w ?? '-'} W` }, { label: '소비 에너지 (계산)', value: `${calc.energy_wh ?? '-'} Wh` },
      { label: '한 주기 시간', value: `${calc.duration_s ?? '-'} s` },
    ]);
    if (calc.steps?.length) {
      table(d, [{ label: '단계', width: 50 }, { label: '시간', width: 24 }, { label: '동작 부하', width: 66 }, { label: '전류', width: 20, align: 'right' }, { label: '전력', width: 20, align: 'right' }],
        calc.steps.map((s, i) => [`${i + 1}. ${s.name}`, `${s.t_start}~${s.t_end}s`, s.active?.join(', ') || '-', `${s.current_a} A`, `${s.power_w} W`]));
    }
    if (c.components?.length) {
      table(d, [{ label: '주요 부품', width: 50 }, { label: '기능', width: 70 }, { label: '전압 · 전류', width: 34 }, { label: '상태', width: 26 }],
        c.components.map((x) => [[x.ref, x.name].filter(Boolean).join(' · '), x.function, [x.voltage, x.current].filter(Boolean).join(' / '), x.verify_status === 'ASSUMED' ? '가정' : '검증 필요']));
    }
    const risks = [...(calc.checks || []), ...(c.risks || [])].sort((a, b) => (ORDER[a.severity] ?? 1) - (ORDER[b.severity] ?? 1));
    if (risks.length) table(d, [{ label: '위험도', width: 18 }, { label: '위험', width: 76 }, { label: '개선 제안', width: 86 }], risks.map((r) => [sev(r.severity), [r.title, r.detail].filter(Boolean).join(' — '), r.mitigation || '-']));
    bullets(d, '회로 검토의 가정 · 미확인', [...(c.assumptions || []), ...(calc.unknowns || []), ...(c.unverified || [])]);
    paragraph(d, `※ ${CONCEPT_DISCLAIMER.circuit}`, 8);
  }

  const m = concept.mold;
  if (m) {
    const mt = m.rules?.metrics || {};
    const range = (v, u) => (v ? `${v[0]}~${v[1]}${u}` : '-');
    d.ensure(40);
    heading(d, `사출 · 금형 검토 — ${(REVIEW_VERDICT[m.verdict] || REVIEW_VERDICT.CONDITIONAL).label}${m.stale ? ' (이전 버전 형상 기준)' : ''}`);
    paragraph(d, m.summary);
    metricGrid(d, [
      { label: `수축률 (${mt.material_name || '-'})`, value: range(mt.shrink_pct, '%') }, { label: '길이 방향 예상 수축', value: range(mt.shrink_mm, 'mm') },
      { label: '권장 최소 살', value: mt.min_wall_mm != null ? `${mt.min_wall_mm} mm` : '-' }, { label: '리브 두께 상한', value: mt.rib_max_mm != null ? `${mt.rib_max_mm} mm` : '-' },
      { label: '필요 구배', value: mt.draft_required_deg != null ? `${mt.draft_required_deg}°` : '-' }, { label: '유동 길이비 / 한계', value: mt.flow_ratio != null ? `${mt.flow_ratio} / ${mt.flow_limit}` : '-' },
    ]);
    const partName = (id) => p.parts.find((x) => x.id === id)?.name;
    const issues = [...(m.rules?.checks || []).map((x) => ({ ...x, basis: x.detail })), ...(m.findings || [])].sort((a, b) => (ORDER[a.severity] ?? 1) - (ORDER[b.severity] ?? 1));
    if (issues.length) {
      table(d, [{ label: '위험도', width: 16 }, { label: '구분', width: 20 }, { label: '걸리는 부분', width: 46 }, { label: '근거', width: 50 }, { label: '개선 제안', width: 48 }],
        issues.map((f) => [sev(f.severity), MOLD_CATEGORIES[f.category] || '기타', [f.title, [partName(f.part_id), f.location].filter(Boolean).join(' · ')].filter(Boolean).join('\n'), f.basis, f.recommendation || '-']));
    }
    if (m.gate_candidates?.length) {
      table(d, [{ label: '게이트 후보', width: 50 }, { label: '방식', width: 28 }, { label: '이유', width: 54 }, { label: '위치 제약', width: 48 }],
        m.gate_candidates.map((g) => [[partName(g.part_id), g.location].filter(Boolean).join(' · '), g.type, g.reason, g.constraint]));
    }
    if (m.parting_line) paragraph(d, `파팅라인: ${m.parting_line}`, 8.5);
    bullets(d, '금형 업체 확인이 필요한 항목', m.vendor_checks);
    bullets(d, '사출 검토의 가정 · 미확인', [...(m.assumptions || []), ...(m.rules?.unknowns || []), ...(m.unverified || [])]);
    paragraph(d, `※ ${CONCEPT_DISCLAIMER.mold}`, 8);
  }

  finish(d, `AEGIS_Concept_${safeName(concept.title || project.title)}_v${concept.version_no}_${fileDate()}.pdf`, '컨셉 단계 검토 자료입니다. 확정 설계가 아니며 수치는 참고값입니다.');
}