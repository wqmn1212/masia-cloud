import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, FileImage, Film, Loader2, Sparkles, ExternalLink } from 'lucide-react';

function fileIcon(type) {
  if (!type) return FileText;
  if (['jpg','jpeg','png','gif','webp'].includes(type)) return FileImage;
  if (['mp4','mov','avi','mkv'].includes(type)) return Film;
  return FileText;
}

export default function FilesTab({ card, user }) {
  const [uploading, setUploading] = useState(false);
  const [parsingId, setParsingId] = useState(null);
  const inputRef = useRef();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['card-files', card.id],
    queryFn: () => base44.entities.CardAttachment.filter({ card_id: card.id }, '-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CardAttachment.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-files', card.id] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CardAttachment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-files', card.id] }),
  });

  const handleUpload = async (files) => {
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await createMutation.mutateAsync({
        card_id: card.id,
        file_name: file.name,
        file_type: ext,
        file_url,
        uploader_name: user?.full_name || '사용자',
        uploader_role: user?.role === 'admin' ? 'HQ' : 'AGENT',
        ai_parse_status: 'NONE',
      });
    }
    setUploading(false);
    toast({ title: `${files.length}개 파일 업로드 완료` });
  };

  const handleAiParse = async (attachment) => {
    setParsingId(attachment.id);
    await updateMutation.mutateAsync({ id: attachment.id, data: { ai_parse_status: 'PENDING' } });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `아래 견적서/문서 파일을 분석하여 핵심 내용을 한국어로 요약해주세요. 파일명: ${attachment.file_name}. 파일: ${attachment.file_url}`,
      file_urls: [attachment.file_url],
    });
    await updateMutation.mutateAsync({ id: attachment.id, data: { ai_parse_status: 'DONE', ai_parsed_text: result } });
    setParsingId(null);
    toast({ title: 'AI 파싱 완료' });
  };

  const isVideo = (type) => ['mp4','mov','avi','mkv','webm'].includes(type || '');
  const isImage = (type) => ['jpg','jpeg','png','gif','webp'].includes(type || '');

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleUpload(Array.from(e.dataTransfer.files)); }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> 업로드 중...
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">파일을 드래그하거나 클릭하여 업로드</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, Excel, Word, 이미지, 동영상(MP4) 지원</p>
          </>
        )}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(Array.from(e.target.files))} />
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : files.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">업로드된 파일이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => {
            const Icon = fileIcon(f.file_type);
            return (
              <div key={f.id} className="rounded-xl border bg-card p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{f.uploader_name} · {f.file_type?.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['pdf','xlsx','docx','xls'].includes(f.file_type || '') && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => handleAiParse(f)} disabled={parsingId === f.id || f.ai_parse_status === 'PENDING'}>
                        {(parsingId === f.id || f.ai_parse_status === 'PENDING')
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Sparkles className="w-3 h-3" />}
                        AI 파싱
                      </Button>
                    )}
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><ExternalLink className="w-3 h-3" /></Button>
                    </a>
                  </div>
                </div>

                {/* Video player */}
                {isVideo(f.file_type) && (
                  <video src={f.file_url} controls className="w-full rounded-lg max-h-48 bg-black" />
                )}
                {/* Image preview */}
                {isImage(f.file_type) && (
                  <img src={f.file_url} alt={f.file_name} className="w-full rounded-lg max-h-48 object-contain bg-muted" />
                )}
                {/* AI parsed result */}
                {f.ai_parse_status === 'DONE' && f.ai_parsed_text && (
                  <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-[10px] font-semibold text-primary mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI 파싱 결과</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{f.ai_parsed_text}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}