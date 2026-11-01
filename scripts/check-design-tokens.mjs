// 디자인 시스템 검사: 앱 화면은 글자 역할(micro·caption·label·body·title)과 의미 색 토큰만 쓴다.
// - 원색 팔레트(amber·red·emerald 등) 대신 warning · destructive · success · primary · chart-4 · muted
// - 임의 px 작은 글자(text-[10px] 등)·text-xs/sm/lg 대신 글자 역할
// 공개 마케팅 페이지(랜딩 전용 팔레트·타이포)와 가이드 예시 화면의 글자 크기(미니어처)는 예외.
// 실행: npm run check:design-tokens
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;
const MARKETING = /components\/(landing|cloud|pricing|portfolio)\/|pages\/(Landing|Cloud|Pricing|About|PortfolioDetail|PortfolioList)\.jsx$/;
const MOCK = /Mocks?[A-Z]?\.jsx$|mockKit\.jsx$|GuideMocks\.jsx$/;
const RULES = [
  { name: '원색 팔레트 → 의미 색 토큰', re: /(?<![\w-])(?:[a-z0-9]+:)*(?:text|bg|border|ring|divide|from|to|via|fill|stroke)-(?:red|rose|pink|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}(?![\w-])/g },
  { name: '클래스 안 hex 색 → 토큰', re: /(?<![\w-])(?:text|bg|border)-\[#[0-9a-fA-F]{3,8}\]/g },
  { name: '임의 px 작은 글자 → text-micro·caption', re: /(?<![\w-])(?:[a-z0-9]+:)*text-\[(?:9|10|11|11\.5|12|12\.5|13|13\.5|14|14\.5)px\]/g, sizes: true },
  { name: 'text-xs·sm·lg → 글자 역할', re: /(?<![\w-])(?:[a-z0-9]+:)*text-(?:xs|sm|lg)(?![\w-])/g, sizes: true },
];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const problems = [];
for (const file of walk(ROOT)) {
  if (!/\.(jsx?|tsx?)$/.test(file)) continue;
  const rel = path.relative(ROOT, file);
  if (MARKETING.test(rel)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.sizes && MOCK.test(rel)) continue;
      for (const m of line.matchAll(r.re)) problems.push(`${rel}:${i + 1}  ${m[0]}  (${r.name})`);
    }
  });
}
if (problems.length) {
  console.error(problems.slice(0, 60).join('\n'));
  console.error(`\n디자인 시스템과 다른 곳 ${problems.length}개`);
  process.exit(1);
}
console.log('design-tokens ok');
