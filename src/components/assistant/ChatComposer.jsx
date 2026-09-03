import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ChatComposer({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const uploaded = [];
    try {
      for (const file of picked) {
        const named = file.name
          ? file
          : new File([file], `clipboard-${Date.now()}.png`, { type: file.type || 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: named });
        uploaded.push({ name: named.name, url: file_url });
      }
    } catch (e) {
      setUploadError('파일 업로드에 실패했습니다. 다시 시도해 주세요.');
    }
    setFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const submit = () => {
    if (disabled || uploading) return;
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files.map((f) => f.url), files.map((f) => f.name));
    setText('');
    setFiles([]);
  };

  return (
    <div className="border-t border-border bg-card p-3">
      {uploadError && (
        <p className="mb-2 text-xs text-destructive">{uploadError}</p>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f) => (
            <span key={f.url} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[180px] truncate">{f.name}</span>
              <button onClick={() => setFiles(files.filter((x) => x.url !== f.url))}>
                <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button variant="outline" size="icon" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData?.items || [])
              .filter((it) => it.kind === 'file')
              .map((it) => it.getAsFile())
              .filter(Boolean);
            if (pasted.length > 0) {
              e.preventDefault();
              handleFiles(pasted);
            }
          }}
          placeholder="업무를 물어보거나 파일을 첨부해 보세요 (이미지 Ctrl+V 붙여넣기 가능, Shift+Enter 줄바꿈)"
          className="min-h-[44px] max-h-32 resize-none"
        />
        <Button size="icon" onClick={submit} disabled={disabled || uploading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}