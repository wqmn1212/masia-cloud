// PADS ASCII(확장자 .asc, 또는 !PADS- 로 시작하는 텍스트) 구조 읽기.
// PADS Layout 의 .pcb 는 바이너리라 열 수 없다. 좌표 필드의 의미는 버전마다 달라
// 회로를 추측해 그리지 않고, 구역·기록·필드를 그대로 보여 주고 값만 고친다.
const SECTION = /^\*([A-Z0-9_-]+)\*/i;

export function isPadsText(text) {
  const head = (text || '').replace(/^\uFEFF/, '').trimStart().slice(0, 80);
  return /^!PADS-[A-Z0-9.\-]*!/i.test(head) || /^\*PADS-(LOGIC|POWERLOGIC|LIBRARY)/i.test(head);
}

export function padsHeader(text) {
  const raw = (text || '').replace(/^\uFEFF/, '').split(/\r?\n/)[0]?.trim() || '';
  const m = /^!PADS-([A-Z0-9.\-]+)!/i.exec(raw);
  if (!m) return { raw, product: '', version: '', units: '' };
  const parts = m[1].split('-');
  const units = parts.find(p => /^(MILS|MM|INCH|BASIC)$/i.test(p)) || '';
  const version = parts.find(p => /^V?\d/i.test(p)) || '';
  const product = parts.filter(p => p !== units && p !== version).join(' ') || 'PADS';
  return { raw, product, version, units };
}

function tokenize(line, base) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    if (/\s/.test(line[i])) { i++; continue; }
    const start = i;
    let quoted = false, value = '';
    if (line[i] === '"') {
      quoted = true; i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && line[i + 1] === '"') { value += '"'; i += 2; }
        else value += line[i++];
      }
      i++;
    } else while (i < line.length && !/\s/.test(line[i])) value += line[i++];
    tokens.push({ value, quoted, start: base + start, end: base + i });
  }
  return tokens;
}

export function parsePads(text) {
  const sections = [];
  let current = null, offset = 0, lineNo = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const start = offset;
    offset += rawLine.length + 1;
    lineNo += 1;
    const trimmed = line.trim();
    const marked = SECTION.exec(trimmed);
    if (marked) {
      const detail = trimmed.slice(marked[0].length).trim();
      current = { name: marked[1].toUpperCase(), detail, label: detail ? `${marked[1].toUpperCase()} ${detail}` : marked[1].toUpperCase(), header: trimmed, lineNo, records: [] };
      sections.push(current);
      continue;
    }
    if (!current || !trimmed || /^REMARK\b/i.test(trimmed)) continue;
    current.records.push({ lineNo, start, end: start + line.length, tokens: tokenize(line, start) });
  }
  return { sections, records: sections.reduce((n, s) => n + s.records.length, 0) };
}

export function patchPadsToken(text, token, value) {
  if (/[\r\n\0]/.test(value)) throw new Error('값에 줄바꿈을 넣을 수 없습니다.');
  if (!token.quoted && /\s/.test(value)) throw new Error('공백이 있는 값은 원래 따옴표로 묶인 필드에만 넣을 수 있습니다.');
  const replacement = token.quoted ? `"${value.replace(/"/g, '')}"` : value;
  const next = text.slice(0, token.start) + replacement + text.slice(token.end);
  if (parsePads(next).records !== parsePads(text).records) throw new Error('이 값은 기록 줄을 망가뜨립니다.');
  return next;
}