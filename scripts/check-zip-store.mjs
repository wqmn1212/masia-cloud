// 서류함 ZIP 검산: CRC32 표준값, 한글 파일 이름(UTF-8 플래그), 같은 이름 피하기, 중앙 디렉터리로 다시 읽은 내용이 넣은 내용과 같은지.
// 실행: npm run check:zip-store
import assert from 'node:assert/strict';
import { crc32, makeZip, safeName, uniquePaths } from '../src/lib/zipStore.js';

const enc = new TextEncoder();
assert.equal(crc32(enc.encode('123456789')), 0xcbf43926, 'CRC32 표준 검사값');
assert.equal(crc32(new Uint8Array()), 0);

assert.equal(safeName('테이블 상판 1200×600 / 재주문: "예시"'), '테이블 상판 1200×600 _ 재주문_ _예시_');
assert.equal(safeName(''), '이름 없음');
assert.deepEqual(uniquePaths(['a/인보이스.pdf', 'a/인보이스.pdf', 'a/인보이스.PDF', 'b/인보이스.pdf', 'a/메모']), ['a/인보이스.pdf', 'a/인보이스 (2).pdf', 'a/인보이스 (3).PDF', 'b/인보이스.pdf', 'a/메모']);

const files = [
  { name: '휴대용 선풍기/인보이스 (CI).pdf', data: enc.encode('%PDF-1.7 예시'), date: new Date(2026, 9, 28, 14, 30, 10) },
  { name: '휴대용 선풍기/사진.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2]) },
  { name: '빈 파일.txt', data: new Uint8Array() },
];
const zip = makeZip(files);
const v = new DataView(zip.buffer);
// 끝 레코드 → 중앙 디렉터리 → 각 로컬 헤더를 따라가 다시 읽는다
const end = zip.length - 22;
assert.equal(v.getUint32(end, true), 0x06054b50);
const count = v.getUint16(end + 10, true);
let c = v.getUint32(end + 16, true);
assert.equal(count, 3);
assert.equal(v.getUint32(end + 12, true), end - c, '중앙 디렉터리 크기');
const dec = new TextDecoder();
for (let i = 0; i < count; i++) {
  assert.equal(v.getUint32(c, true), 0x02014b50);
  assert.equal(v.getUint16(c + 8, true) & 0x0800, 0x0800, 'UTF-8 이름 표시');
  assert.equal(v.getUint16(c + 10, true), 0, '압축 안 함');
  const crc = v.getUint32(c + 16, true), size = v.getUint32(c + 20, true), nameLen = v.getUint16(c + 28, true), local = v.getUint32(c + 42, true);
  const name = dec.decode(zip.subarray(c + 46, c + 46 + nameLen));
  assert.equal(name, files[i].name);
  assert.equal(v.getUint32(local, true), 0x04034b50);
  assert.equal(v.getUint16(local + 26, true), nameLen);
  const data = zip.subarray(local + 30 + nameLen, local + 30 + nameLen + size);
  assert.deepEqual([...data], [...files[i].data], `${name} 내용`);
  assert.equal(crc32(data), crc);
  c += 46 + nameLen;
}
// 날짜: 2026-10-28 14:30:10 → DOS 형식
const d = v.getUint16(v.getUint32(end + 16, true) + 14, true), t = v.getUint16(v.getUint32(end + 16, true) + 12, true);
assert.deepEqual([(d >> 9) + 1980, (d >> 5) & 15, d & 31, t >> 11, (t >> 5) & 63, (t & 31) * 2], [2026, 10, 28, 14, 30, 10]);

console.log('zip-store: 서류함 ZIP 검산 통과');
