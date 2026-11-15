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

console.log(`\n${pass}개 검산 통과${fails.length ? `, ${fails.length}개 실패` : ''}`);
if (fails.length) process.exit(1);
