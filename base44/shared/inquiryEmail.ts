import { emailLayout, p, facts, esc, steps, heading, strong } from './emailLayout.ts';

// 문의자 접수 확인 메일 (한·영·중) — 공통 메일 틀
export function inquiryReceivedEmail(lang: string, d: { company: string; typeLabel: string; categories: string[]; quantity: string; attachments: number }) {
  const L = lang === 'en' || lang === 'zh' ? lang : 'ko';
  const t = {
    ko: { kind: '문의 접수', eyebrow: '접수 완료', title: '제조 문의가 접수되었습니다', pre: '영업일 기준 1일 안에 담당자가 회신드립니다',
      lead: `안녕하세요. 보내 주신 문의를 잘 받았습니다.<br>영업일 기준 ${strong('1일 안에')} 담당자가 회신드리며, AEGIS Cloud 계정 안내도 함께 보내드립니다.`,
      rows: [['회사명', d.company], ['문의 유형', d.typeLabel], ['품목', d.categories.join(', ') || '-'], ['수량', d.quantity || '-'], ['첨부', `${d.attachments}개`]],
      next: '이렇게 진행됩니다', steps: [['담당자 검토와 회신', '사양을 확인하고 필요한 추가 정보를 여쭤봅니다'], ['광둥성 공장 확인', '맞는 공장을 찾아 가능 여부와 견적을 받습니다'], ['견적·일정 안내', 'AEGIS Cloud에서 견적과 진행 상황을 함께 봅니다']],
      foot: '이 메일은 문의 접수 확인용 자동 메일입니다. 추가로 전할 내용이 있으면 담당자 회신 메일에 답장해 주세요.' },
    en: { kind: 'Request received', eyebrow: 'Received', title: 'We received your manufacturing request', pre: 'Our team will reply within one business day',
      lead: `Hello, thank you for your request.<br>Our team will reply ${strong('within one business day')} with next steps and your AEGIS Cloud account details.`,
      rows: [['Company', d.company], ['Type', d.typeLabel], ['Category', d.categories.join(', ') || '-'], ['Quantity', d.quantity || '-'], ['Files', String(d.attachments)]],
      next: 'What happens next', steps: [['Review and reply', 'We check your specs and ask for anything missing'], ['Factory check in Guangdong', 'We find suitable factories and get feasibility and quotes'], ['Quote and schedule', 'Follow quotes and progress together in AEGIS Cloud']],
      foot: 'This is an automated confirmation. To add details, reply to the email from our team.' },
    zh: { kind: '询价已收到', eyebrow: '已受理', title: '已收到您的制造询价', pre: '我们将在一个工作日内回复',
      lead: `您好，我们已收到您的询价。<br>我们将在${strong('一个工作日内')}回复后续步骤及 AEGIS Cloud 账号信息。`,
      rows: [['公司', d.company], ['询价类型', d.typeLabel], ['品类', d.categories.join(', ') || '-'], ['数量', d.quantity || '-'], ['附件', `${d.attachments}个`]],
      next: '接下来的流程', steps: [['负责人审核与回复', '确认规格并询问需要补充的信息'], ['广东工厂确认', '寻找合适的工厂，确认可行性并获取报价'], ['报价与日程', '在 AEGIS Cloud 中一起查看报价和进度']],
      foot: '本邮件为询价确认自动邮件。如需补充信息，请回复负责人的邮件。' },
  }[L];
  return emailLayout({ lang: L, kind: t.kind, eyebrow: t.eyebrow, title: t.title, preheader: t.pre, footNote: t.foot,
    body: p(t.lead) + facts(t.rows.map(([k, v]) => [k, esc(v)] as [string, string])) + heading(t.next) + steps(t.steps as [string, string][]) });
}
