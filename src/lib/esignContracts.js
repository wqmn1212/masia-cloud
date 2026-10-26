import { clientLines } from './quoteCompare.js';
import { formatMoney } from '../components/quotation/quoteCurrency.js';

// 전자서명용 계약서 양식과 전자서명 조항. 양식 문구는 초안이며 운영 전에 법무 검토를 받는다.
// 1단계 전자서명은 양자 계약(고객–이지스)만: 공급 계약(견적 발행 이지스·고객→이지스 송금)과 월 구독 계약.
// 고객이 공장에 직접 송금하는 견적은 공장이 당사자인 3자 계약이라 2단계에서 지원한다.

export const CONTRACT_TYPES = {
  SUPPLY: '공급 계약 (고객–이지스)',
  SERVICE: '월 구독 계약',
  AMENDMENT: '변경 계약',
  TRIPARTITE: '3자 계약 (공장 포함, PDF 로 진행)',
};

// 서버(base44/shared/signature.ts)의 hasEsignClause 와 같은 규칙
export const hasEsignClause = (body) => /제\s?\d+\s?조\s*\(전자서명\)/.test(String(body || ''));
export const esignClauseText = (n) => [
  `제${n}조 (전자서명)`,
  '① 본 계약은 이지스 클라우드의 전자서명으로 체결하며, 각 당사자는 전자서명이 자필 서명 또는 기명날인과 같은 효력을 갖는 데 동의한다.',
  '② 계약의 원본은 서명 완료 시 발급되는 전자문서(전자서명 확인서와 감사 추적 페이지 포함)로 하며, 각 당사자는 이를 내려받아 보관한다.',
  '③ 서명자는 고객사 계정으로 로그인하고 계정 전자우편으로 받은 인증번호로 본인 확인을 한 뒤 서명한다.',
].join('\n');

// 본문에 전자서명 조항이 없으면 마지막 조 다음 번호로 서명란 앞에 넣는다
export function addEsignClause(body) {
  const text = String(body || '');
  if (hasEsignClause(text)) return text;
  const nums = [...text.matchAll(/^제\s?(\d+)\s?조/gm)].map((m) => Number(m[1]));
  const clause = esignClauseText((nums.length ? Math.max(...nums) : 0) + 1);
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^(특약 사항|본 계약의 성립을 증명)/.test(l.trim()) || /\((서명\/인|전자서명)\)\s*$/.test(l));
  if (at < 0) return `${text.replace(/\s+$/, '')}\n\n${clause}\n`;
  return [...lines.slice(0, at), clause, '', ...lines.slice(at)].join('\n');
}

// 견적의 정산 경로로 기본 계약 종류를 정한다
export const defaultContractType = (q) => (q?.settlement_route === 'CLIENT_TO_FACTORY' ? 'TRIPARTITE' : 'SUPPLY');

const fmtDate = (d) => {
  if (!d) return '____년 __월 __일';
  const [y, m, dd] = String(d).split('-');
  return `${y}년 ${Number(m)}월 ${Number(dd)}일`;
};
const AEGIS = 'DONGGUAN AEGIS TRADE CO., LTD (이지스)';

