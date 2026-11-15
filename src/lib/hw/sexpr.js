// KiCad 파일(S-식) 읽기·쓰기. 목록은 배열, 기호는 문자열, 따옴표 문자열은 { s } 로 구분한다.
// 읽기는 라이브러리 추출 스크립트와 검산에서, 쓰기는 회로도·PCB 내보내기에서 쓴다.

export const q = (s) => ({ s: String(s) });
export const isStr = (x) => x && typeof x === 'object' && !Array.isArray(x) && 's' in x;

export function parse(text) {
  let i = 0;
  const n = text.length;
  const stack = [[]];
  while (i < n) {
    const c = text[i];
    if (c === '(') { stack.push([]); i++; continue; }
    if (c === ')') { const done = stack.pop(); stack[stack.length - 1].push(done); i++; continue; }
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') { i++; continue; }
    if (c === '"') {
      let s = '';
      i++;
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) { const e = text[i + 1]; s += e === 'n' ? '\n' : e; i += 2; continue; }
        s += text[i++];
      }
      i++;
      stack[stack.length - 1].push(q(s));
      continue;
    }
    let j = i;
    while (j < n && !' \n\r\t()"'.includes(text[j])) j++;
    stack[stack.length - 1].push(text.slice(i, j));
    i = j;
  }
  return stack[0];
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const num = (v) => {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1e4) / 1e4;
  return Object.is(r, -0) ? '0' : String(r);
};

/** 값 → 글자. 짧은 목록은 한 줄, 긴 목록은 들여 쓴다 */
export function print(x, indent = 0) {
  if (Array.isArray(x)) {
    const parts = x.map((y) => print(y, indent + 1));
    const flat = `(${parts.join(' ')})`;
    if (flat.length < 100 && !flat.includes('\n')) return flat;
    const pad = '  '.repeat(indent + 1);
    const head = [];
    let k = 0;
    while (k < parts.length && !Array.isArray(x[k])) head.push(parts[k++]);
    return `(${head.join(' ')}${parts.slice(k).map((p) => `\n${pad}${p}`).join('')}\n${'  '.repeat(indent)})`;
  }
  if (isStr(x)) return `"${esc(x.s)}"`;
  if (typeof x === 'number') return num(x);
  return String(x);
}

/** 이름이 head 인 자식 목록 */
export const kids = (node, head) => (node || []).filter((c) => Array.isArray(c) && c[0] === head);
export const kid = (node, head) => kids(node, head)[0];
export const str = (x) => (isStr(x) ? x.s : x);
