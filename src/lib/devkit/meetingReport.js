// 미팅 결과 요약과 인증 준비 자료 (마크다운). 화면에서 내려받고 시제품 파일에 저장한다.
import { FEATURE_KINDS, MCUS, pinPlan, pinProblems } from './features.js';
import { describeRule, validRules } from './rules.js';
import { TEMPLATES } from '../cad/catalog.js';
import { diffDesign } from './freeze.js';

const d10 = (s) => (s ? String(s).slice(0, 10) : '');
const won = (v) => `${Math.round(v).toLocaleString('ko-KR')}원`;

/** 미팅 단계별 상태 (PrototypeDevelop 의 done 과 같은 기준 + 세부) */
export function meetingSteps(project, dev, { concept, circuits = [] } = {}) {
  const files = project.files || [];
  const md = dev.mold_design;
  return [
    { key: 'concept', label: '스케치·컨셉', done: !!concept, detail: concept ? `컨셉 v${concept.version_no || 1}` : '컨셉 3D 만들기' },
    { key: 'cad', label: '금형용 3D', done: !!md?.summary, detail: md?.template ? `${TEMPLATES[md.template]?.label || md.template}${md.summary ? ` · 사출 ${md.summary.parts.filter((p) => p.mold).length}개` : ' · 금형 점검 전'}` : '외장 형태·치수 정하기' },
    { key: 'features', label: '기능', done: (dev.features || []).length > 0, detail: `${(dev.features || []).length}개 · ${MCUS[dev.mcu]?.module || dev.mcu}` },
    { key: 'circuit', label: '회로·기판', done: circuits.length > 0 || files.some((f) => f.category === 'PCB'), detail: files.some((f) => f.category === 'PCB') ? 'KiCad·제조 파일 저장됨' : '회로도·기판 받기' },
    { key: 'ble', label: '펌웨어·블루투스', done: !!dev.uuid_base && files.some((f) => f.category === 'CODE'), detail: dev.uuid_base ? (files.some((f) => f.category === 'CODE') ? '펌웨어 저장됨' : 'UUID 고정 · 펌웨어 굽기 전') : 'UUID 만들기' },
    { key: 'sim', label: '동작 확인', done: Array.isArray(dev.rules), detail: Array.isArray(dev.rules) ? `규칙 ${dev.rules.length}개` : '동작 규칙 정하기' },
    { key: 'test', label: '확정·원가', done: !!dev.freeze, detail: dev.freeze ? `확정본 v${dev.freeze.version}` : '설계 확정 전' },
  ];
}

