// 양산 준비 검산: 원가 추정 · 설계 확정/변경(ECO) 비교 · 미팅 결과 요약 · 인증 준비 자료
// 실행: npm run check:production
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from '../src/lib/hw/kicadLib.data.js';
import { buildHwPackage } from '../src/lib/hw/exportHw.js';
import { estimateCost } from '../src/lib/devkit/cost.js';
import { snapshotOf, diffDesign, impactOf } from '../src/lib/devkit/freeze.js';
import { meetingReport, meetingSteps, certChecklist } from '../src/lib/devkit/meetingReport.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`✓ ${name}`); } else { fails.push(name); console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`); } };

const { dev, title } = JSON.parse(fs.readFileSync(path.join(here, 'pcb-sample.json'), 'utf8'));
const summary = { template: 'round_lamp', parts: [
  { id: 'front_housing', name: '앞 하우징', material: 'ABS', mold: true, weight: 62.4, size: [150, 150, 16], slides: 0, hi: 1 },
  { id: 'rear_housing', name: '뒤 하우징', material: 'ABS', mold: true, weight: 58.1, size: [150, 150, 14], slides: 0, hi: 1 },
  { id: 'base_shell', name: '받침대 하우징', material: 'ABS', mold: true, weight: 31.2, size: [66, 70, 36], slides: 4, hi: 1 },
  { id: 'diffuser_f', name: '앞 확산판', material: 'PC 확산', mold: true, weight: 18.5, size: [128, 128, 2], slides: 0, hi: 0 },
  { id: 'pcb', name: '제어 기판', material: 'FR-4 1.6T', mold: false, weight: 8 },
] };
const devM = { ...dev, mold_design: { ...dev.mold_design, summary } };
const project = { id: 'p1', title, files: [] };

// 1. 원가
const hw = buildHwPackage(devM, lib, { title, seed: 'p1' });
const est = estimateCost({ moldSummary: summary, hwPkg: hw });
check(`원가: 사출 ${est.moldRows.length}개 금형비 합 ${est.tooling.toLocaleString()}원, 기판 ${est.boards.length}장, 개당 생산비 ${est.unit.toLocaleString()}원`, est.moldRows.length === 4 && est.boards.length === 2 && est.tooling > 5e6 && est.unit > 3000 && est.unit < 60000, JSON.stringify(est.moldRows.map((r) => [r.name, r.mold, r.unit])));
check('원가: 슬라이드 4개 받침대 금형이 슬라이드 없는 같은 크기보다 비싸다', (() => { const a = estimateCost({ moldSummary: { parts: [{ ...summary.parts[2], slides: 0 }] } }).tooling; const b = estimateCost({ moldSummary: { parts: [summary.parts[2]] } }).tooling; return b - a >= 4 * 800000; })());
check('원가: 수량이 늘면 개당 합계(금형비 나눔)가 줄어든다', est.byQty.every((r, i, a) => i === 0 || r.total_per_unit < a[i - 1].total_per_unit) && est.byQty[0].unit === est.byQty[3].unit);
check('원가: 사출 요약이 없으면 무엇이 빠졌는지 알려 준다', estimateCost({ moldSummary: null, hwPkg: hw }).missing.length === 1);

// 2. 설계 확정·변경
const snap = snapshotOf(devM);
check('확정: 요약·기록은 빼고 설계 결정만 담는다', !snap.mold_design.summary && !('meeting' in snap) && snap.features.length === dev.features.length);
check('확정 직후 바뀐 점 0건', diffDesign(snap, devM).length === 0);
const changed = { ...devM, mcu: 'esp32c3', mold_design: { ...devM.mold_design, params: { ...devM.mold_design.params, gap: 6, draft: 3 } }, features: [...devM.features.slice(1), { id: 'new1', kind: 'buzzer', name: '알림 부저' }] };
const diff = diffDesign(snap, changed);
const text = diff.map((d) => d.text).join(' | ');
check(`변경: MCU·외장 치수 2개·기능 추가·삭제를 찾는다 (${diff.length}건)`, /MCU ESP32-S3-WROOM-1 → ESP32-C3-WROOM-02/.test(text) && /4 → 6/.test(text) && /2 → 3/.test(text) && /추가: 알림 부저/.test(text) && /삭제: 전면 기상등/.test(text), text);
const impact = impactOf(diff);
check('변경 영향: 금형 견적·회로·펌웨어 다시', impact.some((x) => /금형/.test(x)) && impact.some((x) => /회로도/.test(x)) && impact.some((x) => /펌웨어/.test(x)), impact.join(' / '));

