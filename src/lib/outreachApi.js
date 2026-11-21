// 콜드메일 자동화 화면용 (서버 규칙은 base44/shared/outreach.ts — 여기 이름·표시는 그와 같게)
import { base44 } from '@/api/base44Client';

export const BASIS = [
  ['none', '근거 없음 — 보내지 않음'],
  ['opt_in', '수신 동의를 받음 (자료 받기 신청·뉴스레터 등)'],
  ['customer', '거래·문의 고객 (같은 종류 제품, 법정 기간 안)'],
  ['inquiry', '상대가 먼저 자료·견적을 요청함'],
  ['overseas', '해외 수신자 — 수신거부 방식 국가 (담당자 확인)'],
];
export const SENDABLE = ['opt_in', 'customer', 'inquiry', 'overseas'];

export const STATUS = {
  CANDIDATE: ['주소 필요', 'bg-secondary text-muted-foreground'],
  READY: ['초안 필요', 'bg-secondary text-foreground'],
  DRAFTED: ['승인 대기', 'bg-warning/15 text-warning-text'],
  APPROVED: ['발송 대기', 'bg-primary/10 text-primary'],
  SENDING: ['보내는 중', 'bg-primary/10 text-primary'],
  DONE: ['모두 보냄', 'bg-secondary text-foreground'],
  REPLIED: ['회신', 'bg-success/15 text-success-text'],
  UNSUBSCRIBED: ['수신거부', 'bg-destructive/10 text-destructive'],
  STOPPED: ['멈춤', 'bg-secondary text-muted-foreground'],
};
export const STATUS_ORDER = ['CANDIDATE', 'READY', 'DRAFTED', 'APPROVED', 'SENDING', 'REPLIED', 'DONE', 'UNSUBSCRIBED', 'STOPPED'];

export const EMPTY_CAMPAIGN = {
  name: '', status: 'DRAFT', target: '', region: '대한민국', exclude: '', offer: '', language: 'ko',
  sender: { company: '', name: '', title: '', phone: '', email: '', address: '', website: '' },
  brochure: { mode: 'link', file_uri: '', file_name: '', size: 0 },
  steps: [
    { after_days: 3, subject: '', body: '{담당자}님, 지난번 보내 드린 제안 메일을 확인하셨을지 여쭙습니다.\n\n{회사}에서 준비 중인 제품이 있다면 15분 정도 통화로 저희가 도울 수 있는 부분을 말씀드리고 싶습니다. 편하신 시간을 알려 주시면 맞추겠습니다.' },
    { after_days: 5, subject: '', body: '{담당자}님, 마지막으로 한 번만 더 연락드립니다.\n\n지금은 시기가 맞지 않으시면 회신 주시지 않으셔도 괜찮습니다. 나중에 시제품이나 양산 계획이 생기시면 언제든 이 메일로 연락 주세요.' },
  ],
  daily_limit: 20, ad_label: true,
};

export async function callOutreach(body) {
  try { return (await base44.functions.invoke('outreach', body)).data; }
  catch (e) { const d = e?.response?.data; throw new Error(d?.error || e.message); }
}

/** 보내는 메일 미리보기 (서버 footer 와 같은 모양) */
export function previewMail(c, p, appOrigin = window.location.origin) {
  const s = c?.sender || {};
  const ad = c?.ad_label === false ? '' : c?.language === 'en' ? '[Ad] ' : c?.language === 'zh' ? '(广告) ' : '(광고) ';
  const who = [s.company, s.name && `${s.name}${s.title ? ` ${s.title}` : ''}`].filter(Boolean).join(' · ');
  const contact = [s.phone, s.email, s.address].filter(Boolean).join(' · ');
  const tok = p?.outreach_token || '…';
  const brochure = c?.brochure?.file_uri && c.brochure.mode !== 'none' ? (c.brochure.mode === 'attach' ? `\n\n[첨부] ${c.brochure.file_name || '회사소개서.pdf'} (4 MB 가 넘으면 링크로 바뀜)` : `\n\n회사소개서: ${appOrigin}/b/${tok}`) : '';
  return {
    subject: `${ad}${p?.outreach?.draft?.subject || ''}`,
    body: `${p?.outreach?.draft?.body || ''}${brochure}\n\n—\n보낸 사람: ${who}\n${contact}${s.website ? `\n${s.website}` : ''}\n\n더 이상 받기를 원하지 않으시면 아래 링크를 열어 주세요 (무료 수신거부): ${appOrigin}/u/${tok}`,
  };
}
