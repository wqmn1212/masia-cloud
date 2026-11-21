// 자료 신청 페이지 화면용 (서버 규칙은 base44/shared/leadMagnet.ts)
import { base44 } from '@/api/base44Client';

export async function callLead(body) {
  try { return (await base44.functions.invoke('leadMagnet', body)).data; }
  catch (e) { const d = e?.response?.data; const err = new Error(d?.error || e.message); err.code = d?.code; throw err; }
}

export const publicUrl = (slug, ref = '') => `${window.location.origin}/free/${slug}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;

const BASE = {
  status: 'DRAFT', button_label: '', file: { file_uri: '', file_name: '', size: 0 }, campaign_id: '',
  operator: { company: '', email: '', phone: '', address: '', privacy_url: '' }, retention_months: 24, thanks: '', notify_email: '',
  meta: { form_ids: [], marketing_key: '', send_material: false },
};

// 바로 쓸 수 있는 두 가지 틀
export const TEMPLATES = {
  checklist: {
    ...BASE, kind: 'file', slug: 'checklist',
    title: '시제품부터 양산까지, 놓치면 비싸지는 체크리스트 72',
    subtitle: '금형을 다시 깎고, 인증에서 막히고, 견적이 두 배로 뛰는 일은 대부분 처음 몇 주에 정해집니다. 하드웨어 제품을 처음 만드는 팀이 단계마다 확인할 것을 한 장씩 정리했습니다.',
    bullets: ['기획·사양부터 출하 검사까지 8단계 72개 확인 항목', '금형 수정비가 커지는 설계 실수 10가지', '중국 공장 견적을 같은 기준으로 비교하는 표', 'KC·전파 인증, 언제 무엇을 준비하는지'],
    button_label: '체크리스트 무료로 받기', ask: { company: true, phone: false, idea: true },
    thanks: '준비 중인 제품이 있으면 메일로 회신해 주세요. 3D 컨셉과 대략적인 양산 일정을 무료로 정리해 드립니다.',
  },
  report: {
    ...BASE, kind: 'report', slug: 'idea-check',
    title: '아이디어 한 줄이면, 양산 진단 리포트를 무료로',
    subtitle: '만들고 싶은 제품을 적어 주세요. 주요 부품, 금형 개수, 필요한 인증, 개발 단계와 기간, 양산에서 조심할 점을 바로 정리해 드립니다.',
    bullets: ['주요 부품과 금형 개수 추정', '필요할 수 있는 인증 (KC·전파 등)', '컨셉 → 시제품 → 금형 → 양산 단계별 기간', '양산에서 문제가 되기 쉬운 점과 지금 정할 것'],
    button_label: '무료 진단 받기', ask: { company: true, phone: false, idea: true },
    thanks: '리포트는 AI 가 만든 1차 초안입니다. 담당자가 보고 3D 컨셉까지 무료로 그려 드릴 수 있으니 메일로 회신해 주세요.',
  },
};

// 자료 신청자 후속 메일용 캠페인 (광고 수신에 동의한 사람만 받는다)
export const NURTURE_STEPS = [
  { after_days: 3, subject: '보내 드린 자료, 도움이 되셨나요?', body: '{담당자}님, 지난번 신청하신 자료는 잘 받으셨는지요.\n\n준비 중인 제품이 있다면 아이디어를 한두 줄만 회신해 주세요. 3D 컨셉과 대략적인 양산 일정·금형 개수를 무료로 정리해 보내 드리겠습니다.' },
  { after_days: 5, subject: '', body: '{담당자}님, 하드웨어 제품은 금형을 깎기 전에 정하는 것이 원가의 대부분을 결정합니다.\n\n저희는 아이디어 단계부터 3D 컨셉, 회로, 금형, 중국 공장 견적 비교, 출하 검사까지 한 곳에서 진행합니다. 15분 정도 통화로 지금 단계에서 무엇을 먼저 정하면 좋을지 말씀드릴 수 있습니다. 편하신 시간을 알려 주세요.' },
  { after_days: 7, subject: '', body: '{담당자}님, 마지막으로 한 번만 더 연락드립니다.\n\n지금은 시기가 맞지 않으시면 회신하지 않으셔도 괜찮습니다. 나중에 시제품이나 양산 계획이 생기시면 이 메일로 언제든 연락 주세요.' },
];
