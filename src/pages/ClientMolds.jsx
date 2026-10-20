import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, Boxes, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import { MOLD_OWNER, MOLD_STATUS, TRADEMARK_STATUS, lifeUsed } from '@/lib/molds';

// 고객 포털 '내 금형': 프로젝트별 금형의 소유·확인서·보관·반환 조건·사용 횟수와 중국 상표 상태
export default function ClientMolds() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['client-molds'],
    queryFn: async () => (await base44.functions.invoke('listClientMolds', withClientView())).data,
  });
  const molds = data?.molds || [];
  const tm = data?.trademark_status || 'UNKNOWN';
  const noDoc = molds.filter((m) => m.ownership === 'CLIENT' && !m.ownership_confirmed).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">내 금형</h1>
        <p className="mt-1 text-sm text-muted-foreground">중국 공장에 있는 금형의 소유 확인서, 보관 위치, 반환 조건과 사용 횟수를 확인하실 수 있습니다</p>
      </div>
      {tm !== 'REGISTERED' && (
        <Card className="flex gap-2 border-chart-3/40 bg-chart-3/5 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-chart-3" />
          <div><p className="font-semibold">{TRADEMARK_STATUS[tm]}</p><p className="mt-1 text-xs text-muted-foreground">중국 상표는 먼저 출원한 쪽이 권리를 가집니다. 거래 공장이나 제3자가 먼저 출원하면 같은 이름으로 중국에서 만들거나 팔기 어려워질 수 있습니다. 출원이 필요하면 담당자에게 문의해 주세요.</p></div>
        </Card>
      )}
      {noDoc > 0 && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />소유 확인서를 아직 받지 못한 금형이 {noDoc}개 있습니다. 담당자가 공장 서명을 받는 중입니다.</p>}
      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : isError ? <p className="text-sm text-destructive">금형 목록을 불러오지 못했습니다.</p>
        : molds.length === 0 ? (
          <Card className="p-12 text-center"><Boxes className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 font-semibold">등록된 금형이 없습니다</p><p className="mt-1 text-sm text-muted-foreground">금형을 새로 만들면 담당자가 이곳에 등록합니다.</p></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {molds.map((m) => {
              const used = lifeUsed(m);
              return (
                <Card key={m.id} className="space-y-3 p-4">
                  <div className="flex gap-3">
                    {m.photos[0] ? <img src={m.photos[0].url} alt={m.name} className="h-20 w-20 shrink-0 rounded-lg border object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-lg border bg-muted" />}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.card_title}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">{MOLD_STATUS[m.status]}</Badge>
                        <Badge className="border-0 bg-muted text-[10px] text-foreground">{MOLD_OWNER[m.ownership]}</Badge>
                        {m.ownership_confirmed ? <Badge className="gap-0.5 border-0 bg-primary/10 text-[10px] text-primary"><BadgeCheck className="h-3 w-3" />소유 확인서</Badge> : <Badge className="border-0 bg-destructive/10 text-[10px] text-destructive">확인서 대기</Badge>}
                      </div>
                    </div>
                  </div>
                  <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
                    {(m.part_name || m.cavity || m.material) && <><dt className="text-muted-foreground">사양</dt><dd>{[m.part_name, m.cavity ? `${m.cavity}캐비티` : '', m.material].filter(Boolean).join(' · ')}</dd></>}
                    <dt className="text-muted-foreground">보관</dt><dd>{m.location}{m.last_checked_at ? ` · 실물 확인 ${m.last_checked_at}` : ''}</dd>
                    <dt className="text-muted-foreground">사용 횟수</dt><dd>{m.shot_count != null ? `${Number(m.shot_count).toLocaleString('ko-KR')}쇼트` : '기록 전'}{used != null ? ` · 예상 수명의 ${Math.round(used * 100)}%` : ''}</dd>
                    {m.return_terms && <><dt className="text-muted-foreground">반환 조건</dt><dd>{m.return_terms}</dd></>}
                  </dl>
                  {m.ownership_doc && <div className="flex items-center gap-1 text-xs"><span>금형 소유 확인서</span><DocumentOpenButton document={{ ...m.ownership_doc, document_kind: 'attachment' }} /></div>}
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
