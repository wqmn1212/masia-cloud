export const PORTFOLIO_CATEGORIES = [
  { value: 'machine', label: '기계설비' },
  { value: 'precision', label: '정밀가공' },
  { value: 'electronics', label: '전자 · 전기' },
  { value: 'health', label: '뷰티 · 의료' },
  { value: 'living', label: '리빙 · 공구' },
  { value: 'goods', label: '굿즈 · 조형' },
  { value: 'chem', label: '화학 · 원자재' },
];

export const PORTFOLIO_REGIONS = [
  { value: 'shenzhen', label: '선전' },
  { value: 'dongguan', label: '둥관' },
  { value: 'guangzhou', label: '광저우' },
  { value: 'foshan', label: '포산' },
  { value: 'zhongshan', label: '중산' },
  { value: 'other', label: '기타' },
];

export const PORTFOLIO_TYPES = [
  { value: 'oem', label: 'OEM 제작' },
  { value: 'odm', label: 'ODM 개발' },
  { value: 'sourcing', label: '제품 소싱' },
  { value: 'custom_machine', label: '맞춤 설비' },
];

export const PUBLISH_STATUS = {
  draft: { label: '초안', className: 'bg-muted text-muted-foreground' },
  review: { label: '검토 요청', className: 'bg-amber-100 text-amber-700' },
  published: { label: '발행됨', className: 'bg-emerald-100 text-emerald-700' },
};

export const statusOf = (item) => item.publish_status || (item.is_published ? 'published' : 'draft');

export const canPublish = (user) => ['master', 'service'].includes(user?.account_tier);

export const categoryLabel = (value) =>
  PORTFOLIO_CATEGORIES.find((c) => c.value === value)?.label || value || '-';

export const slugify = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const emptyPortfolioItem = () => ({
  slug: '',
  category: 'machine',
  sort_order: 0,
  title_ko: '', title_en: '', title_zh: '',
  summary_ko: '', summary_en: '', summary_zh: '',
  body_ko: '', body_en: '', body_zh: '',
  thumbnail_url: '',
  images: [],
  videos: [],
  spec_files: [],
  moq: '',
  lead_time: '',
  certifications: [],
  region: '',
  project_year: '',
  project_type: '',
  publish_status: 'draft',
  is_published: false,
  is_featured: false,
  featured_order: 0,
  internal_note: '',
});