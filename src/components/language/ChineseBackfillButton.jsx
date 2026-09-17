import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function ChineseBackfillButton({ user }) {
  const [running, setRunning] = useState(false);
  const { toast } = useToast();
  if (user?.account_tier !== 'master') return null;
  const run = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('backfillChineseTranslations', { batch_size: 20 });
      toast({ title: '中文回填完成', description: `翻译 ${res.data?.translated || 0} 条，跳过 ${res.data?.skipped || 0} 条` });
    } catch (e) {
      toast({ title: '中文回填暂不可用', description: e?.message || '请确认集成额度', variant: 'destructive' });
    } finally { setRunning(false); }
  };
  return <Button variant="outline" onClick={run} disabled={running} className="gap-2"><Languages className="w-4 h-4" />{running ? <><Loader2 className="w-3 h-3 animate-spin" />翻译中</> : '中文回填'}</Button>;
}