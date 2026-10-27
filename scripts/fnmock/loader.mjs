// npm:@base44/sdk@* 를 scripts/fnmock/mocksdk.mjs 로 돌린다
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('npm:@base44/sdk')) return { url: new URL('./mocksdk.mjs', import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