export function buildSupplyContract(q, { clientName = '', contractDate } = {}) {
  const gap = clientName || q?.client_name || '____________';
  const product = q?.quote_title || q?.product_name || '____________';
  const quoteNo = q?.id ? `Q-${q.id.slice(-8).toUpperCase()}` : '____________';
  const c = q ? clientLines(q) : { lines: [], total: 0, currency: 'USD', separate: null };
  const total = c.total ? formatMoney(c.total, c.currency) : '____________';
  const adv = Number(q?.advance_payment_percent) || 50;
  const bal = Number(q?.balance_payment_percent) || 100 - adv;
  const term = q?.incoterms || 'EXW';
  const days = q?.shipping_days ? `${q.shipping_days}일` : '____일';
  const L = [];
  const p = (...x) => L.push(...x);
  p('제품 공급 계약서', product, '');
  p(`${gap}(이하 "갑")과 ${AEGIS}(이하 "을")은 을이 갑에게 아래 제품을 공급하는 데 관하여 다음과 같이 계약을 체결한다.`, '');
  p('제1조 (목적)', '본 계약은 을이 중국 협력 공장에서 생산·조달한 제품을 갑에게 공급하고, 갑이 그 대금을 지급하는 데 관한 권리와 의무를 정함을 목적으로 한다.', '');
  p('제2조 (계약 대상)', `① 계약 대상은 을이 발행한 견적서 ${quoteNo}(${product})에 기재된 품목과 수량으로 하며, 견적서는 본 계약의 일부를 이룬다.`);
  c.lines.slice(0, 12).forEach((l) => p(`  - ${l.name || '품목'}${l.spec ? ` (${l.spec})` : ''}${l.qty ? ` × ${Number(l.qty).toLocaleString()}` : ''}`));
  p('② 세부 사양은 견적서와 갑이 승인한 품질 기준서(있는 경우)에 따른다.', '');
  p('제3조 (계약금액)', `① 계약금액은 ${total}(${c.currency})으로 하며, 부가가치세와 수입 시 갑이 부담하는 관세·통관 비용은 별도로 한다.`);
  if (c.separate) p(`② 견적서에 따로 적은 물류비 ${formatMoney(c.separate.amount, c.separate.currency)}는 계약금액과 별도로 청구한다.`);
  p('', '제4조 (대금 지급)', `① 갑은 계약 체결 후 7일 안에 계약금액의 ${adv}%를 선금으로 지급한다.`, `② 잔금 ${bal}%는 출고 전 검수 결과를 갑이 확인한 뒤 출고 전까지 지급한다.`, '③ 을은 입금을 확인하면 이지스 클라우드에 기록하고 갑에게 알린다.', '');
  p('제5조 (인도 조건과 납기)', `① 인도 조건은 ${term}(Incoterms 2020)으로 한다.`, `② 을은 선금 입금일로부터 ${days} 안에 출고할 수 있도록 생산을 관리한다. 공장 휴무·원자재 수급 등으로 일정이 바뀌면 지체 없이 갑에게 알리고 새 일정을 협의한다.`, '');
  p('제6조 (검수와 출고 승인)', '① 을은 출고 전에 검수하고 사진과 결과를 이지스 클라우드로 갑에게 공개한다.', '② 갑은 검수 결과를 확인하고 출고 승인 또는 보완 요청을 한다. 갑의 승인 없이 출고하지 아니한다.', '');
  p('제7조 (품질 보증)', '① 을은 제품이 견적서와 승인된 품질 기준에 맞도록 공장을 관리한다.', '② 갑은 제품을 받은 날로부터 30일 안에 하자를 발견하면 사진 등 근거와 함께 을에게 알리고, 을은 공장과 협의하여 교환·보수·대금 조정 중 하나로 처리한다.', '');
  p('제8조 (소유권과 위험의 이전)', '제품의 위험은 제5조의 인도 조건에 따라 이전하며, 소유권은 갑이 계약금액을 모두 지급한 때 이전한다.', '');
  p('제9조 (비밀유지와 지식재산권)', '① 양 당사자는 본 계약과 관련하여 알게 된 상대방의 영업상 정보를 상대방의 동의 없이 제3자에게 공개하지 아니한다.', '② 갑이 제공한 설계자료·상표·디자인에 관한 권리는 갑에게 있다.', '');
  p('제10조 (계약의 변경)', '본 계약의 변경은 양 당사자가 변경 계약서에 서명한 경우에만 효력이 있다.', '');
  p('제11조 (해제)', '① 상대방이 본 계약을 위반하고 14일 이상의 기간을 정한 시정 요구에도 시정하지 아니하면 계약을 해제할 수 있다.', '② 생산이 시작된 뒤 갑의 사정으로 해제하는 경우, 갑은 을이 이미 지출했거나 공장에 지급할 의무가 생긴 비용을 부담한다.', '');
  p('제12조 (손해배상)', '당사자가 본 계약을 위반하여 상대방에게 손해를 입힌 경우 그 손해를 배상한다. 다만 간접손해와 일실이익은 제외하며, 배상 총액은 계약금액을 한도로 한다.', '');
  p('제13조 (불가항력)', '천재지변, 전쟁, 감염병, 정부 조치 등 당사자가 통제할 수 없는 사유로 의무를 이행하지 못한 경우 그 책임을 지지 아니하며, 지체 없이 상대방에게 알린다.', '');
  p('제14조 (분쟁의 해결)', '본 계약에 관한 분쟁은 협의로 해결하되, 협의가 되지 아니하면 서울중앙지방법원을 제1심 관할 법원으로 한다. 본 계약은 대한민국 법에 따른다.', '');
  p(esignClauseText(15), '');
  p('제16조 (기타)', '본 계약에 정하지 아니한 사항은 견적서, 상관례 및 관련 법령에 따른다.', '');
  p('특약 사항', '(조항 라이브러리에서 필요한 특약을 선택해 아래에 삽입하세요)', '');
  p(fmtDate(contractDate), '');
  p(`갑 ${gap}                    (전자서명)`);
  p(`을 ${AEGIS}                    (전자서명)`);
  return L.join('\n');
}

