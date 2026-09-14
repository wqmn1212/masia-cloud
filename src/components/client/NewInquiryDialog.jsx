import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = ['기계설비', '정밀가공', '전자 · 전기', '뷰티 · 의료', '리빙 · 공구', '굿즈 · 조형', '기타'];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function NewInquiryDialog({ open, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [detail, setDetail] = useState('');
  const [files, setFiles] = useState([]);

  const reset = () => {
    setTitle('');
    setCategories([]);
    setQuantity('');
    setTargetPrice('');
    setDetail('');
    setFiles([]);
  };

  const toggleCategory = (c) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const addFiles = (list) => {
    const next = [...files];
    for (const f of Array.from(list || [])) {
      if (next.length >= MAX_FILES) break;
      if (f.size > MAX_FILE_BYTES) {
        toast({ title: '파일 제한 초과', description: `${f.name} (10MB 초과)`, variant: 'destructive' });
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const attachments = [];
      for (const f of files) {
        attachments.push({ name: f.name, type: f.type, size: f.size, data: await fileToBase64(f) });
      }
      const res = await base44.functions.invoke('submitClientInquiry', {
        title,
        categories,
        quantity,
        target_price: targetPrice,
        detail,
        attachments,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-cards'] });
      toast({ title: '문의가 접수되었습니다', description: '담당자가 회신드릴 예정입니다' });
      reset();
      onClose();
    },
    onError: (err) => toast({ title: '접수 실패', description: err.message, variant: 'destructive' }),
  });

  const canSubmit = title.trim() && detail.trim() && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>신규 문의 작성</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 드립백 충전기 5대 견적 요청" />
          </div>

          <div className="space-y-1.5">
            <Label>품목 카테고리</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>발주 예정 수량</Label>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="예: 500개" />
            </div>
            <div className="space-y-1.5">
              <Label>희망 단가</Label>
              <Input value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="예: $1.50/개" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>요구사항 상세 *</Label>
            <Textarea
              rows={5}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="사양, 마감, 납기, 인증 등 요구사항을 자세히 적어주시면 정확한 견적이 가능합니다."
            />
          </div>

          <div className="space-y-1.5">
            <Label>첨부 파일 (최대 {MAX_FILES}건 · 10MB)</Label>
            <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                <span>파일 선택 / 드롭</span>
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </label>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-muted rounded-full pl-2.5 pr-1 py-1 text-xs">
                    {f.name}
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>취소</Button>
          <Button disabled={!canSubmit} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            문의 접수
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}