// 인스타그램·페이스북 리드 광고에서 내려받은 신청자 파일(CSV) 읽기
// Meta 광고 관리자 '리드 다운로드' 파일은 UTF-16 탭 구분인 경우가 많고, 직접 만든 엑셀 CSV 는 UTF-8 쉼표 구분이다. 둘 다 읽는다.

export function decodeLeadFile(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  const t = new TextDecoder('utf-8').decode(b);
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

/** 글자 → 표 (따옴표 안 쉼표·줄바꿈 처리) */
export function parseTable(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); cell = ''; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row);
  const [head = [], ...body] = rows;
  return { headers: head.map((h) => h.trim()), rows: body };
}

const find = (headers, re) => headers.findIndex((h) => re.test(h));
/** 칸 이름으로 짐작 (화면에서 고칠 수 있다) */
export function guessColumns(headers) {
  return {
    email: find(headers, /^(e-?mail|work_email|이메일|메일)/i),
    name: find(headers, /^(full_name|name|이름|성명)$/i),
    first: find(headers, /^first_name$/i),
    last: find(headers, /^last_name$/i),
    company: find(headers, /^(company_name|company|회사|회사명|업체명)/i),
    phone: find(headers, /^(phone_number|phone|전화|전화번호|연락처)/i),
    created: find(headers, /^(created_time|신청일|날짜|date)/i),
    id: find(headers, /^(id|lead_id)$/i),
    marketing: find(headers, /(광고|마케팅|marketing|소식|newsletter|promo)/i),
  };
}

const YES = /^(true|yes|y|1|예|네|동의|동의함|checked|o|✓|✔)$/i;
export const isYes = (v) => YES.test(String(v ?? '').trim());

const STD = /^(id|created_time|ad_id|ad_name|adset_id|adset_name|campaign_id|campaign_name|form_id|form_name|is_organic|platform|lead_status|inbox_url)$/i;
/** 표 → 서버로 보낼 줄 (이메일 없는 줄은 뺀다) */
export function rowsFromTable({ headers, rows }, map) {
  const at = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const used = new Set(Object.values(map).filter((i) => i >= 0));
  return rows.map((r) => ({
    external_id: at(r, map.id).replace(/^l:/, ''),
    created_time: at(r, map.created),
    email: at(r, map.email).toLowerCase(),
    name: at(r, map.name) || [at(r, map.first), at(r, map.last)].filter(Boolean).join(' '),
    company: at(r, map.company),
    phone: at(r, map.phone).replace(/^p:/, ''),
    marketing: map.marketing >= 0 && isYes(at(r, map.marketing)),
    idea: headers.map((h, i) => (!used.has(i) && !STD.test(h) && at(r, i) ? `${h}: ${at(r, i)}` : '')).filter(Boolean).join(' / ').slice(0, 600),
  })).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email));
}
