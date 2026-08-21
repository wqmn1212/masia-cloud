import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { MailSearch, Loader2, CalendarRange } from 'lucide-react';

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function EmailBackfillButton() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, created: 0 });
  const [after, setAfter] = useState(daysAgo(30));
  const [before, setBefore] = useState(today());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const run = async () => {
    setRunning(true);
    setOpen(false);
    setProgress({ scanned: 0, created: 0 });
    let pageToken = '';
    let scanned = 0;
    let created = 0;
    try {
      for (let i = 0; i < 50; i++) {
        const res = await base44.functions.invoke('backfillClientEmails', {
          page_token: pageToken,
          batch_size: 10,
          after,
          before,
        });
        const data = res.data || {};
        if (data.error) throw new Error(data.error);
        scanned += data.scanned || 0;
        created += data.created || 0;
        setProgress({ scanned, created });
        if (data.done) break;
        pageToken = data.next_page_token;
      }
      queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
      toast({ title: '이메일 연동 완료', description: `${scanned}건 검토 · ${created}건 추천 생성` });
    } catch (e) {
      toast({ title: '이메일 연동 실패', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" disabled={running} className="gap-2 border border-primary/30 text-primary">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailSearch className="w-4 h-4" />}
          {running ? `연동 중… ${progress.scanned}건 검토 / ${progress.created}건 생성` : '기간별 메일 가져오기'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="w-4 h-4 text-primary" />
          가져올 기간 선택
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">시작일</Label>
            <Input type="date" value={after} max={before} onChange={(e) => setAfter(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">종료일</Label>
            <Input type="date" value={before} min={after} max={today()} onChange={(e) => setBefore(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant="outline" className="flex-1 text-xs"
              onClick={() => { setAfter(daysAgo(d)); setBefore(today()); }}>
              최근 {d}일
            </Button>
          ))}
        </div>
        <Button className="w-full gap-2" onClick={run} disabled={!after || !before}>
          <MailSearch className="w-4 h-4" />
          이 기간 메일 가져오기
        </Button>
      </PopoverContent>
    </Popover>
  );
}