export function buildServiceContract(agreement = {}, { clientName = '', contractDate } = {}) {
  const gap = clientName || agreement.company_name || '____________';
  const fee = agreement.monthly_fee ? formatMoney(agreement.monthly_fee, agreement.currency || 'KRW') : '____________';
  const L = [];
  const p = (...x) => L.push(...x);
  p('중국 소싱·생산관리 서비스 이용 계약서', agreement.title || '', '');
  p(`${gap}(이하 "갑")과 ${AEGIS}(이하 "을")은 을이 제공하는 중국 소싱·생산관리 서비스 이용에 관하여 다음과 같이 계약을 체결한다.`, '');
  p('제1조 (목적)', '본 계약은 을이 갑의 중국 제조 프로젝트에 대하여 공장 확인, 견적 비교, 생산 진행 관리, 검수, 물류 조율 서비스를 제공하고 갑이 이용료를 지급하는 데 관한 사항을 정함을 목적으로 한다.', '');
  p('제2조 (서비스 범위)', '① 을은 계약 기간 동안 다음 서비스를 제공한다.', '  1. 프로젝트별 공장 후보 확인과 견적 비교', '  2. 생산 일정 관리와 진행 상황 보고 (이지스 클라우드)', '  3. 출고 전 검수와 결과 공개', '  4. 선적·통관 일정 조율', '② 동시에 진행하는 프로젝트 수와 세부 범위는 요금제에 따르며, 범위를 넘는 업무는 양 당사자가 따로 협의한다.', '');
  p('제3조 (계약 기간)', `계약 기간은 ${fmtDate(agreement.start_date)}부터 ${fmtDate(agreement.end_date)}까지(${agreement.term_months || '__'}개월)로 한다.`, '');
  p('제4조 (이용료)', `① 월 이용료는 ${fee}(부가가치세 별도)로 한다.`, '② 을은 매월 초 전월 이용료를 청구하고, 갑은 청구일로부터 14일 안에 지급한다.', '');
  p('제5조 (제품 대금)', '프로젝트별 제품 대금과 물류비는 이용료와 별도이며, 프로젝트마다 견적서와 공급 계약으로 정한다. 갑이 공장에 직접 송금하는 경우 을이 확인한 공장 계좌로만 송금한다.', '');
  p('제6조 (갑의 협조)', '갑은 사양·도면·승인 의사결정을 적시에 제공한다. 갑의 자료 제공이나 승인이 늦어져 생긴 일정 지연은 을의 책임으로 보지 아니한다.', '');
  p('제7조 (비밀유지와 지식재산권)', '① 양 당사자는 본 계약과 관련하여 알게 된 상대방의 영업상 정보를 상대방의 동의 없이 제3자에게 공개하지 아니한다.', '② 갑이 제공한 설계자료·상표·디자인에 관한 권리는 갑에게 있다.', '');
  p('제8조 (갱신과 해지)', '① 어느 당사자도 기간 만료 30일 전까지 해지 의사를 알리지 아니하면 같은 조건으로 같은 기간 갱신한다.', '② 어느 당사자든 30일 전에 알리고 계약을 해지할 수 있다. 이미 시작된 프로젝트의 처리는 양 당사자가 협의한다.', '');
  p('제9조 (책임의 제한)', '을은 공장 관리에 선량한 관리자의 주의를 다한다. 을의 고의 또는 중대한 과실이 없는 한, 을의 배상 책임은 직전 3개월 이용료 합계를 한도로 한다.', '');
  p('제10조 (분쟁의 해결)', '본 계약에 관한 분쟁은 협의로 해결하되, 협의가 되지 아니하면 서울중앙지방법원을 제1심 관할 법원으로 한다. 본 계약은 대한민국 법에 따른다.', '');
  p(esignClauseText(11), '');
  p('제12조 (기타)', '본 계약에 정하지 아니한 사항은 상관례와 관련 법령에 따른다.', '');
  p(fmtDate(contractDate), '');
  p(`갑 ${gap}                    (전자서명)`);
  p(`을 ${AEGIS}                    (전자서명)`);
  return L.join('\n');
}
