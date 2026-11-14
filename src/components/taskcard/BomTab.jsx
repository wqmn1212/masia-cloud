import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Boxes } from 'lucide-react';
import BomEstimatePanel from '@/components/bom/BomEstimatePanel';

// 예전 기록은 공개 주소, 새 기록은 비공개 uri — 비공개면 10분짜리 열기 주소를 만든다
const openSource = async (ref) => {
  if (/^https?:\/\//i.test(ref)) { window.open(ref, '_blank', 'noopener'); return; }
  const win = window.open('', '_blank');
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: ref, expires_in: 300 });
  if (win) win.location.href = signed_url; else window.location.href = signed_url;
};

const FINISH_LABEL = { RAW: '무처리', PAINT: '도장', PLATING: '도금', NCVM: 'NCVM', PRINT: '인쇄', OTHER: '기타' };

export default function BomTab({ card }) {
  const [activeSet, setActiveSet] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['bom-items', card.id],
    queryFn: () => base44.entities.BomItem.filter({ card_id: card.id }, '-created_date', 500),
  });

  const sets = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = it.bom_set_id || 'UNGROUPED';
      if (!map.has(key)) map.set(key, { id: key, file: it.source_file_name, parts: [] });
      map.get(key).parts.push(it);
    });
    return [...map.values()];
  }, [items]);

  const current = sets.find((s) => s.id === activeSet) || sets[0];

  if (isLoading) return <p className="text-caption text-muted-foreground py-6 text-center">불러오는 중...</p>;
  if (sets.length === 0) {
    return (
      <p className="text-caption text-muted-foreground py-8 text-center">
        연결된 BOM이 없습니다. 도면 분석 화면에서 STEP 파일을 분석한 뒤 이 카드에 저장하세요.
      </p>
    );
  }

  const unconfirmed = current.parts.filter((p) => !p.material_confirmed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-body font-semibold flex items-center gap-1.5 mr-auto">
          <Boxes className="w-4 h-4" />BOM · 부품 {current.parts.length}개
        </h3>
        {sets.length > 1 && sets.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSet(s.id)}
            className={`text-micro px-2 py-1 rounded-md border transition-colors ${
              current.id === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
          >
            {s.file || s.id}
          </button>
        ))}
      </div>

      {current.parts[0]?.source_file_url && (
        <button type="button" onClick={() => openSource(current.parts[0].source_file_url)} className="text-micro text-primary underline">
          원본 STEP 파일 열기 — {current.file}
        </button>
      )}

      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-caption">
          <thead>
            <tr className="bg-muted/60 text-micro uppercase tracking-wide text-muted-foreground">
              <th className="p-2 text-left font-semibold">부품</th>
              <th className="p-2 text-left font-semibold">재질</th>
              <th className="p-2 text-right font-semibold">수량</th>
              <th className="p-2 text-right font-semibold">부피 cm³</th>
              <th className="p-2 text-right font-semibold">중량 g</th>
              <th className="p-2 text-left font-semibold">후처리</th>
            </tr>
          </thead>
          <tbody>
            {current.parts.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-2">
                  {p.thumbnail_url && (
                    <img src={p.thumbnail_url} alt="" className="inline-block w-8 h-8 mr-2 rounded bg-muted align-middle" />
                  )}
                  {p.display_name || p.part_name}
                  {p.is_purchased && <span className="ml-1.5 text-micro text-muted-foreground">구매품</span>}
                </td>
                <td className="p-2">
                  {p.material || '-'}
                  {!p.material_confirmed && <Badge variant="outline" className="ml-1.5 text-micro">미확정</Badge>}
                </td>
                <td className="p-2 text-right tabular-nums">{p.quantity ?? 1}</td>
                <td className="p-2 text-right tabular-nums">{p.volume_cm3?.toFixed(2) ?? '-'}</td>
                <td className="p-2 text-right tabular-nums">{p.weight_g?.toFixed(1) ?? '-'}</td>
                <td className="p-2">{FINISH_LABEL[p.finish] || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BomEstimatePanel parts={current.parts} unconfirmedCount={unconfirmed} />
    </div>
  );
}