// 3. 미팅 요약·인증 자료
const steps = meetingSteps(project, devM, { concept: { version_no: 2 } });
check('미팅 단계 7개, 컨셉·금형용 3D·기능 완료로 본다', steps.length === 7 && steps.filter((s) => s.done).map((s) => s.key).join(',').startsWith('concept,cad,features'));
const rep = meetingReport(project, { ...devM, freeze: { version: 1, at: '2026-11-15T00:00:00Z', by: '검산', snapshot: snap } }, { concept: { version_no: 2 }, hw, cost: est, attendees: '김 대표, 이 팀장', decisions: '갭 6 mm 로 늘린다', actions: '금형 견적 3곳 요청\n기판 시제품 5장 주문' });
check('미팅 요약: 외장·핀·규칙·기판·원가·확정본·결정·할 일 표가 들어간다', ['## 외장', '## 기능과 핀', '## 동작 규칙', '## 회로·기판', '## 원가 추정', '## 설계 확정', '## 결정 사항', '- [ ] 기판 시제품 5장 주문'].every((k) => rep.includes(k)), rep.slice(0, 300));
const cert = certChecklist(project, devM, { hw });
check('인증 자료: 무선(모듈)·전자파·전기 안전(어댑터·조명 차단)·제출 목록', /ESP32-S3-WROOM-1/.test(cert) && /전자파 적합등록/.test(cert) && /12 V 직류 어댑터/.test(cert) && /85 °C 하드웨어 차단/.test(cert) && /- \[ \] 회로도/.test(cert));

// 4. 실물 검증 체크리스트 · LCSC 번호 직접 넣기
{
  const { bringupItems, bringupSummary } = await import('../src/lib/devkit/bringup.js');
  const items = bringupItems(devM);
  check(`실물 검증: 전원·펌웨어·블루투스·기능 ${dev.features.length}개·조립·발열 항목 (${items.length}개), 12 V 제품은 5 V 레일·기판 연결 항목 포함`, items.filter((i) => i.group === '기능').length === dev.features.length && items.some((i) => i.id === 'pwr_5v') && items.some((i) => i.id === 'link') && new Set(items.map((i) => i.id)).size === items.length);
  const withRes = { ...devM, bringup: { items: { pwr_3v3: { result: 'pass', value: '3.31' }, ble_range: { result: 'fail', note: '2 m 에서 끊김 (금속 힌지)' } } } };
  const bs = bringupSummary(withRes);
  check('실물 검증: 통과 1 · 불합격 1 을 세고, 불합격이 미팅 요약에 들어간다', bs.pass === 1 && bs.fail === 1 && /불합격: .*2 m 에서 끊김/.test(meetingReport(project, withRes, { hw })));
  const { lcscKey } = await import('../src/lib/hw/netlist.js');
  const noNum = hw.hw.comps.find((c) => c.part.fp && !c.part.lcsc && c.part.cat !== 'H');
  const hw2 = buildHwPackage({ ...devM, hw: { ...devM.hw, lcsc: { [lcscKey(noNum.part)]: 'C123456', bad: 'xyz' } } }, lib, { title, seed: 'p1' });
  const same = hw2.hw.comps.filter((c) => lcscKey(c.part) === lcscKey(noNum.part));
  check(`LCSC 번호 직접 넣기: 같은 부품 ${same.length}개에 적용되고 JLCPCB 부품표에 나온다`, same.length > 0 && same.every((c) => c.part.lcsc === 'C123456' && c.part.lcsc_user) && hw2.bom.some((r) => r.lcsc === 'C123456'));
}

// 5. 공장 견적 → 원가
{
  const q = { factory: '东莞精模', date: '2026-11-20', currency: 'CNY', fx: 195, parts: { '앞 하우징': { mold: 42000, unit: 3.2, cavities: 2 }, '뒤 하우징': { mold: '', unit: '' } } };
  const e2 = estimateCost({ moldSummary: summary, hwPkg: hw, quotes: q });
  const front = e2.moldRows.find((r) => r.name === '앞 하우징'), rear = e2.moldRows.find((r) => r.name === '뒤 하우징');
  check('견적 반영: 넣은 부품만 견적(42,000元 × 195 = 8,190,000원, 캐비티 2), 비운 부품은 추정 그대로', front.mold === 8190000 && front.unit === 624 && front.cavities === 2 && front.source.mold === 'quote' && rear.source.mold === 'estimate' && rear.mold === est.moldRows.find((r) => r.name === '뒤 하우징').mold);
  check('견적 반영: 금형비 합·수량별 합계가 바뀌고, 추정 대비 차이를 알려 준다', e2.tooling === est.tooling - front.est.mold + 8190000 && e2.quote.quoted === 1 && e2.quote.tooling_diff === 8190000 - front.est.mold && e2.byQty[0].total !== est.byQty[0].total);
  check('견적 반영: 환율이 0 이면 견적을 쓰지 않는다', estimateCost({ moldSummary: summary, quotes: { ...q, fx: 0 } }).quote === null);
}

