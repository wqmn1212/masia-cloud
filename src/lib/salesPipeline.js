// 아웃바운드 영업 파이프라인: 단계, 다음 연락일 계산, 메일 문안.
export const STAGES = [
  { key: 'TARGET', label: '발굴', hint: '연락할 곳으로 찾아 둠', tone: 'bg-muted text-muted-foreground' },
  { key: 'SENT', label: '연락함', hint: '콜드메일·전화를 보냄', tone: 'bg-primary/10 text-primary' },
  { key: 'REPLIED', label: '회신', hint: '답이 옴', tone: 'bg-warning/15 text-warning-text' },
  { key: 'MEETING', label: '미팅', hint: '미팅 잡힘·진행', tone: 'bg-chart-4/15 text-chart-4' },
  { key: 'QUOTE', label: '견적', hint: '견적·조건 협의', tone: 'bg-chart-2/15 text-chart-2' },
  { key: 'WON', label: '수주', hint: '고객사·업무 카드로 전환', tone: 'bg-success/15 text-success-text' },
  { key: 'LOST', label: '보류', hint: '지금은 아님 (이유 기록)', tone: 'bg-muted text-muted-foreground' },
];
export const ACTIVE = ['TARGET', 'SENT', 'REPLIED', 'MEETING', 'QUOTE'];
export const stageOf = (k) => STAGES.find((s) => s.key === k) || STAGES[0];
export const SOURCES = { cold_email: '콜드메일', referral: '소개', exhibition: '전시회', inbound: '문의', lead_magnet: '자료 신청', meta_lead: '인스타·페북 광고', other: '기타' };
export const TOUCH_KINDS = { email: '메일', call: '전화', meeting: '미팅', message: '메신저', note: '메모' };

/** 한국 날짜 YYYY-MM-DD */
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

/** 영업일(토·일 제외) n 일 뒤 */
export function addBusinessDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** 연락 뒤 다음 연락일 기본값: 첫 메일 뒤 4영업일, 회신·미팅 뒤 2영업일, 견적 뒤 3영업일 */
export function defaultFollowUp(stage, today) {
  const days = { TARGET: 1, SENT: 4, REPLIED: 2, MEETING: 2, QUOTE: 3 }[stage];
  return days ? addBusinessDays(today, days) : '';
}

/** 오늘 연락할 곳·밀린 곳 */
export function followUpState(p, today) {
  if (!ACTIVE.includes(p.stage) || !p.next_follow_up) return null;
  if (p.next_follow_up < today) return { late: true, days: Math.round((Date.parse(today) - Date.parse(p.next_follow_up)) / 86400000) };
  if (p.next_follow_up === today) return { today: true };
  return null;
}

/** 연락 몇 번째인지 (메일·전화·메신저) */
export const outreachCount = (p) => (p.touches || []).filter((t) => ['email', 'call', 'message'].includes(t.kind)).length;

