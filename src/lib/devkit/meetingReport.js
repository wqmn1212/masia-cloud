// 미팅 결과 요약과 인증 준비 자료 (마크다운). 화면에서 내려받고 시제품 파일에 저장한다.
import { FEATURE_KINDS, MCUS, pinPlan, pinProblems } from './features.js';
import { describeRule, validRules } from './rules.js';
import { TEMPLATES } from '../cad/catalog.js';
import { diffDesign } from './freeze.js';
import { bringupSummary } from './bringup.js';

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
  if (cost && !cost.missing.length) L.push('## 원가 추정 (초기)', '', '| 수량 | 개당 합계 | 총액 |', '|---|---|---|', ...cost.byQty.map((r) => `| ${r.qty.toLocaleString()} | ${won(r.total_per_unit)} | ${won(r.total)} |`), `- 금형비 합 ${won(cost.tooling)} (${cost.quote ? `${cost.quote.factory || '공장'} 견적 ${cost.quote.quoted}/${cost.quote.of}개 부품 반영${cost.quote.date ? `, ${cost.quote.date}` : ''}` : '추정, 공장 견적으로 바꿀 것'})`, '');
  if (dev.freeze) {
    const ch = diffDesign(dev.freeze.snapshot, dev);
    L.push('## 설계 확정', '', `- 확정본 v${dev.freeze.version} (${d10(dev.freeze.at)}, ${dev.freeze.by})${ch.length ? ` · 이후 바뀐 점 ${ch.length}건` : ''}`, ...ch.slice(0, 15).map((c) => `  - [${c.area}] ${c.text}`), '');
  }
  if (dev.bringup?.items && Object.keys(dev.bringup.items).length) {
    const b = bringupSummary(dev);
    L.push('## 실물 시제품 검증', '', `- ${b.total}개 항목 중 통과 ${b.pass} · 불합격 ${b.fail} · 남음 ${b.open}`, ...b.failed.map((x) => `- 불합격: ${x.text}${x.note ? ` — ${x.note}` : ''}`), '');
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
  // 무선 시험 모드: 펌웨어에 들어 있는 시리얼 명령 (USB 로만 쓸 수 있다)
  L.push('## 5. 무선 시험 모드 (시험 기관용)', '', '펌웨어에 시험용 송신 모드가 들어 있습니다. USB 시리얼(115200)로 아래 명령을 보냅니다.', '',
    '| 명령 | 동작 |', '|---|---|', '| `rftest 0` | 2402 MHz (가장 낮은 채널) 로 계속 송신 |', '| `rftest 19` | 2440 MHz (가운데) |', '| `rftest 39` | 2480 MHz (가장 높은 채널) |', '| `rftest 19 9` | 가운데 채널, 출력 +9 dBm (둘째 숫자 = 출력: 9·6·3·0·-6·-12) |', '| `rftest off` | 멈추고 다시 시작 (평소 동작으로) |', '',
    `- 변조: BLE 직접 시험 모드(DTM) PRBS9, 37바이트 패킷. 무변조 반송파가 필요하면 시험 기관과 협의합니다.`, `- ${/esp32$/.test(dev.mcu || '') ? '이 제품의 칩(ESP32 클래식)은 이 명령을 지원하지 않습니다. 시험 기관의 시험 도구(Espressif RF Test Tool)를 써야 합니다.' : '시험 중에는 평소 동작(버튼·조명)이 멈춥니다.'}`, '');
  L.push('## 6. 사용 설명서 초안', '', ...userManualDraft(project, dev).split('\n'), '');
  L.push('## 7. 명판 시안', '', ...nameplateDraft(project, dev).split('\n'), '');
  if (hw) L.push('## 부록: 회로 요약', '', `- 부품 ${hw.hw.comps.length}개, 기판 ${hw.boards.length}장 (${hw.boards.map((b) => `${b.name} ${b.layout.size.join('×')} mm`).join(', ')})`, ...hw.hw.blocks.map((b) => `- ${b.name}: ${b.refs.map((c) => c.ref).join(', ')}`), '');
  return L.join('\n');
}

/** 사용 설명서 초안 (인증 제출·포장용). 설계 정보에서 채우고, 빈칸(□)은 사람이 채운다 */
export function userManualDraft(project, dev) {
  const f = dev.features || [];
  const v = Number(dev.supply_v) || 5;
  const has = (k) => f.some((x) => x.kind === k);
  const L = [`**제품명**: ${project.title} (모델 ${dev.device_name || '□'})`, '',
    '**정격**', `- 입력: DC ${v} V ${v > 6 ? '(전용 어댑터, KC 인증 제품)' : '(USB Type-C)'} · 소비전력 □ W`, `- 무선: Bluetooth Low Energy 2402~2480 MHz (${MCUS[dev.mcu]?.module || '□'})`, '- 사용 온도: 0~40 °C, 실내용', '',
    '**구성품**: 본체 1, ' + (v > 6 ? `${v} V 어댑터 1, ` : 'USB 케이블 1, ') + '사용 설명서 1', '',
    '**사용 방법**',
    ...f.filter((x) => ['button', 'switch', 'encoder'].includes(x.kind)).map((x) => `- ${x.name}: ${x.kind === 'encoder' ? '돌리면 밝기, 짧게 누르면 켜기·끄기, 길게(0.8초) 누르면 켜는 면 바꾸기' : x.kind === 'switch' ? '켜고 끄는 스위치' : '누르는 버튼 (동작은 앱 안내 참고)'}`),
    '- 앱 연결: 휴대폰 블루투스를 켜고 앱에서 장치를 고릅니다.', ...(f.some((x) => x.kind === 'display') ? ['- 시각: 앱을 연결하면 자동으로 맞춰집니다.'] : []), '',
    '**안전을 위한 주의**', '- 지정한 전원(정격 입력) 외에는 쓰지 마세요.', '- 물에 닿지 않게 하고, 젖은 손으로 만지지 마세요.', '- 분해·개조하지 마세요.',
    ...(has('light') ? ['- 켜진 조명을 가까이에서 오래 쳐다보지 마세요.', '- 덮개(확산판)를 천·종이로 덮지 마세요. 과열되면 자동으로 꺼집니다.'] : []),
    ...(has('heater') ? ['- 사용 중·직후에는 뜨거운 부분을 만지지 마세요.', '- 어린이 손이 닿지 않는 곳에 두세요.'] : []),
    ...(has('battery') ? ['- 내장 배터리를 꺼내거나 불에 넣지 마세요. 폐기할 때는 지자체 배터리 수거함에 버리세요.'] : []), '',
    '**무선 기기 안내**', '- 해당 무선설비는 운용 중 전파혼신 가능성이 있습니다.', '',
    '**제조·수입**: □ (상호·주소·전화) · 제조국: □ · A/S: □'];
  return L.join('\n');
}

/** 명판(본체 표시) 시안: KC 표시에 들어갈 항목을 글로 정리 */
export function nameplateDraft(project, dev) {
  const v = Number(dev.supply_v) || 5;
  return ['```', `${project.title}`, `모델명: ${dev.device_name || '□'}`, `정격 입력: DC ${v} V ⎓ □ A`, 'KC 인증번호: □ (적합등록·적합인증 받은 뒤 기입)', `무선 모듈: ${MCUS[dev.mcu]?.module || '□'}`, '제조자: □    제조국: □', '제조연월: □', 'A/S: □', '```', '', '- 글자 높이 1.2 mm 이상, 지워지지 않는 방식(레이저·실크·금형 각인)으로 표시합니다.', '- KC 마크는 높이 5 mm 이상.'].join('\n');
}
