import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWorkT } from '@/lib/workI18n';

// 고객에게 보내는 사유 문구는 한국어 원문을 그대로 쓴다 (고객 메일·알림이 한국어)
export const SCHEDULE_REASONS = ['공장 생산 일정 지연', '자재·부품 수급 지연', '중국 휴무', '품질 보완(재작업)', '고객 요청 사항 반영', '운송·선적 일정', '일정 앞당김', '기타'];

const dayDiff = (a, b) => (a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) : null);

// 예정 납품일이 바뀔 때 사유를 고르고, 고객에게 갈 안내문을 미리 본 뒤 저장한다.
// request = { before, after, draft, resolve } — resolve(사유 문자열) 로 호출한 쪽에 돌려준다.
export default function ScheduleNoticeDialog({ request, card, onDone }) {
  const { tr } = useWorkT();
  const [preset, setPreset] = useState('');
  const [detail, setDetail] = useState('');
  useEffect(() => {
    if (!request) return;
    setPreset('');
    setDetail(request.draft || '');
  }, [request]);

  const toClient = card?.client_visible === true && !!card?.client_id;
  const diff = dayDiff(request?.before, request?.after);
  const reason = [preset, detail.trim()].filter(Boolean).join(' — ');
  const ready = !!preset && (preset !== '기타' || !!detail.trim());
  const preview = [
    `[AEGIS] ${card?.title || ''} 예정 납품일 변경`,
    `예정 납품일: ${request?.before || '미정'} → ${request?.after || '미정'}${diff ? ` (${diff > 0 ? '+' : ''}${diff}일)` : ''}`,
    `변경 사유: ${reason || '(사유를 골라 주세요)'}`,
  ].join('\n');

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onDone('')}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr('예정 납품일 변경 안내')}</DialogTitle>
          <DialogDescription>{tr(toClient ? '저장하면 고객에게 앱 알림과 이메일로 안내됩니다.' : '비공개 카드라 고객에게는 보내지 않고 변경 이력만 남깁니다.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{tr('변경 사유')}</Label>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group">
              {SCHEDULE_REASONS.map((r) => (
                <button key={r} type="button" aria-pressed={preset === r} onClick={() => setPreset(r)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${preset === r ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  {tr(r)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">{tr('고객에게 전할 설명')}</Label>
            <Textarea rows={3} maxLength={800} value={detail} onChange={(e) => setDetail(e.target.value)}
              placeholder={tr('예: 사출 금형 수정으로 양산 시작이 5일 늦어졌습니다. 나머지 일정은 그대로입니다.')} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{tr(toClient ? '고객에게 이렇게 안내됩니다' : '변경 이력에 이렇게 남습니다')}</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">{preview}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onDone('')}>{tr('사유 없이 저장')}</Button>
          <Button disabled={!ready} onClick={() => onDone(reason)}>{tr(toClient ? '저장하고 고객에게 안내' : '저장')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