// 6. 변경 요청서: 승인 권한·후속 할 일·고객 통지서
{
  const { canApproveEco, ecoTasks, ecoNotice } = await import('../src/lib/devkit/freeze.js');
  check('ECO 승인: 대표·팀 관리자만 (팀원·계정 없음은 불가)', canApproveEco({ account_tier: 'master' }) && canApproveEco({ account_tier: 'service' }) && !canApproveEco({ account_tier: 'sub' }) && !canApproveEco(null));
  const eco = { no: 'ECO-001', by: '검산', at: '2026-11-15T00:00:00Z', reason: '금형 업체 제안으로 구배 2° → 3°', from_version: 1, changes: diff, impact };
  const tasks = ecoTasks(eco);
  check(`ECO 후속 할 일 ${tasks.length}개: 제목에 번호, 중국어 제목, 설명에 변경 이유·바뀐 점`, tasks.length === impact.length && tasks.every((t) => t.title.startsWith('[ECO-001]') && /[一-鿿]/.test(t.title_cn) && t.description.includes('구배 2° → 3°')));
  const notice = ecoNotice(project, eco);
  check('고객 통지서: 제품·기준 확정본·변경 이유·바뀌는 내용·동의 칸', /설계 변경 통지서 ECO-001/.test(notice) && /설계 확정본 v1/.test(notice) && /4 → 6/.test(notice) && /- \[ \] 위 변경에 동의합니다/.test(notice));
}

// 7. 출하 검사
{
  const { factoryPlan, parseSelftest, judgeAuto, verdictOf, nextSerial, unitRecord } = await import('../src/lib/devkit/factoryTest.js');
  const plan = factoryPlan(devM);
  check(`출하 검사 계획: 자동 ${plan.auto.length} · 누르기 ${plan.press.length} · 출력 ${plan.outputs.length} (시계·온도 2개·버튼·다이얼·조명 2개 포함, 글은 한·중)`, plan.auto.some((a) => a.id === 'rtc') && plan.auto.filter((a) => /°C/.test(a.label[0])).length === 2 && plan.press.length === 2 && plan.outputs.filter((o) => o.kind === 'light').length === 2 && [...plan.auto, ...plan.press, ...plan.outputs].every((x) => x.label[0] && /[一-鿿]/.test(x.label[1])));
  const good = { selftest: 1, name: plan.device_name, fw: '0.2.0', mac: 'aa:bb:cc:dd:ee:ff', chip: 'ESP32-S3', rtc: 1 };
  plan.auto.forEach((a) => { if (/^in\d+$/.test(a.id)) good[a.id] = /°C/.test(a.label[0]) ? 248 : 0; });
  const line = JSON.stringify(good);
  const rows = judgeAuto(plan, parseSelftest(line));
  check('출하 검사: 정상 기기의 selftest 줄은 자동 항목이 모두 통과, 다른 줄은 무시', rows.every((r) => r.ok) && parseSelftest('AEGIS RENIGHT 0.2.0') === null, rows.filter((r) => !r.ok).map((r) => r.id).join(','));
  const tempId = plan.auto.find((a) => /°C/.test(a.label[0])).id;
  const bad = judgeAuto(plan, { ...good, [tempId]: -32768, rtc: 0 });
  check('출하 검사: 온도 센서가 빠지거나 시계가 응답 없으면 불합격', bad.find((r) => r.id === tempId).ok === false && bad.find((r) => r.id === 'rtc').ok === false);
  const all = Object.fromEntries([...plan.auto, ...plan.press, ...plan.outputs].map((x) => [x.id, true]));
  check('출하 검사 판정: 전부 통과 PASS, 하나 불량 FAIL, 덜 하면 INCOMPLETE', verdictOf(plan, all) === 'PASS' && verdictOf(plan, { ...all, [plan.outputs[0].id]: false }) === 'FAIL' && verdictOf(plan, { [plan.auto[0].id]: true }) === 'INCOMPLETE');
  const d = new Date(2026, 10, 15);
  check('일련번호: SN-261115-001 → 002, 날이 바뀌면 001 부터', nextSerial('SN', '', d) === 'SN-261115-001' && nextSerial('SN', 'SN-261115-001', d) === 'SN-261115-002' && nextSerial('SN', 'SN-261114-037', d) === 'SN-261115-001');
  const rec = unitRecord({ project: { tenant_id: 't', card_id: 'c' }, plan, serial: 'SN-261115-001', lot: 'L1', json: good, results: { ...all, [plan.outputs[0].id]: false }, values: {}, inspector: '검사자' });
  check('출하 검사 기록: 양산 시리얼 형식(카드·일련번호·판정·불합격 항목·MAC)', rec.card_id === 'c' && rec.serial === 'SN-261115-001' && rec.verdict === 'FAIL' && rec.failed_items.length === 1 && rec.checks.mac === 'aa:bb:cc:dd:ee:ff' && /불합격/.test(rec.fail_note));
}

console.log(`\n${pass}개 검산 통과${fails.length ? `, ${fails.length}개 실패` : ''}`);
if (fails.length) process.exit(1);
