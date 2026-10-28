// AI 비서 답변의 마크다운 표 분리 검산 (remark-gfm 없이 표를 그리기 위함).
// 실행: npm run check:md-tables
import assert from 'node:assert/strict';
import { splitMarkdownTables, splitCells } from '../src/lib/mdTables.js';

const preview = `**정산서 미리보기** — 아직 기록하지 않았습니다.

| 항목 | 종류 | 금액 |
|---|---|---:|
| 해상 운임 (LCL 4.2CBM) | 운임 | 588,000원 |
| 관세 (8%) | 관세 | **698,000원** |
| 빈 칸 | |

- 부가세 제외 합계: **1,742,000원**`;
const segs = splitMarkdownTables(preview);
assert.deepEqual(segs.map((s) => s.type), ['md', 'table', 'md']);
const t = segs[1];
assert.deepEqual(t.header, ['항목', '종류', '금액']);
assert.deepEqual(t.align, ['left', 'left', 'right']);
assert.equal(t.rows.length, 3);
assert.deepEqual(t.rows[1], ['관세 (8%)', '관세', '**698,000원**'], '칸 안 굵게 표시는 그대로 넘긴다');
assert.deepEqual(t.rows[2], ['빈 칸', '', ''], '모자란 칸은 빈 문자열로 채운다');
assert.ok(segs[2].text.includes('1,742,000원'));

// 구분선이 없으면 표가 아니다
assert.deepEqual(splitMarkdownTables('| 그냥 | 글 |\n다음 줄').map((s) => s.type), ['md']);
// 가운데 정렬, 앞뒤 파이프 없는 구분선, 이스케이프된 파이프
assert.deepEqual(splitMarkdownTables('A | B\n:---: | ---').map((s) => s.type), ['md'], '첫 줄이 |로 시작하지 않으면 표로 보지 않는다');
const t3 = splitMarkdownTables('| A | B |\n| :---: | --- |\n| x \\| y | z |')[0];
assert.deepEqual(t3.align, ['center', 'left']);
assert.deepEqual(t3.rows[0], ['x | y', 'z']);
assert.deepEqual(splitCells('| a |  b  |'), ['a', 'b']);
// 표가 두 개
assert.deepEqual(splitMarkdownTables('| a |\n|---|\n| 1 |\n\n중간\n\n| b |\n|---|\n| 2 |').map((s) => s.type), ['table', 'md', 'table']);
assert.deepEqual(splitMarkdownTables(''), []);

console.log('md-tables: 모든 검산 통과');
