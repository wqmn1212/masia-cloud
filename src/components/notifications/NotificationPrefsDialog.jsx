import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

// 고객 메일 알림 설정: 묶음별로 메일을 끄고 켠다. 앱 알림(종)은 모두 그대로 온다.
// 묶음 이름과 잠긴 알림은 서버 base44/shared/notificationPrefs.ts 와 같다.
const BUNDLES = [
  { key: 'decision', label: '결정 요청', desc: '견적 비교표, 품질 기준서, 검수 결과, 도착지 비용, 계약서 서명 요청, 디자인 확인, 사내 결재', locked: '고객님이 판단하셔야 하는 일이라 끌 수 없습니다' },
  { key: 'payment', label: '결제', desc: '입금 확인, 공장 계좌 확인', note: '결제 요청·결제 기한·공장 계좌 변경(송금 중지 안내) 메일은 끌 수 없습니다' },
  { key: 'progress', label: '진행', desc: '단계 변경, 새 프로젝트, 파일 공유, 일정 변경, 담당자 답변, 중국 휴무, 월간 리포트, 재주문 시점' },
  { key: 'shipment', label: '선적', desc: '선적 상태 변경, 도착 원가 확정' },
  { key: 'quality', label: '품질', desc: '불량 신고 처리 상황' },
  { key: 'weekly', label: '주간 요약', desc: '월요일 아침 한 통: 이번 주 확인하실 일, 이번 주 일정·도착 예정, 지난주 바뀐 것' },
];

export default function NotificationPrefsDialog({ open, onOpenChange }) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me(), enabled: open });
  const [prefs, setPrefs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && me) setPrefs(me.notification_prefs || {}); }, [open, me]);
  const on = (key) => prefs[key]?.email !== false;
  const save = async () => {
    setBusy(true);
    try {
      const next = Object.fromEntries(BUNDLES.filter((b) => !b.locked).map((b) => [b.key, { email: on(b.key) }]));
      await base44.auth.updateMe({ notification_prefs: next });
      qc.invalidateQueries({ queryKey: ['current-user'] });
      toast({ title: '메일 알림 설정을 저장했습니다' });
      onOpenChange(false);
    } catch (err) {
      toast({ title: '저장하지 못했습니다', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>메일 알림 설정</DialogTitle></DialogHeader>
        <p className="text-label text-muted-foreground">받을 메일만 고르세요. 앱 알림(종 모양)은 모두 그대로 옵니다. 이 설정은 이 계정에만 적용됩니다.</p>
        {!me ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <ul className="divide-y rounded-lg border">
            {BUNDLES.map((b) => (
              <li key={b.key} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-label font-medium">{b.label}{b.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}</p>
                  <p className="text-caption text-muted-foreground">{b.desc}</p>
                  {(b.locked || b.note) && <p className="mt-0.5 text-caption text-muted-foreground">{b.locked || b.note}</p>}
                </div>
                <Switch checked={b.locked ? true : on(b.key)} disabled={!!b.locked || busy} aria-label={`${b.label} 메일`} onCheckedChange={(v) => setPrefs((p) => ({ ...p, [b.key]: { email: v } }))} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>닫기</Button>
          <Button type="button" onClick={save} disabled={busy || !me}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
