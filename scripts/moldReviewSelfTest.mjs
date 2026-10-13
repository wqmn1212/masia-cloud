// 금형 사전 검토 엔진 자체 시험 — 엔진을 고친 뒤 반드시 돌린다.
//   node scripts/moldReviewSelfTest.mjs
// 설계값을 아는 샘플 하우징(src/lib/moldReview/sampleHousing.js)으로 측정값을 확인하고,
// 같은 부품을 90° 돌려도 같은 결과가 나오는지 본다.
import { makeSampleHousing } from '../src/lib/moldReview/sampleHousing.js';
import { analyzeMold } from '../src/lib/moldReview/analyzeCore.js';
import { buildMoldReport } from '../src/lib/moldReview/report.js';

let failed = 0;
const check = (label, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  → ${detail}` : ''}`);
};
const near = (v, target, tol) => Math.abs(v - target) <= tol;
const median = (arr) => {
  const v = arr.slice().sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : NaN;
};

function run(label, positions, indices, toOriginal) {
  console.log(`\n[${label}]`);
  const r = analyzeMold(positions, indices, {});
  const { V, F } = r.mesh;
  const { draft, thick } = r.face;
  // 결과 메시의 면을 원래(샘플 설계) 좌표로 되돌려 고른다
  const pick = (fn) => {
    const out = [];
    for (let t = 0; t < F.length / 3; t++) {
      const i = F[t * 3] * 3;
      const [x, y, z] = toOriginal(V[i], V[i + 1], V[i + 2]);
      if (fn(x, y, z)) out.push(t);
    }
    return out;
  };
  const xWall = pick((x, y, z) => Math.abs(Math.abs(x) - 35 + z * 0.026) < 0.3 && Math.abs(y) < 15 && z > 4 && z < 18 && x < 0);
  const yWall = pick((x, y, z) => Math.abs(Math.abs(y) - 23) < 0.2 && Math.abs(x) < 25 && z > 4 && z < 18 && y < 0);
  const overRib1 = pick((x, y, z) => z > 21.9 && Math.abs(y - 9) < 0.3 && Math.abs(x) < 20);
  const overRib2 = pick((x, y, z) => z > 21.9 && Math.abs(x - 6) < 0.3 && Math.abs(y) < 12);
  const plain = pick((x, y, z) => z > 21.9 && Math.abs(y + 15) < 1 && Math.abs(x) < 20);
  const s = r.summary;
  check('기본 살 두께 2.0mm', near(s.nominal, 2, 0.05), s.nominal.toFixed(2));
  check('X 벽 구배 1.5°', near(median(xWall.map((t) => draft[t])), 1.5, 0.15), median(xWall.map((t) => draft[t])).toFixed(2));
  check('Y 벽 구배 0°', near(median(yWall.map((t) => draft[t])), 0, 0.15), median(yWall.map((t) => draft[t])).toFixed(2));
  check('벽 두께 2.0mm', near(median(yWall.map((t) => thick[t])), 2, 0.1), median(yWall.map((t) => thick[t])).toFixed(2));
  check('두꺼운 리브(2.4) 위 살 두께 ≥ 2.6mm (이론 2.72)', median(overRib1.map((t) => thick[t])) >= 2.6, median(overRib1.map((t) => thick[t])).toFixed(2));
  check('얇은 리브(1.0) 위 살 두께 2.0~2.25mm (이론 2.12)', near(median(overRib2.map((t) => thick[t])), 2.12, 0.13), median(overRib2.map((t) => thick[t])).toFixed(2));
  check('리브 없는 윗면 2.0mm', near(median(plain.map((t) => thick[t])), 2, 0.1), median(plain.map((t) => thick[t])).toFixed(2));
  const uc = r.undercuts;
  check('언더컷 1곳 (측면 창, 슬라이드)', uc.length === 1 && uc[0].type === 'slide', uc.map((u) => `${u.type} ${u.area.toFixed(0)}mm²`).join(', '));
  check('창 언더컷 깊이 ≈ 벽 두께', uc[0] && near(uc[0].depth, 2.1, 0.4), uc[0]?.depth.toFixed(2));
  check('관통 구멍 막음면 ≥ 1', r.parting.shutoffs >= 1, r.parting.shutoffs);
  const g1 = r.gates[0];
  const g1o = g1 && toOriginal(...g1.position);
  check('G1 = 천장 안쪽 핀 게이트', g1 && g1.kind === 'pin' && near(g1o[2], 20, 0.6), g1 && `${g1.kind} @(${g1o.map((v) => v.toFixed(1)).join(', ')})`);
  const plan = r.plans.find((p) => p.id === 'single');
  const weldAt = (fn) => plan.weldGroups.some((w) => fn(...toOriginal(...w.center)));
  check('웰드라인: 윗면 구멍 뒤', weldAt((x, y) => x > 21 && Math.abs(y) < 5));
  check('웰드라인: 측면 창 아래', weldAt((x, y, z) => y > 19 && z < 8 && Math.abs(x) < 8));
  const report = buildMoldReport(r, { materialKey: 'ABS', draftMin: 1 });
  const level = (id) => report.items.find((i) => i.id === id)?.level;
  check('판정: 구배 높음 (Y 벽 0°)', level('draft') === 'hi', level('draft'));
  check('판정: 언더컷 높음', level('undercut') === 'hi', level('undercut'));
  check('판정: 수축 위험 있음', ['hi', 'mid'].includes(level('sink')), level('sink'));
  check('지시서 한/중 생성', report.spec.ko.includes('금형 설계 지시서') && report.spec.zh.includes('模具设计指示书'));
  console.log(`  ${s.nt.toLocaleString()} 삼각형 · ${s.ms}ms · ${JSON.stringify(s.timing)}`);
  return r;
}

const sample = makeSampleHousing();
const a = run('샘플 하우징 (Z 위)', sample.positions, sample.indices, (x, y, z) => [x, y, z]);
check('빼기 방향 Z+', a.pull.label === 'Z+', a.pull.label);
// 같은 부품을 Y 가 위로 오게 돌린다: (x, y, z) → (x, z, -y)
const rotated = new Float32Array(sample.positions.length);
for (let i = 0; i < rotated.length; i += 3) {
  rotated[i] = sample.positions[i];
  rotated[i + 1] = sample.positions[i + 2];
  rotated[i + 2] = -sample.positions[i + 1];
}
const b = run('같은 부품 90° 회전 (Y 위)', rotated, sample.indices, (x, y, z) => [x, -z, y]);
check('빼기 방향 Y+', b.pull.label === 'Y+', b.pull.label);
check('회전해도 두꺼운 면적이 같다 (±10%)', near(b.summary.thickA, a.summary.thickA, a.summary.thickA * 0.1), `${a.summary.thickA.toFixed(0)} / ${b.summary.thickA.toFixed(0)}`);

console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);
