import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function DocumentOpenButton({ document, kind = 'attachment' }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const open = async () => {
    setBusy(true);
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const { data } = await base44.functions.invoke('getDocumentAccess', { document_id: document.id, kind });
      if (!data.url) throw new Error('파일 주소를 가져오지 못했습니다.');
      if (tab) tab.location.replace(data.url);
      else toast({ title: '팝업을 허용하고 다시 열어 주세요.' });
    } catch (error) {
      tab?.close();
      toast({ title: '파일 열기 실패', description: error.response?.data?.error || error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={open} title="파일 열기 / 다운로드" aria-label={`${document.file_name} 열기`}>{busy ? <Loader2 className="animate-spin" /> : <ExternalLink />}</Button>;
}