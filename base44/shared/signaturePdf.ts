// 완료본 PDF: 원본 PDF 뒤에 '전자서명 확인서'와 '감사 추적' 페이지를 붙인다. 원본 쪽은 한 바이트도 바꾸지 않고 복사만 한다.
// pdf-lib·fontkit 은 인자로 받는다 (서버 함수는 npm: 으로, 검산 스크립트는 로컬 설치본으로 넘긴다).
import { EVENT_LABEL, maskIp } from './signature.ts';

const W = 595.28, H = 841.89, M = 48;
// pdf-lib 글꼴 서브셋은 한글 글리프를 빠뜨리는 경우가 있어 글꼴을 통째로 넣는다 (보통체 하나 ≈ 2MB).
const SUBSET = false;
const BLUE = [0, 0.4, 1], INK = [0.09, 0.09, 0.1], MUTED = [0.43, 0.45, 0.49], LINE = [0.89, 0.89, 0.91], SOFT = [0.96, 0.96, 0.97];
const METHOD = { DRAW: '직접 그린 서명', TYPE: '이름 입력', SEAL: '회사 직인 이미지' };

export const kst = (iso: string) => {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 9 * 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} KST`;
};

export function eventSummary(ev: any) {
  const d = ev.data || {};
  switch (ev.type) {
    case 'SENT': return `버전 ${d.version || 1} · 서명자 ${d.signer_email || ''} · 기한 ${d.due_at ? kst(d.due_at).slice(0, 10) : ''}`;
    case 'OTP_SENT': return `${d.email || ''}로 발송`;
    case 'OTP_FAILED': return `${d.reason === 'LOCKED_NOW' ? '5회 실패로 30분 잠금' : `남은 횟수 ${d.left ?? ''}`}`;
    case 'SIGNED': return `${d.name || ''}${d.title ? ` (${d.title})` : ''} · ${METHOD[d.method as keyof typeof METHOD] || d.method || ''} · 원본 지문값 ${d.hash_check === 'MATCH' ? '일치' : '불일치'}`;
    case 'DECLINED': return String(d.reason || '').slice(0, 60);
    case 'EXTENDED': return `기한 ${d.due_at ? kst(d.due_at).slice(0, 10) : ''}`;
    default: return '';
  }
}

// 글자 폭 기준 줄바꿈 (한글은 글자 단위, 영문·숫자는 단어 단위)
export function wrap(text: string, font: any, size: number, width: number) {
  const out: string[] = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    const tokens = para.match(/[A-Za-z0-9@._\-:/]+|\s+|./gu) || [''];
    for (const tk of tokens) {
      const next = line + tk;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line.trim()) out.push(line.trimEnd());
      line = tk.trimStart();
      // 한 토큰이 줄보다 길면 (지문값 등) 글자 단위로 자른다
      while (font.widthOfTextAtSize(line, size) > width) {
        let i = line.length;
        while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > width) i--;
        out.push(line.slice(0, i));
        line = line.slice(i);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

export async function buildCompletedPdf({ lib, fontkit, originalBytes, fonts, request, events, images = {} }: any) {
  const { PDFDocument, rgb } = lib;
  const color = (c: number[]) => rgb(c[0], c[1], c[2]);
  const src = await PDFDocument.load(originalBytes);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const copied = await doc.copyPages(src, src.getPageIndices());
  copied.forEach((p: any) => doc.addPage(p));
  const R = await doc.embedFont(fonts.regular, { subset: SUBSET });
  const Bd = fonts.bold ? await doc.embedFont(fonts.bold, { subset: SUBSET }) : R; // 굵은체가 없으면 보통체
  const embed = async (img: any) => {
    if (!img?.bytes) return null;
    try { return img.type === 'jpg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes); } catch (_e) { return null; }
  };
  const clientSig = await embed(images.client);
  const seal = await embed(images.seal);
  const signer = (request.signers || []).find((s: any) => s.status === 'SIGNED') || (request.signers || [])[0] || {};
  const aegis = request.aegis_signer || {};
  doc.setTitle(`${request.document_title || '계약서'} (체결본)`);
  doc.setSubject(`${request.document_no} · 원본 SHA-256 ${request.original_sha256}`);
  doc.setProducer('AEGIS Cloud e-Signature');
  doc.setCreationDate(new Date(request.completed_at || Date.now()));
  doc.setModificationDate(new Date(request.completed_at || Date.now()));

  let page: any, y = 0, pageNo = 0;
  const newPage = (title: string) => {
    page = doc.addPage([W, H]);
    pageNo += 1;
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: color(BLUE) });
    page.drawText('AEGIS Cloud', { x: M, y: H - 40, size: 10, font: Bd, color: color(BLUE) });
    page.drawText(title, { x: M, y: H - 66, size: 17, font: Bd, color: color(INK) });
    page.drawText(`${request.document_no} · ${request.document_title || ''}`.slice(0, 80), { x: M, y: H - 84, size: 8.5, font: R, color: color(MUTED) });
    page.drawLine({ start: { x: M, y: H - 94 }, end: { x: W - M, y: H - 94 }, thickness: 0.8, color: color(LINE) });
    page.drawText(`전자서명 확인서 ${pageNo}`, { x: W - M - R.widthOfTextAtSize(`전자서명 확인서 ${pageNo}`, 8), y: 28, size: 8, font: R, color: color(MUTED) });
    y = H - 118;
  };
  const text = (s: string, { x = M, size = 9.5, bold = false, c = INK, width = W - M * 2, gap = 4 }: any = {}) => {
    const f = bold ? Bd : R;
    for (const ln of wrap(s, f, size, width)) {
      page.drawText(ln, { x, y, size, font: f, color: color(c) });
      y -= size + gap;
    }
  };
  const kv = (k: string, v: string, w = W - M * 2) => {
    page.drawText(k, { x: M, y, size: 8.5, font: R, color: color(MUTED) });
    const lines = wrap(v, R, 9, w - 110);
    lines.forEach((ln, i) => page.drawText(ln, { x: M + 110, y: y - i * 13, size: 9, font: R, color: color(INK) }));
    y -= Math.max(1, lines.length) * 13 + 3;
  };

  // ── 1) 전자서명 확인서 ──
  newPage('전자서명 확인서');
  kv('문서 번호', request.document_no || '');
  kv('계약서', request.document_title || '');
  kv('원본 쪽수', `${request.page_count || src.getPageCount()}쪽 (이 확인서 앞)`);
  kv('원본 지문값', `SHA-256 ${request.original_sha256}`);
  kv('체결 시각', kst(request.completed_at));
  y -= 10;

  const boxW = (W - M * 2 - 16) / 2, boxH = 210, top = y;
  const box = (x: number, heading: string, rows: [string, string][], img: any, imgLabel: string) => {
    page.drawRectangle({ x, y: top - boxH, width: boxW, height: boxH, borderColor: color(LINE), borderWidth: 0.8, color: rgb(1, 1, 1) });
    page.drawRectangle({ x, y: top - 24, width: boxW, height: 24, color: color(SOFT) });
    page.drawText(heading, { x: x + 10, y: top - 16, size: 9.5, font: Bd, color: color(INK) });
    let yy = top - 42;
    for (const [k, v] of rows) {
      page.drawText(k, { x: x + 10, y: yy, size: 8, font: R, color: color(MUTED) });
      const ln = wrap(v || '-', R, 9, boxW - 80);
      ln.slice(0, 2).forEach((l, i) => page.drawText(l, { x: x + 70, y: yy - i * 12, size: 9, font: R, color: color(INK) }));
      yy -= Math.min(2, ln.length) * 12 + 4;
    }
    const areaTop = top - 132, areaH = 84;
    page.drawText(imgLabel, { x: x + 10, y: areaTop + 4, size: 8, font: R, color: color(MUTED) });
    if (img) {
      const s = Math.min((boxW - 20) / img.width, (areaH - 10) / img.height, 1);
      page.drawImage(img, { x: x + 10, y: areaTop - img.height * s - 6, width: img.width * s, height: img.height * s });
    } else {
      page.drawText('(이미지 없음)', { x: x + 10, y: areaTop - 30, size: 9, font: R, color: color(MUTED) });
    }
  };
  box(M, '이지스 (공급자)', [['회사', aegis.company || 'DONGGUAN AEGIS TRADE CO., LTD'], ['서명자', `${aegis.name || ''}${aegis.title ? ` · ${aegis.title}` : ''}`], ['방식', '요청 발송 시 직인 날인']], seal, '직인');
  box(M + boxW + 16, '고객 (서명자)', [['회사', signer.signed_company || ''], ['서명자', `${signer.signed_name || ''}${signer.signed_title ? ` · ${signer.signed_title}` : ''}`], ['계정', signer.email || ''], ['서명 시각', kst(signer.signed_at)], ['방식', METHOD[signer.method as keyof typeof METHOD] || '']], clientSig, '서명');
  y = top - boxH - 22;

  text('서명자가 동의한 문구', { size: 8.5, c: MUTED, gap: 3 });
  page.drawRectangle({ x: M, y: y - 44, width: 2, height: 52, color: color(BLUE) });
  text(request.consent_text || '', { x: M + 10, size: 9, width: W - M * 2 - 10, gap: 4 });
  y -= 14;
  text('이 확인서는 이지스 클라우드가 서명 과정에서 서버에 기록한 내용으로 만들었습니다. 서명자는 고객사 계정으로 로그인하고, 계정 이메일로 받은 인증번호로 본인 확인을 한 뒤 서명했습니다. 이 파일이 이지스가 발급한 완료본과 같은지는 이지스 클라우드의 \'문서 확인\'에서 파일을 올려 확인할 수 있습니다.', { size: 8.5, c: MUTED, gap: 3.5 });

  // ── 2) 감사 추적 ──
  newPage('감사 추적');
  text('서명 요청부터 서명까지 서버가 기록한 순서입니다. 시각은 모두 서버 시각이며, 각 기록은 앞 기록의 지문값을 포함해 하나라도 빠지거나 바뀌면 드러납니다. IP 는 일부를 가렸습니다.', { size: 8.5, c: MUTED, gap: 3.5 });
  y -= 6;
  const cols = [M, M + 118, M + 200, M + 300, M + 372];
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - M * 2, height: 20, color: color(SOFT) });
    ['시각', '기록', '행위자', 'IP', '내용'].forEach((h, i) => page.drawText(h, { x: cols[i] + 4, y: y, size: 8, font: Bd, color: color(MUTED) }));
    y -= 22;
  };
  header();
  const sorted = [...events].sort((a, b) => Number(a.seq) - Number(b.seq));
  for (const ev of sorted) {
    const summary = wrap(eventSummary(ev), R, 7.5, W - M - cols[4] - 6);
    const actor = wrap(ev.actor_label || (ev.actor_type === 'SYSTEM' ? '시스템' : ''), R, 7.5, cols[3] - cols[2] - 8);
    const rowH = Math.max(summary.length, actor.length, 1) * 10 + 8;
    if (y - rowH < 70) { newPage('감사 추적 (계속)'); header(); }
    page.drawText(kst(ev.at).replace(' KST', ''), { x: cols[0] + 4, y, size: 7.5, font: R, color: color(INK) });
    page.drawText(EVENT_LABEL[ev.type] || ev.type, { x: cols[1] + 4, y, size: 7.5, font: Bd, color: color(INK) });
    actor.forEach((l, i) => page.drawText(l, { x: cols[2] + 4, y: y - i * 10, size: 7.5, font: R, color: color(INK) }));
    page.drawText(maskIp(ev.ip || '') || '-', { x: cols[3] + 4, y, size: 7.5, font: R, color: color(MUTED) });
    summary.forEach((l, i) => page.drawText(l, { x: cols[4] + 4, y: y - i * 10, size: 7.5, font: R, color: color(INK) }));
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.4, color: color(LINE) });
  }
  page.drawText(kst(request.completed_at).replace(' KST', ''), { x: cols[0] + 4, y, size: 7.5, font: R, color: color(INK) });
  page.drawText('체결 완료', { x: cols[1] + 4, y, size: 7.5, font: Bd, color: color(INK) });
  page.drawText('이 완료본 발급', { x: cols[4] + 4, y, size: 7.5, font: R, color: color(INK) });
  y -= 26;
  const head = sorted.length ? sorted[sorted.length - 1].hash : '';
  text(`기록 ${sorted.length}건 · 마지막 기록 지문값 ${head}`, { size: 7.5, c: MUTED, gap: 3 });
  text(`원본 지문값 SHA-256 ${request.original_sha256}`, { size: 7.5, c: MUTED, gap: 3 });
  return await doc.save({ useObjectStreams: false });
}
