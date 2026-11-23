import fs from 'node:fs';
const SRC = new URL('../../src/', import.meta.url);
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    const base = new URL(spec.slice(2), SRC);
    const hit = ['', '.js', '.jsx', '/index.js'].map((x) => new URL(base.href + x)).find((u) => fs.existsSync(u) && fs.statSync(u).isFile());
    return { url: (hit || base).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.endsWith('.json')) return { format: 'module', source: `export default ${fs.readFileSync(new URL(url), 'utf8')};`, shortCircuit: true };
  return next(url, ctx);
}
