import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';

export default function ChineseBackfillButton({ user }) {
  const [running, setRunning] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { lang } = useLanguage();
  if (user?.account_tier !== 'master' || user?.role !== 'admin') return null;
  const run = async (target) => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('backfillChineseTranslations', { batch_size: 20, target_language: target });
      if (res.data?.error) throw new Error(res.data.error);
      qc.invalidateQueries();
      toast({ title: lang === 'zh' ? '补译完成' : '번역 보충 완료', description: `${res.data?.translated || 0}건 / 条 · ${lang === 'zh' ? '如有更多内容，请再次运行' : '남은 항목은 다시 실행하여 처리하세요'}` });
    } catch (e) {
      toast({ title: lang === 'zh' ? '补译暂不可用' : '번역 보충을 완료하지 못했습니다', description: e?.message, variant: 'destructive' });
    } finally { setRunning(false); }
  };
  return <div className="flex flex-wrap gap-2">{['zh', 'ko'].map(target => <Button key={target} variant="outline" onClick={() => run(target)} disabled={running} className="gap-2">
    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
    {target === 'ko' ? (lang === 'zh' ? '补译韩文' : '한국어 번역 보충') : (lang === 'zh' ? '补译中文' : '중국어 번역 보충')}
  </Button>)}</div>;
}