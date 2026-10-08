export const HASHTAG_LIMIT = 5;

// 플랫폼이 제공하는 지표 (나머지는 '미제공')
export const SUPPORTED_METRICS = { instagram: ['likes', 'comments'], youtube: ['views', 'likes', 'comments'] };

export const PLATFORMS = { instagram: '인스타그램', youtube: '유튜브' };

export const FORMATS = { feed: '피드', carousel: '캐러셀', reel: '릴스', video: '영상', short: '쇼츠' };

export const STATUS = {
  draft: { label: '초안', cls: 'bg-slate-100 text-slate-600' },
  pending_approval: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: '승인됨', cls: 'bg-blue-50 text-blue-700' },
  scheduled: { label: '예약됨', cls: 'bg-violet-50 text-violet-700' },
  published: { label: '게시 완료', cls: 'bg-emerald-50 text-emerald-700' },
};

const KST = 9 * 3600 * 1000;
const SLOT_DAYS = [1, 3, 5]; // 월·수·금

// KST 기준 YYYY-MM-DD
export const kstDate = (iso) => new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 10);

export const formatKst = (iso) => {
  const d = new Date(new Date(iso).getTime() + KST);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} KST`;
};

// 다음 월·수·금 10:00 KST 슬롯 n개
export function nextSlots(n = 6) {
  const out = [];
  const now = Date.now();
  const base = new Date(now + KST);
  for (let i = 0; out.length < n && i < 30; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i, 1, 0));
    const kstDay = new Date(d.getTime() + KST).getUTCDay();
    if (SLOT_DAYS.includes(kstDay) && d.getTime() > now) out.push(d.toISOString());
  }
  return out;
}

export function validatePost(p) {
  const errors = [];
  if (!p.title?.trim()) errors.push('제목을 입력하세요.');
  if (!p.platforms?.length) errors.push('게시 플랫폼을 하나 이상 선택하세요.');
  if (p.platforms?.includes('instagram')) {
    if ((p.caption || '').length > 2200) errors.push('인스타그램 캡션은 2,200자 이하여야 합니다.');
    if ((p.hashtags || []).length > HASHTAG_LIMIT) errors.push(`해시태그는 ${HASHTAG_LIMIT}개 이하여야 합니다.`);
    if (!p.media?.length) errors.push('인스타그램 게시물에는 미디어가 필요합니다.');
    if (p.post_format === 'carousel' && (p.media || []).length > 10) errors.push('캐러셀은 최대 10개입니다.');
  }
  if (p.platforms?.includes('youtube')) {
    if (!p.youtube_title?.trim()) errors.push('유튜브 제목을 입력하세요.');
    if ((p.youtube_title || '').length > 100) errors.push('유튜브 제목은 100자 이하여야 합니다.');
    if ((p.youtube_description || '').length > 5000) errors.push('유튜브 설명은 5,000자 이하여야 합니다.');
    if ((p.youtube_tags || []).join(',').length > 500) errors.push('유튜브 태그 합계는 500자 이하여야 합니다.');
    if (!(p.media || []).some((m) => m.type === 'video')) errors.push('유튜브 게시물에는 영상이 필요합니다.');
  }
  return errors;
}

export const splitTags = (s) => s.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);