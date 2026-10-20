import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import FileDropArea from '@/components/files/FileDropArea';
import { mergeFiles, toAttachmentPayload, MAX_FILES } from '@/lib/clientFileUpload';
import { CLIENT_UPLOAD_TYPES, DOCUMENT_TYPES } from '@/components/files/documentTypes';

export default function ClientFileUploader({ cardId }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [docType, setDocType] = useState('GENERAL');

  const upload = useMutation({
    mutationFn: async (list) => {
      const { files, rejected } = mergeFiles([], list);
      if (rejected.length) toast({ title: '일부 파일 제외', description: `${rejected.join(', ')} (최대 ${MAX_FILES}건 · 10MB)`, variant: 'destructive' });
      if (!files.length) return null;
      const res = await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'upload_files', document_type: docType, attachments: await toAttachmentPayload(files) });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      toast({ title: docType === 'GENERAL' ? '파일이 업로드되었습니다' : `${DOCUMENT_TYPES[docType]}를 올렸습니다`, description: '담당자에게도 바로 표시됩니다' });
      setDocType('GENERAL');
      qc.invalidateQueries({ queryKey: ['client-shared-files', cardId] });
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['company-files'] });
    },
    onError: (err) => toast({ title: '업로드 실패', description: err.response?.data?.error || err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-2">
    <label className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">올릴 파일 종류</span>
      <select className="h-8 rounded-md border bg-background px-2 text-xs" value={docType} disabled={upload.isPending} onChange={(e) => setDocType(e.target.value)}>
        {CLIENT_UPLOAD_TYPES.map((k) => <option key={k} value={k}>{DOCUMENT_TYPES[k]}</option>)}
      </select>
      {docType.startsWith('REMITTANCE') && <span className="text-muted-foreground">공장에 직접 송금하셨다면 은행 송금확인증을 올려 주세요. 결제 탭에 함께 표시됩니다.</span>}
    </label>
    <FileDropArea onFiles={(f) => upload.mutate(f)} disabled={upload.isPending}>
      <button type="button" disabled={upload.isPending} onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 text-sm text-muted-foreground hover:border-primary/50 transition-colors">
        {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {upload.isPending ? '업로드 중...' : `파일을 끌어다 놓거나 클릭해서 업로드 (최대 ${MAX_FILES}건 · 10MB)`}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ''; }} />
    </FileDropArea>
    </div>
  );
}