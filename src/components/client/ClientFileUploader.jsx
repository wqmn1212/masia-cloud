import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import FileDropArea from '@/components/files/FileDropArea';
import { mergeFiles, toAttachmentPayload, MAX_FILES } from '@/lib/clientFileUpload';

export default function ClientFileUploader({ cardId }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);

  const upload = useMutation({
    mutationFn: async (list) => {
      const { files, rejected } = mergeFiles([], list);
      if (rejected.length) toast({ title: '일부 파일 제외', description: `${rejected.join(', ')} (최대 ${MAX_FILES}건 · 10MB)`, variant: 'destructive' });
      if (!files.length) return null;
      const res = await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'upload_files', attachments: await toAttachmentPayload(files) });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      toast({ title: '파일이 업로드되었습니다', description: '담당자에게도 바로 표시됩니다' });
      qc.invalidateQueries({ queryKey: ['client-shared-files', cardId] });
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['company-files'] });
    },
    onError: (err) => toast({ title: '업로드 실패', description: err.response?.data?.error || err.message, variant: 'destructive' }),
  });

  return (
    <FileDropArea onFiles={(f) => upload.mutate(f)} disabled={upload.isPending}>
      <button type="button" disabled={upload.isPending} onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 text-sm text-muted-foreground hover:border-primary/50 transition-colors">
        {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {upload.isPending ? '업로드 중...' : `파일을 끌어다 놓거나 클릭해서 업로드 (최대 ${MAX_FILES}건 · 10MB)`}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ''; }} />
    </FileDropArea>
  );
}