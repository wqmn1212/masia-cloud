// 금형 견적서(공장이 올린 엑셀·PDF·사진)를 읽어 부품별 금형비·사출 단가·캐비티를 뽑는다. 결과는 사람이 확인한 뒤 원가 카드에 넣는다.
import { base44 } from '@/api/base44Client';

const SCHEMA = {
  type: 'object',
  properties: {
    factory: { type: 'string', description: '견적을 낸 공장 이름 (없으면 빈 문자열)' },
    date: { type: 'string', description: '견적 날짜 YYYY-MM-DD (없으면 빈 문자열)' },
    currency: { type: 'string', description: '금액 통화: CNY, USD, KRW 중 하나' },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          part: { type: 'string', description: '부품 이름 (견적서에 적힌 그대로)' },
          mold: { type: 'number', description: '이 부품 금형비 (통화 단위 그대로, 없으면 0)' },
          unit: { type: 'number', description: '이 부품 사출 단가 1개 값 (없으면 0). 수량별 단가가 여럿이면 가장 적은 수량의 단가' },
          cavities: { type: 'number', description: '캐비티(模穴) 수, 없으면 0' },
        },
      },
    },
    notes: { type: 'string', description: '금형강·수명·납기·결제 조건 등 한국어 요약 2~3문장' },
  },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[\s·_\-()]/g, '');
// 견적서 부품 이름(중국어·영어일 수 있음) ↔ 우리 부품 이름: 같은 글자, 포함, 흔한 번역어로 맞춘다
const ALIAS = [[/前|front|앞/i, '앞'], [/后|後|rear|back|뒤/i, '뒤'], [/底|base|받침/i, '받침'], [/扩散|diffus|확산/i, '확산'], [/盖|cap|cover|뚜껑|덮개/i, '뚜껑'], [/上|top|upper|위/i, '위'], [/下|bottom|lower|아래/i, '아래'], [/旋钮|knob|dial|다이얼|노브/i, '다이얼']];
export function matchQuoteRows(rows, partNames) {
  const used = new Set();
  return (rows || []).map((r) => {
    const n = norm(r.part);
    let hit = partNames.find((p) => !used.has(p) && (norm(p) === n || norm(p).includes(n) || n.includes(norm(p))));
    if (!hit) {
      const tags = ALIAS.filter(([re]) => re.test(r.part)).map(([, t]) => t);
      hit = tags.length ? partNames.filter((p) => !used.has(p)).sort((a, b) => tags.filter((t) => b.includes(t)).length - tags.filter((t) => a.includes(t)).length).find((p) => tags.some((t) => p.includes(t))) : null;
    }
    if (hit) used.add(hit);
    return { ...r, match: hit || '' };
  });
}

/** 파일을 올려 읽는다 → { factory, date, currency, rows: [{ part, mold, unit, cavities, match }], notes } */
export async function readMoldQuote(file, partNames) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  const r = await base44.integrations.Core.InvokeLLM({
    prompt: `첨부한 파일은 플라스틱 사출 금형 공장의 견적서입니다. 부품(零件)마다 금형비(模具费)와 사출 단가(注塑单价), 캐비티 수(模穴数)를 표로 뽑으세요.\n- 금액은 견적서의 통화 단위 그대로 숫자만 넣습니다 (만 元 이면 10000 을 곱해 元 으로).\n- 없는 값은 0.\n- 우리 부품 이름 참고: ${partNames.join(', ')}`,
    file_urls: [file_url],
    response_json_schema: SCHEMA,
  });
  return { factory: r.factory || '', date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : '', currency: ['CNY', 'USD', 'KRW'].includes(r.currency) ? r.currency : 'CNY', rows: matchQuoteRows(r.rows || [], partNames), notes: r.notes || '' };
}
