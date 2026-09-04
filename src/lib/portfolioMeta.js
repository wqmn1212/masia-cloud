export const PORTFOLIO_CATEGORIES = [
  { value: 'machine', label: '기계설비' },
  { value: 'precision', label: '정밀가공' },
  { value: 'electronics', label: '전자 · 전기' },
  { value: 'health', label: '뷰티 · 의료' },
  { value: 'living', label: '리빙 · 공구' },
  { value: 'goods', label: '굿즈 · 조형' },
  { value: 'chem', label: '화학 · 원자재' },
];

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
  is_published: false,
  is_featured: false,
  featured_order: 0,
  internal_note: '',
});