const name = (p) => (p.contact_name ? `${p.contact_name}${p.contact_title ? ` ${p.contact_title}` : ''}님` : '담당자님');
/** 메일 문안: 첫 메일 · 팔로업 1 · 팔로업 2 · 미팅 뒤 감사 */
export function mailTemplates(p, { sender = '[보내는 사람]', deck = '[소개 자료 링크]' } = {}) {
  const product = p.product_idea ? `${p.product_idea}` : '새 제품';
  return [
    {
      key: 'first', label: '첫 메일',
      subject: `[AEGIS] ${p.company} ${product} 개발·생산을 한 팀이 끝까지 맡아 드립니다`,
      body: `${name(p)}, 안녕하세요. 제품 개발·제조 파트너 AEGIS 의 ${sender}입니다.\n\n${p.company}에서 ${product}${p.industry ? `(${p.industry})` : ''}을 준비하신다면 도움이 될 것 같아 연락드립니다.\n\nAEGIS 는 한국 본사와 중국 동관 지사가 함께 설계하고, 시제품·금형·양산·QC·선적까지 현지에서 직접 관리합니다. 진행 상황은 고객 전용 계정에서 일정·검수 사진·선적·비용까지 실시간으로 확인하실 수 있습니다.\n\n소개 자료: ${deck}\n\n스케치나 사진 한 장만 보내 주셔도 진행 방식과 대략의 일정·비용을 정리해 드리겠습니다. 편하신 때 15분 통화도 좋습니다.\n\n감사합니다.\n${sender} 드림`,
    },
    {
      key: 'follow1', label: '팔로업 1',
      subject: `Re: [AEGIS] ${p.company} ${product} 관련`,
      body: `${name(p)}, 지난번 메일 드린 AEGIS ${sender}입니다.\n\n바쁘신 중에 다시 연락드립니다. 혹시 지금 진행 중이거나 검토 중인 제품이 있으시면, 고객 포털 데모 화면을 15분 정도 보여 드리고 싶습니다. 공장 진행 상황이 어떻게 보이는지 직접 보시면 판단이 빠르실 겁니다.\n\n소개 자료: ${deck}\n\n편하신 시간 두세 개만 알려 주세요.\n${sender} 드림`,
    },
    {
      key: 'follow2', label: '팔로업 2 (마지막)',
      subject: `Re: [AEGIS] ${p.company} 마지막으로 연락드립니다`,
      body: `${name(p)}, AEGIS ${sender}입니다.\n\n여러 번 연락드려 죄송합니다. 지금은 시기가 아니시면 편하게 말씀만 주세요. 나중에 개발·생산이 필요하실 때 이 메일에 회신만 주시면 바로 도와드리겠습니다.\n\n${sender} 드림`,
    },
    {
      key: 'thanks', label: '미팅 뒤 감사',
      subject: `[AEGIS] 오늘 미팅 감사합니다 — 다음 단계 정리`,
      body: `${name(p)}, 오늘 시간 내 주셔서 감사합니다.\n\n말씀 나눈 내용과 다음 단계를 정리해 드립니다.\n- 제품: ${product}\n- 다음 단계: [예: 스케치·참고 사진 전달 → 대략 견적 회신]\n- 일정: [날짜]\n\n자료를 보내 주시면 고객 계정을 만들어 드리고, 진행 상황을 그 화면에서 함께 보실 수 있게 하겠습니다.\n\n${sender} 드림`,
    },
  ];
}

/** CSV(엑셀) 한 줄씩 붙여 넣은 목록 → 영업 대상. 첫 줄이 머리글이면 이름으로 맞춘다 */
const HEAD = { 회사: 'company', 회사명: 'company', company: 'company', 담당자: 'contact_name', 이름: 'contact_name', name: 'contact_name', 직함: 'contact_title', title: 'contact_title', 이메일: 'email', email: 'email', 메일: 'email', 전화: 'phone', phone: 'phone', 홈페이지: 'website', website: 'website', 업종: 'industry', industry: 'industry', 제품: 'product_idea', 관심: 'product_idea', product: 'product_idea', 메모: 'notes', notes: 'notes' };
export function parseProspects(text) {
  const rows = String(text || '').split(/\r?\n/).map((l) => l.split(/\t|,/).map((c) => c.trim())).filter((r) => r.some(Boolean));
  if (!rows.length) return [];
  const head = rows[0].map((c) => HEAD[c.toLowerCase()] || HEAD[c] || null);
  const hasHead = head.filter(Boolean).length >= 2;
  const cols = hasHead ? head : ['company', 'contact_name', 'email', 'phone', 'industry', 'product_idea'];
  return (hasHead ? rows.slice(1) : rows).map((r) => {
    const o = {};
    cols.forEach((k, i) => { if (k && r[i]) o[k] = r[i].slice(0, 300); });
    if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) delete o.email;
    return o;
  }).filter((o) => o.company);
}
