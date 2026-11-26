// OrCAD OPJ is a project manifest, not schematic or PCB geometry.
// Keep source spans so editing a value leaves every other byte-level text field alone.
export function parseOpj(text) {
  let i = 0;
  const roots = [], stack = [], nodes = [];
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    if (text[i] === ';') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (text[i] === '(') {
      const parent = stack[stack.length - 1];
      const children = parent ? parent.children : roots;
      const node = { id: `${parent?.id || 'root'}.${children.length}`, start: i++, atoms: [], children: [] };
      if (stack.length >= 100) throw new Error('프로젝트 구조가 너무 깊습니다.');
      children.push(node); nodes.push(node); stack.push(node); continue;
    }
    if (text[i] === ')') {
      if (!stack.length) throw new Error('닫는 괄호가 맞지 않습니다.');
      stack.pop().end = ++i; continue;
    }
    if (!stack.length) throw new Error('OrCAD 프로젝트 구조가 아닙니다.');
    const start = i, quoted = text[i] === '"';
    let value = '';
    if (quoted) {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && text[i + 1] === '"') { value += '"'; i += 2; }
        else value += text[i++]; // Windows backslashes are literal, not JS escapes.
      }
      if (i >= text.length) throw new Error('문자열의 따옴표가 닫히지 않았습니다.');
      i++;
    } else {
      while (i < text.length && !/[\s()"]/.test(text[i])) value += text[i++];
    }
    stack[stack.length - 1].atoms.push({ start, end: i, value, quoted });
  }
  if (stack.length || roots.length !== 1 || !['ExpressProject', 'Project'].includes(roots[0]?.atoms[0]?.value)) throw new Error('지원하는 OrCAD OPJ 프로젝트 구조가 아닙니다.');
  for (const node of nodes) node.head = node.atoms[0]?.value || '';
  return { root: roots[0], nodes };
}

export function patchOpjAtom(text, atom, value) {
  if (/[\r\n\0]/.test(value) || (!atom.quoted && /[\s()"]/.test(value))) throw new Error('이 값에 줄바꿈이나 구조 문자를 넣을 수 없습니다.');
  const replacement = atom.quoted ? `"${value.replace(/"/g, '\\"')}"` : value;
  const next = text.slice(0, atom.start) + replacement + text.slice(atom.end);
  parseOpj(next);
  return next;
}

export function inspectNativePcb(bytes, name) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let encoding = 'utf-8', bom = new Uint8Array(), text = null;
  if (b[0] === 255 && b[1] === 254) { encoding = 'utf-16le'; bom = b.slice(0, 2); }
  else if (b[0] === 254 && b[1] === 255) { encoding = 'utf-16be'; bom = b.slice(0, 2); }
  else if (b[0] === 239 && b[1] === 187 && b[2] === 191) bom = b.slice(0, 3);
  try { text = new TextDecoder(encoding, { fatal: true }).decode(b.subarray(bom.length)); } catch { /* Unknown encoding is read-only; never re-encode it silently. */ }
  const readable = text !== null && !/[\x00-\x08\x0e-\x1f]/.test(text);
  const base = { bytes: b, name, encoding, bom, text: readable ? text : null };
  if (readable && /^\s*\(kicad_pcb\b/.test(text)) return { ...base, kind: 'kicad' };
  if (/\.opj$/i.test(name) && readable) {
    try { parseOpj(text); return { ...base, kind: 'opj' }; }
    catch (e) { return { ...base, kind: 'unsupported', reason: e.message }; }
  }
  return { ...base, kind: 'unsupported', reason: /\.opj$/i.test(name) ? '이 파일은 지원하는 텍스트 OrCAD 프로젝트가 아니거나 문자 인코딩을 확인할 수 없습니다.' : '이 PCB 형식의 회로 표시·편집·원본 형식 저장은 아직 지원하지 않습니다. 제작 프로그램과 버전 확인이 필요합니다.' };
}

export function encodeNativeText(file, text) {
  let body;
  if (file.encoding === 'utf-8') body = new TextEncoder().encode(text);
  else {
    body = new Uint8Array(text.length * 2);
    const view = new DataView(body.buffer);
    for (let i = 0; i < text.length; i++) view.setUint16(i * 2, text.charCodeAt(i), file.encoding === 'utf-16le');
  }
  const bytes = new Uint8Array(file.bom.length + body.length);
  bytes.set(file.bom); bytes.set(body, file.bom.length);
  return bytes;
}

export function downloadNativeFile(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}