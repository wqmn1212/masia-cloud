import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { MailSearch, Loader2 } from 'lucide-react';

export default function EmailBackfillButton() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, created: 0 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const run = async () => {
    setRunning(true);
    setProgress({ scanned: 0, created: 0 });
    let pageToken = '';
    let scanned = 0;
    let created = 0;
    try {
      for (let i = 0; i < 50; i++) {
        const res = await base44.functions.invoke('backfillClientEmails', {
          page_token: pageToken,
          batch_size: 10,
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
      toast({ title: '과거 이메일 연동 완료', description: `${scanned}건 검토 · ${created}건 추천 생성` });
    } catch (e) {
      toast({ title: '이메일 연동 실패', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button variant="secondary" onClick={run} disabled={running} className="gap-2 border border-primary/30 text-primary">
      {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailSearch className="w-4 h-4" />}
      {running ? `연동 중… ${progress.scanned}건 검토 / ${progress.created}건 생성` : '전체 메일 가져오기'}
    </Button>
  );
}