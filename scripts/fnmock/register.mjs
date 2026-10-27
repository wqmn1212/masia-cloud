// 서버 함수(base44/functions)를 Node 에서 돌리기 위한 준비: npm:@base44/sdk 를 메모리 가짜로 바꾸고 Deno 전역을 흉내 낸다.
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);
globalThis.Deno = { env: { get: () => 'https://app.example' }, resolveDns: async () => ['93.184.216.34'] };
