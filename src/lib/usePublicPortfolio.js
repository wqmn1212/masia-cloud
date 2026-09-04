import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { portfolio, CATEGORY_TAG } from '@/lib/landingContent';

// 엔티티 { ko, en, zh } → 기존 tx() 가 쓰는 [ko, en, zh] 배열
const toArr = (o) => [o?.ko ?? '', o?.en ?? o?.ko ?? '', o?.zh ?? o?.ko ?? ''];

const toCardItem = (it) => ({
  slug: it.slug,
  cat: it.category,
  tag: CATEGORY_TAG[it.category] || ['', '', ''],
  t: toArr(it.title),
  d: toArr(it.summary),
  image: it.thumbnail_url || '',
});

// 공개 함수 조회 실패 시 하드코딩 배열로 폴백 — 랜딩이 빈 화면이 되지 않게 한다
export default function usePublicPortfolio() {
  const [items, setItems] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let alive = true;
    base44.functions
      .invoke('getPublicPortfolio', {})
      .then((res) => {
        if (!alive) return;
        const list = res?.data?.items || [];
        setItems(list.map(toCardItem));
        setSettings(res?.data?.settings || null);
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);

  return { items: items?.length ? items : portfolio, settings };
}