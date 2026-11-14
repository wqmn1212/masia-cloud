import { createClientFromRequest } from 'npm:@base44/sdk@0.8.59';
import { leadRows, cardFileRows, uploadRows, moldRows, bomRows, circuitRows, projectRows, conceptRows, filterArchive, refsOf, isPublicRef } from '../../shared/designArchive.ts';

// 설계 자료실 — 이지스로 들어온 도면·시안·시뮬레이터 자료를 관리자가 한곳에서 본다.
// list         : 대표(master)는 모든 팀, 팀 관리자(service)는 자기 팀 자료 목록
// sign         : 목록에 있는 파일만 10분짜리 열기 주소로
// store_upload : 금형 사전 검토 등 화면 안에서만 계산하던 도구에 올린 파일을 서버에 보관 (고객·팀원 모두)
const LIMIT = 300;
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

async function collect(svc, tenantId) {
  const q = tenantId ? { tenant_id: tenantId } : null;
  const get = (name, n = LIMIT) => (q ? svc.entities[name].filter(q, '-created_date', n) : svc.entities[name].list('-created_date', n)).catch(() => []);
  const [leads, attachments, uploads, molds, boms, circuits, projects, concepts] = await Promise.all([
    get('ManufacturingLead'), get('CardAttachment', 1000), get('DesignUpload'), get('MoldReview'), get('BomItem', 1500),
    get('CircuitDesign'), get('ProtoProject'), get('ProtoConcept'),
  ]);
  const cardIds = [...new Set(attachments.map((a) => a.card_id).filter(Boolean))];
  const cards = {};
  if (cardIds.length) {
    const list = await svc.entities.TaskCard.filter({ id: { $in: cardIds.slice(0, 500) } }, '-created_date', 500).catch(() => []);
    for (const c of list) cards[c.id] = c;
  }
  return [
    ...leads.flatMap(leadRows), ...cardFileRows(attachments, cards), ...uploadRows(uploads), ...moldRows(molds),
    ...bomRows(boms), ...circuitRows(circuits), ...projects.flatMap(projectRows), ...conceptRows(concepts),
  ].filter((r) => !tenantId || r.tenant_id === tenantId);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = str(body.action, 20) || 'list';

    if (action === 'store_upload') {
      if (!user.tenant_id || !['master', 'service', 'sub', 'client'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const uri = str(body.file_uri, 600);
      const name = str(body.file_name, 200);
      if (!uri || !name || isPublicRef(uri)) return Response.json({ error: '보관할 파일 정보가 없습니다.' }, { status: 400 });
      const size = Math.max(0, Math.round(num(body.size) || 0));
      // 같은 사람이 같은 파일을 10분 안에 다시 올리면 하나로
      const recent = await svc.entities.DesignUpload.filter({ tenant_id: user.tenant_id, uploaded_by_email: user.email || '', file_name: name }, '-created_date', 5).catch(() => []);
      const dup = recent.find((u) => u.size === size && Date.now() - new Date(u.created_date).getTime() < 10 * 60 * 1000);
      const s = body.summary && typeof body.summary === 'object' ? body.summary : {};
      const data = {
        source: ['mold_review'].includes(body.source) ? body.source : 'other',
        part_name: str(body.part_name, 120),
        summary: {
          material: str(s.material, 60), size_mm: Array.isArray(s.size_mm) ? s.size_mm.slice(0, 3).map(num).filter((v) => v != null) : [],
          weight_g: num(s.weight_g), nominal_wall_mm: num(s.nominal_wall_mm), high_count: num(s.high_count), caution_count: num(s.caution_count),
        },
      };
      if (dup) {
        await svc.entities.DesignUpload.update(dup.id, data);
        return Response.json({ id: dup.id, reused: true });
      }
      const rec = await svc.entities.DesignUpload.create({
        ...data, tenant_id: user.tenant_id, file_name: name, file_uri: uri, size,
        uploaded_by_name: str(user.full_name, 80) || str(user.email, 120), uploaded_by_email: str(user.email, 120), account_tier: user.account_tier,
      });
      return Response.json({ id: rec.id });
    }

    if (!['master', 'service'].includes(user.account_tier)) return Response.json({ error: '대표·팀 관리자만 볼 수 있습니다.' }, { status: 403 });
    const scope = user.account_tier === 'master' ? (str(body.tenant_id, 80) || '') : user.tenant_id;
    if (!scope && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await collect(svc, scope);

    if (action === 'sign') {
      const ref = str(body.ref, 800);
      if (!ref || !refsOf(rows).has(ref)) return Response.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
      if (isPublicRef(ref)) return Response.json({ url: ref });
      const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: ref, expires_in: 600 });
      return Response.json({ url: signed_url });
    }

    const tenants = user.account_tier === 'master' ? await svc.entities.Tenant.list('name', 500).catch(() => []) : [];
    const tenantNames = Object.fromEntries(tenants.map((t) => [t.id, t.name || '']));
    const { items, counts, total } = filterArchive(rows, { kind: str(body.kind, 20), q: str(body.q, 100), tenantNames });
    return Response.json({
      items: items.slice(0, 500), counts, total,
      tenants: tenants.filter((t) => !t.is_demo).map((t) => ({ id: t.id, name: t.name || t.slug || t.id })),
      scope: scope || 'all',
    });
  } catch (e) {
    return Response.json({ error: e?.message || '처리하지 못했습니다.' }, { status: 500 });
  }
}