export function meetingReport(project, dev, { concept, circuits = [], cost = null, hw = null, attendees = '', decisions = '', actions = '' } = {}) {
  const plan = pinPlan(dev.features || [], dev.mcu, dev.rules);
  const problems = pinProblems(plan.features, dev.mcu, plan.i2c);
  const rules = validRules(dev.rules || [], dev.features || []);
  const md = dev.mold_design;
  const L = [`# ${project.title} — 개발 미팅 결과`, '', `- 날짜: ${new Date().toLocaleDateString('ko-KR')}`, ...(attendees ? [`- 참석: ${attendees}`] : []), `- 장치 이름: ${dev.device_name || '-'} · MCU ${MCUS[dev.mcu]?.module || dev.mcu} · 입력 ${dev.supply_v} V`, ''];
  L.push('## 진행 상황', '', '| 단계 | 상태 | 내용 |', '|---|---|---|', ...meetingSteps(project, dev, { concept, circuits }).map((s) => `| ${s.label} | ${s.done ? '완료' : '남음'} | ${s.detail} |`), '');
  if (md?.template) {
    const T = TEMPLATES[md.template];
    L.push('## 외장 (금형용 설계)', '', `- 형태: ${T?.label || md.template}`, `- 치수: ${(T?.params || []).filter((p) => md.params?.[p.key] != null).map((p) => `${p.label} ${md.params[p.key]}${p.unit ? ` ${p.unit}` : ''}`).join(', ')}`);
    if (md.summary) L.push(...md.summary.parts.filter((p) => p.mold).map((p) => `- ${p.name}: ${p.material} 약 ${p.weight} g${p.slides ? `, 슬라이드 ${p.slides}개` : ''}${p.hi ? `, 금형 점검 높음 ${p.hi}건` : ''}`));
    L.push('');
  }
  L.push('## 기능과 핀', '', '| 기능 | 종류 | GPIO |', '|---|---|---|', ...plan.features.map((f) => `| ${f.name} | ${FEATURE_KINDS[f.kind]?.label || f.kind} | ${Number.isInteger(f.pin) ? f.pin : '-'}${f.pins ? ` (${Object.entries(f.pins).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''} |`), '');
  if (plan.i2c) L.push(`- 시계(RTC) I2C: SDA ${plan.i2c.sda}, SCL ${plan.i2c.scl}`, '');
  if (rules.length) L.push('## 동작 규칙', '', ...rules.map((r) => `- ${describeRule(r, dev.features || [])}`), '');
  if (hw) L.push('## 회로·기판', '', `- 부품 ${hw.hw.comps.length}개 · 넷 ${hw.hw.nets.size}개 · 기판 ${hw.boards.map((b) => `${b.name} ${b.layout.size.join('×')} mm`).join(', ')}`, ...hw.hw.notes.map((n) => `- 확인: ${n}`), '');
  if (cost && !cost.missing.length) L.push('## 원가 추정 (초기)', '', '| 수량 | 개당 합계 | 총액 |', '|---|---|---|', ...cost.byQty.map((r) => `| ${r.qty.toLocaleString()} | ${won(r.total_per_unit)} | ${won(r.total)} |`), `- 금형비 합 ${won(cost.tooling)} (추정, 공장 견적으로 바꿀 것)`, '');
  if (dev.freeze) {
    const ch = diffDesign(dev.freeze.snapshot, dev);
    L.push('## 설계 확정', '', `- 확정본 v${dev.freeze.version} (${d10(dev.freeze.at)}, ${dev.freeze.by})${ch.length ? ` · 이후 바뀐 점 ${ch.length}건` : ''}`, ...ch.slice(0, 15).map((c) => `  - [${c.area}] ${c.text}`), '');
  }
  const issues = [...problems];
  if (issues.length) L.push('## 걸리는 점', '', ...issues.map((x) => `- ${x}`), '');
  if (decisions) L.push('## 결정 사항', '', ...decisions.split('\n').filter(Boolean).map((x) => `- ${x.replace(/^[-·]\s*/, '')}`), '');
  if (actions) L.push('## 할 일', '', ...actions.split('\n').filter(Boolean).map((x) => `- [ ] ${x.replace(/^[-·]\s*/, '')}`), '');
  L.push('---', '자동 작성: AEGIS 개발 워크벤치. 추정치(원가·배치)는 공장 견적·설계 검토로 확정합니다.');
  return L.join('\n');
}

/** KC 인증 준비 자료 체크리스트 (전기안전·전자파·무선) */
export function certChecklist(project, dev, { hw } = {}) {
  const f = dev.features || [];
  const mains = Number(dev.supply_v) > 6;
  const battery = f.some((x) => x.kind === 'battery');
  const heater = f.some((x) => x.kind === 'heater');
  const light = f.some((x) => x.kind === 'light');
  const L = [`# ${project.title} — 인증 준비 자료 (KC)`, '', '이 문서는 시험 기관 상담 전에 준비할 자료를 모은 체크리스트입니다. 실제 적용 기준·시험 항목은 시험 기관이 제품을 보고 정합니다.', ''];
  L.push('## 1. 무선 (전파법 · 적합인증)', '', `- 무선 모듈: ${MCUS[dev.mcu]?.module} (Bluetooth LE)`, '- 인증받은 모듈을 그대로 쓰면 완제품은 모듈 인증을 근거로 간소화할 수 있는지 시험 기관과 확인합니다 (모듈 KC 인증번호·안테나 조건 유지 필요).', '- 준비: 모듈 데이터시트, 모듈 인증서 사본, 안테나 주변 금지 구역 지킴 확인(기판 도면), 송신 출력 설정(펌웨어 기본값).', '');
  L.push('## 2. 전자파 적합성 (EMC · 적합등록)', '', '- 대상: 디지털 회로가 있는 전기전자제품 → 전자파 적합등록(KC)', `- 준비: 회로도(KiCad), 부품표, 기판 거버, 사용 클럭(MCU 160/240 MHz, PWM ${light ? '20 kHz 조명' : '1~20 kHz'}), 케이블 길이·종류`, `- 시험 전 자가 점검: 전원 입력 필터(페라이트·콘덴서), ${light ? 'LED 드라이버 스위칭 노이즈(벅 컨버터) — 인덕터·환류 다이오드 배치, ' : ''}USB 차폐 접지`, '');
  L.push('## 3. 전기 안전', '', mains ? `- 입력 ${dev.supply_v} V 직류 어댑터 사용: 어댑터는 KC 안전인증을 받은 제품을 쓰고 인증번호를 기록합니다 (본체는 저전압 직류 기기).` : '- USB 5 V 전원: 저전압 직류 기기. USB 어댑터는 KC 인증 제품 권장 (별매면 사용 설명서에 명시).', ...(battery ? ['- 리튬 배터리: 이차전지 KC 안전인증(셀·팩), 보호 회로(PCM) 내장 셀 사용, 충전 IC 온도 보호 확인.'] : []), ...(heater ? ['- 히터: 온도 퓨즈(1차 보호)와 펌웨어 차단(2차) 이중 보호, 표면 온도 시험 준비.'] : []), ...(light ? ['- 조명: LED 판 85 °C 하드웨어 차단(비교기) 시험 기록, 광생물학적 안전(청색광) 해당 여부 시험 기관 확인.'] : []), '');
  L.push('## 4. 제출·보관 자료 목록', '', '- [ ] 제품 사진 (외관 6면, 내부, 기판 앞뒤)', '- [ ] 회로도 (KiCad → PDF 로 출력)', '- [ ] 부품표 (주요 부품 제조사·모델, 인증 부품 인증번호)', '- [ ] 기판 도면 (거버)', '- [ ] 사용 설명서 (경고 문구, 정격 입력, 사용 온도)', '- [ ] 명판 시안 (모델명, 정격, 제조자, KC 마크 자리)', `- [ ] 펌웨어 버전 (${dev.device_name || ''})`, '');
  if (hw) L.push('## 부록: 회로 요약', '', `- 부품 ${hw.hw.comps.length}개, 기판 ${hw.boards.length}장 (${hw.boards.map((b) => `${b.name} ${b.layout.size.join('×')} mm`).join(', ')})`, ...hw.hw.blocks.map((b) => `- ${b.name}: ${b.refs.map((c) => c.ref).join(', ')}`), '');
  return L.join('\n');
}
