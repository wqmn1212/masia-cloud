// npm:@base44/sdk@* 를 scripts/fnmock/mocksdk.mjs 로 돌린다. 그 밖의 npm:패키지@버전 은 설치된 node_modules 패키지로.
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('npm:@base44/sdk')) return { url: new URL('./mocksdk.mjs', import.meta.url).href, shortCircuit: true };
  if (spec.startsWith('npm:')) return next(spec.slice(4).replace(/@[^@/]+$/, ''), ctx);
  return next(spec, ctx);
}
