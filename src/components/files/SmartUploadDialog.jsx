import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Upload, FilePlus2, CheckCircle2 } from 'lucide-react';
import { classifyFile, applyClassification } from '@/lib/classifyFile';

const NEW_CARD = '__NEW__';

export default function SmartUploadDialog({ open, onClose, cards, clients, user }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef(null);
  const qc = useQueryClient();

  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length === 0) return;
    setAnalyzing(true);
    setSavedCount(0);
    setProgress({ current: 0, total: arr.length });
    const results = [];
    for (const file of arr) {
      results.push(await classifyFile(file, cards, clients));
      setProgress({ current: results.length, total: arr.length });
      setItems([...results]);
    }
    setAnalyzing(false);
  };

  const setTarget = (idx, cardId) => {
    setItems(items.map((it, i) => i === idx
      ? { ...it, matched_card: cardId === NEW_CARD ? null : cards.find(c => c.id === cardId) }
      : it));
  };

  const save = async () => {
    setSaving(true);
    for (const item of items) {
      await applyClassification(item, clients, user?.full_name || user?.email);
    }
    qc.invalidateQueries({ queryKey: ['all-attachments'] });
    qc.invalidateQueries({ queryKey: ['task-cards'] });
    setSavedCount(items.length);
    setItems([]);
    setSaving(false);
  };

  const reset = () => { setItems([]); setSavedCount(0); setProgress({ current: 0, total: 0 }); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI 파일 자동 분류
          </DialogTitle>
        </DialogHeader>

        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />

        {items.length === 0 && !analyzing && (
          <div className="text-center py-8 space-y-3">
            {savedCount > 0 && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4" /> {savedCount}개 파일을 등록했습니다.
              </p>
            )}
            <p className="text-sm text-muted-foreground">파일을 올리면 AI가 내용을 읽고 적합한 태스크 카드를 찾아줍니다.</p>
            <Button onClick={() => inputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> 파일 선택
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 파일 분석 중 {progress.current}/{progress.total}
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.file_url} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{it.file_name}</span>
                  {it.matched_card
                    ? <Badge variant="outline" className="text-[10px]">기존 카드 매칭</Badge>
                    : <Badge className="text-[10px] gap-1"><FilePlus2 className="h-3 w-3" /> 새 카드 생성</Badge>}
                </div>
                {it.summary && <p className="text-xs text-muted-foreground">{it.summary}</p>}
                {it.reason && <p className="text-[11px] text-muted-foreground">근거: {it.reason}</p>}
                <Select value={it.matched_card?.id || NEW_CARD} onValueChange={(v) => setTarget(idx, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_CARD}>+ 새 카드 생성: {it.new_card_title}</SelectItem>
                    {cards.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}{c.client_name ? ` · ${c.client_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>다시 선택</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                등록하기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}