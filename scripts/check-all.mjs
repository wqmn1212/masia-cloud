// 모든 검산(check:*)을 차례로 돌리고 결과를 한 표로 보여 준다. 하나라도 실패하면 종료 코드 1.
// 실행: npm run check  (CI: .github/workflows/checks.yml)
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const only = process.argv.slice(2);
const names = Object.keys(pkg.scripts).filter((k) => k.startsWith('check:') && (!only.length || only.some((o) => k.includes(o))));
const rows = [];
for (const name of names) {
  const t0 = Date.now();
  const r = spawnSync('npm', ['run', '-s', name], { encoding: 'utf8', timeout: 15 * 60 * 1000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const ok = r.status === 0;
  rows.push({ name, ok, sec: Math.round((Date.now() - t0) / 1000), last: out.trim().split('\n').filter(Boolean).pop() || '' });
  console.log(`${ok ? '✓' : '✗'} ${name} (${rows.at(-1).sec}s) ${rows.at(-1).last.slice(0, 100)}`);
  if (!ok) console.log(out.split('\n').filter((l) => /✗|Error|error/.test(l)).slice(0, 12).join('\n'));
}
const bad = rows.filter((r) => !r.ok);
console.log(`\n검산 ${rows.length}종 중 ${rows.length - bad.length}종 통과${bad.length ? `, 실패: ${bad.map((r) => r.name).join(', ')}` : ''}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| 검산 | 결과 | 초 | 마지막 줄 |\n|---|---|---|---|\n${rows.map((r) => `| ${r.name} | ${r.ok ? '통과' : '**실패**'} | ${r.sec} | ${r.last.replace(/\|/g, '/').slice(0, 80)} |`).join('\n')}\n`);
if (bad.length) process.exit(1);
