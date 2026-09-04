import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Upload } from 'lucide-react';
import { PORTFOLIO_CATEGORIES, emptyPortfolioItem, slugify } from '@/lib/portfolioMeta';
import PortfolioMediaEditor from './PortfolioMediaEditor';

export default function PortfolioFormDialog({ open, onOpenChange, item, tenantId, onSaved }) {
  const [form, setForm] = useState(emptyPortfolioItem());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingThumb, setUploadingThumb] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(item ? { ...emptyPortfolioItem(), ...item } : emptyPortfolioItem());
      setError('');
    }
  }, [open, item]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const uploadThumb = async (file) => {
    setUploadingThumb(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, thumbnail_url: file_url }));
    setUploadingThumb(false);
  };

  const save = async () => {
    setError('');
    if (!form.title_ko?.trim()) return setError('한국어 제목을 입력하세요.');
    setSaving(true);
    try {
      const payload = {
        ...form,
        tenant_id: tenantId,
        slug: slugify(form.slug || form.title_en || form.title_ko),
        sort_order: Number(form.sort_order) || 0,
        featured_order: Number(form.featured_order) || 0,
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      if (item?.id) await base44.entities.PortfolioItem.update(item.id, payload);
      else await base44.entities.PortfolioItem.create(payload);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || '저장에 실패했습니다.');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? '포트폴리오 수정' : '포트폴리오 등록'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">기본 정보</TabsTrigger>
            <TabsTrigger value="text">다국어 본문</TabsTrigger>
            <TabsTrigger value="media">미디어 · 자료</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>카테고리</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PORTFOLIO_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL 식별자 (비우면 자동)</Label>
                <Input value={form.slug} onChange={set('slug')} placeholder="cnc-machining" />
              </div>
              <div>
                <Label>제목 (한국어)</Label>
                <Input value={form.title_ko} onChange={set('title_ko')} />
              </div>
              <div>
                <Label>카드 한 줄 설명 (한국어)</Label>
                <Input value={form.summary_ko} onChange={set('summary_ko')} />
              </div>
              <div>
                <Label>MOQ</Label>
                <Input value={form.moq} onChange={set('moq')} placeholder="500 pcs" />
              </div>
              <div>
                <Label>통상 납기</Label>
                <Input value={form.lead_time} onChange={set('lead_time')} placeholder="35~45일" />
              </div>
              <div>
                <Label>정렬 순서</Label>
                <Input type="number" value={form.sort_order} onChange={set('sort_order')} />
              </div>
              <div>
                <Label>대응 인증 (쉼표 구분)</Label>
                <Input
                  value={(form.certifications || []).join(', ')}
                  onChange={(e) => setForm((f) => ({ ...f, certifications: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                  placeholder="KC, CE"
                />
              </div>
            </div>

            <div>
              <Label>대표 이미지</Label>
              <div className="flex items-center gap-3 mt-2">
                {form.thumbnail_url && <img src={form.thumbnail_url} alt="" className="w-24 h-16 object-cover rounded-md border border-border" />}
                <label className="inline-flex items-center gap-2 text-sm border border-dashed border-border rounded-md px-3 py-2 cursor-pointer text-muted-foreground">
                  {uploadingThumb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 업로드
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadThumb(e.target.files[0])} />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                랜딩 공개
                <Switch checked={!!form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                추천 노출
                <Switch checked={!!form.is_featured} onCheckedChange={(v) => setForm((f) => ({ ...f, is_featured: v }))} />
              </label>
            </div>

            <div>
              <Label>내부 메모 (공개되지 않음)</Label>
              <Textarea value={form.internal_note} onChange={set('internal_note')} rows={2} />
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>제목 (English)</Label><Input value={form.title_en} onChange={set('title_en')} /></div>
              <div><Label>제목 (中文)</Label><Input value={form.title_zh} onChange={set('title_zh')} /></div>
              <div><Label>설명 (English)</Label><Input value={form.summary_en} onChange={set('summary_en')} /></div>
              <div><Label>설명 (中文)</Label><Input value={form.summary_zh} onChange={set('summary_zh')} /></div>
            </div>
            <div><Label>상세 본문 (한국어)</Label><Textarea value={form.body_ko} onChange={set('body_ko')} rows={5} /></div>
            <div><Label>상세 본문 (English)</Label><Textarea value={form.body_en} onChange={set('body_en')} rows={4} /></div>
            <div><Label>상세 본문 (中文)</Label><Textarea value={form.body_zh} onChange={set('body_zh')} rows={4} /></div>
          </TabsContent>

          <TabsContent value="media" className="pt-4">
            <PortfolioMediaEditor form={form} setForm={setForm} />
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}