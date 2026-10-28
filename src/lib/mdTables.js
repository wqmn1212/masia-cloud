// 마크다운 표(| a | b |) 를 따로 떼어 낸다. AI 비서 답변의 미리보기 표를 패키지(remark-gfm) 없이 그리기 위해 쓴다.
// 결과: [{ type: 'md', text }, { type: 'table', header: [...], align: [...], rows: [[...]] }, ...]
const SEP = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const isRow = (line) => line.trim().startsWith('|');

export function splitCells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const alignOf = (cell) => {
  const c = cell.trim();
  if (c.startsWith(':') && c.endsWith(':')) return 'center';
  if (c.endsWith(':')) return 'right';
  return 'left';
};

export function splitMarkdownTables(text = '') {
  const lines = String(text).split('\n');
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) { out.push({ type: 'md', text: buf.join('\n') }); buf = []; } };
  for (let i = 0; i < lines.length; i++) {
    if (isRow(lines[i]) && i + 1 < lines.length && SEP.test(lines[i + 1].trim())) {
      const header = splitCells(lines[i]);
      const align = splitCells(lines[i + 1]).map(alignOf);
      const rows = [];
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) {
        const cells = splitCells(lines[j]);
        rows.push(header.map((_, k) => cells[k] ?? ''));
        j++;
      }
      flush();
      out.push({ type: 'table', header, align: header.map((_, k) => align[k] || 'left'), rows });
      i = j - 1;
    } else {
      buf.push(lines[i]);
    }
  }
  flush();
  return out.filter((seg) => seg.type === 'table' || seg.text.trim());
}
