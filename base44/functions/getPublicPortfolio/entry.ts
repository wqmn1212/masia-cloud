import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 랜딩 공개 포트폴리오 조회 — 비로그인 호출. is_published = true 만 반환하고 내부 필드는 절대 노출하지 않는다.
const ALLOWED_ORIGINS = [
  'https://masiacloud.base44.app',
  'https://masia.cloud',
  'https://www.masia.cloud',
];

const corsHeaders = (req) => {
  const origin = req.headers.get('origin') || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  };
};

const trio = (ko, en, zh) => ({ ko: ko || '', en: en || ko || '', zh: zh || ko || '' });

const toCard = (p) => ({
  slug: p.slug,
  category: p.category,
  sort_order: p.sort_order || 0,
  title: trio(p.title_ko, p.title_en, p.title_zh),
  summary: trio(p.summary_ko, p.summary_en, p.summary_zh),
  thumbnail_url: p.thumbnail_url || '',
  is_featured: !!p.is_featured,
  featured_order: p.featured_order || 0,
  moq: p.moq || '',
  lead_time: p.lead_time || '',
  certifications: Array.isArray(p.certifications) ? p.certifications : [],
  has_spec: Array.isArray(p.spec_files) && p.spec_files.length > 0,
});

const toDetail = (p) => ({
  ...toCard(p),
  body: trio(p.body_ko, p.body_en, p.body_zh),
  images: (Array.isArray(p.images) ? p.images : []).map((im) => ({
    url: im.url || '',
    caption: trio(im.caption_ko, im.caption_en, im.caption_zh),
    order: im.order || 0,
  })),
  videos: (Array.isArray(p.videos) ? p.videos : []).map((v) => ({
    type: v.type || 'UPLOAD',
    url: v.url || '',
    title: trio(v.title_ko, v.title_en, v.title_zh),
    order: v.order || 0,
  })),
  spec_files: (Array.isArray(p.spec_files) ? p.spec_files : []).map((f, index) => ({
    index,
    // 문의 후 제공 자료는 URL 을 내려주지 않는다
    url: f.require_lead ? '' : (f.url || ''),
    label: trio(f.label_ko, f.label_en, f.label_zh),
    lang: f.lang || 'multi',
    size_kb: f.size_kb || 0,
    require_lead: !!f.require_lead,
  })),
});

export default async function (req) {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    let body = {};
    try { body = await req.json(); } catch (_e) { body = {}; }
    const slug = typeof body.slug === 'string' ? body.slug.trim().slice(0, 200) : '';
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 50) : '';

    const svc = createClientFromRequest(req).asServiceRole;

    // 본사 테넌트 결정 — 클라이언트에서 tenant_id 를 받지 않는다
    const hq = await svc.entities.Tenant.filter({ is_hq: true }, 'created_date', 1);
    const tenant = hq[0] || (await svc.entities.Tenant.list('created_date', 1))[0];
    if (!tenant) return Response.json({ items: [], settings: {} }, { headers });

    const query = { tenant_id: tenant.id, is_published: true };
    if (slug) query.slug = slug;
    else if (category) query.category = category;

    const rows = await svc.entities.PortfolioItem.filter(query, 'sort_order', 200);
    const published = rows.filter((p) => p.is_published === true);

    const settingRows = await svc.entities.LandingSetting.filter({ tenant_id: tenant.id }, '-updated_date', 1);
    const setting = settingRows[0] || {};
    const settings = {
      hero_image_url: setting.hero_image_url || '',
      hero_video_url: setting.hero_video_url || '',
      featured_limit: setting.featured_limit || 6,
    };

    if (slug) {
      const item = published[0];
      if (!item) return Response.json({ error: 'not found' }, { status: 404, headers });
      return Response.json({ item: toDetail(item), settings }, { headers });
    }

    return Response.json({ items: published.map(toCard), settings }, { headers });
  } catch (_error) {
    return Response.json({ error: 'unavailable' }, { status: 500, headers });
  }
}