import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { SAMPLE_LOCATIONS, hasGoldenSample } from '@/lib/goldenSample';

const EMPTY = { photos: [], approved_at: '', approved_by: '', locations: {}, seal_no: '', note: '' };
const pick = (g) => ({ ...EMPTY, ...(g || {}), locations: { ...(g?.locations || {}) } });

// 기준 샘플 등록: 승인한 샘플의 사진·승인일·보관 위치. 양산 검수 때 이 샘플과 나란히 비교한다.
export default function GoldenSamplePanel({ card, user }) {
  const qc = useQueryClient();
  const [g, setG] = useState(() => pick(card.golden_sample));
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setG(pick(card.golden_sample)); }, [card.id, card.golden_sample?.updated_at]);
  const set = (k) => (e) => setG((x) => ({ ...x, [k]: e.target.value }));
  const setLoc = (k, v) => setG((x) => ({ ...x, locations: { ...x.locations, [k]: v } }));
  const dirty = JSON.stringify(g) !== JSON.stringify(pick(card.golden_sample));
  const addPhotos = async (list) => {
    setUploading(true);
    try {
      const files = Array.from(list).slice(0, 8 - g.photos.length);
      const up = await Promise.all(files.map((file) => base44.integrations.Core.UploadFile({ file })));
      setG((x) => ({ ...x, photos: [...x.photos, ...up.map((u, i) => ({ url: u.file_url, name: files[i].name }))] }));
    } catch (e) {
      toast({ title: '사진을 올리지 못했습니다', description: e.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };
  const save = useMutation({
    mutationFn: () => base44.entities.TaskCard.update(card.id, { golden_sample: { ...g, locations: Object.fromEntries(Object.entries(g.locations).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])), updated_at: new Date().toISOString(), updated_by_name: user?.full_name || user?.email || '' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-cards'] }); qc.invalidateQueries({ queryKey: ['client-card-detail', card.id] }); toast({ title: '기준 샘플을 저장했습니다', description: '고객 검수 탭에도 보입니다.' }); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });

  return (
    <section className="mt-5 space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Star className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">기준 샘플 (골든 샘플)</h3>
        {hasGoldenSample(card.golden_sample) ? <Badge className="border-0 bg-primary/10 text-primary">등록됨</Badge> : <Badge variant="outline">미등록</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">고객이 승인한 샘플을 같은 것으로 여러 개 남겨 고객사·공장·이지스가 나눠 보관합니다. 양산 검수 때 이 샘플과 나란히 찍은 사진을 함께 올려 주세요.</p>
      <div className="flex flex-wrap gap-2">
        {g.photos.map((p, i) => (
          <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-md border">
            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
            <button type="button" aria-label={`${p.name} 빼기`} onClick={() => setG((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))} className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {g.photos.length < 8 && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground hover:border-primary/50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}사진 추가
            <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1 text-[11px]"><span>고객 승인일</span><Input type="date" className="h-8 text-xs" value={g.approved_at} onChange={set('approved_at')} /></label>
        <label className="space-y-1 text-[11px]"><span>승인한 분</span><Input className="h-8 text-xs" value={g.approved_by} onChange={set('approved_by')} placeholder="고객사 담당자" /></label>
        <label className="space-y-1 text-[11px]"><span>봉인·라벨 번호</span><Input className="h-8 text-xs" value={g.seal_no} onChange={set('seal_no')} placeholder="예: GS-2610-01" /></label>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {Object.entries(SAMPLE_LOCATIONS).map(([k, v]) => (
          <label key={k} className="flex items-center gap-1.5">{v}<Input type="number" min="0" className="h-7 w-16 text-xs" value={g.locations[k] ?? ''} onChange={(e) => setLoc(k, e.target.value)} />개</label>
        ))}
      </div>
      <Input className="h-8 text-xs" value={g.note} onChange={set('note')} placeholder="메모 (예: 색상 한도견본 2종 포함)" />
      <div className="flex justify-end"><Button size="sm" disabled={!dirty || save.isPending || uploading} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '저장'}</Button></div>
    </section>
  );
}
