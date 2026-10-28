// 검산용 가짜 Base44 SDK: globalThis.__db(엔티티별 배열)·__user·__llm 을 쓴다
let seq = 0;
const match = (r, q) => Object.entries(q || {}).every(([k, v]) => (v && typeof v === 'object' && '$in' in v ? v.$in.includes(r[k]) : r[k] === v));
const sortBy = (rows, sort) => { if (!sort) return rows; const d = sort.startsWith('-'); const f = sort.replace(/^-/, ''); return [...rows].sort((a, b) => ((a[f] ?? '') > (b[f] ?? '') ? 1 : (a[f] ?? '') < (b[f] ?? '') ? -1 : 0) * (d ? -1 : 1)); };
const entity = (name) => ({
  filter: async (q, sort, limit) => sortBy((globalThis.__db[name] ||= []).filter((r) => match(r, q)), sort).slice(0, limit || 1000),
  get: async (id) => { const r = (globalThis.__db[name] || []).find((x) => x.id === id); if (!r) throw new Error('not found'); return r; },
  create: async (d) => { const r = { id: `${name}-${++seq}`, created_date: new Date().toISOString(), ...d }; (globalThis.__db[name] ||= []).push(r); return r; },
  update: async (id, d) => { const r = globalThis.__db[name].find((x) => x.id === id); Object.assign(r, d); return r; },
  bulkCreate: async (rows) => Promise.all(rows.map((d) => entity(name).create(d))),
  delete: async (id) => { globalThis.__db[name] = (globalThis.__db[name] || []).filter((x) => x.id !== id); return {}; },
});
export function createClientFromRequest() {
  const entities = new Proxy({}, { get: (_, n) => entity(n) });
  return {
    auth: { me: async () => globalThis.__user },
    users: { inviteUser: async (email, role) => { (globalThis.__invites ||= []).push({ email, role }); return {}; } },
    entities,
    asServiceRole: { entities, integrations: { Core: { InvokeLLM: async (a) => globalThis.__llm(a), UploadPrivateFile: async ({ file }) => ({ file_uri: `private://${file.name}` }), SendEmail: async (m) => { (globalThis.__emails ||= []).push(m); return {}; } } } },
  };
}
