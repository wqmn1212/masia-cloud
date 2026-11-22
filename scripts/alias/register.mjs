// 화면 코드(src)를 Node 에서 검산하기 위한 준비: '@/…' 경로를 src/ 로 풀고, .json 은 모듈로 읽는다.
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);
