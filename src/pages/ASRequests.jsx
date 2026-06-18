import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Wrench, Loader2, Image } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DropZone from '@/components/ui/drop-zone';

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백 포장기',
  SLEEVE: '슬리브 라벨러',
  DESKTOP_LABELER: '탁상용 라벨러',
  TUBE_SEALER: '튜브 실링기'
};

const STATUS_MAP = {
  RECEIVED: { label: '접수', className: 'bg-chart-3/15 text-chart-3' },
  IN_PROGRESS: { label: '처리중', className: 'bg-primary/15 text-primary' },
  RESOLVED: { label: '해결', className: 'bg-accent/15 text-accent' },
  CLOSED: { label: '종료', className: 'bg-muted text-muted-foreground' },
};

const PRIORITY_MAP = {
  LOW: { label: '낮음', className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: '보통', className: 'bg-chart-3/15 text-chart-3' },
  HIGH: { label: '높음', className: 'bg-destructive/15 text-destructive' },
  URGENT: { label: '긴급', className: 'bg-destructive text-destructive-foreground' },
};

export default function ASRequests() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [] } = useQuery({
    queryKey: ['as-requests'],
    queryFn: () => base44.entities.ASRequest.list('-created_date', 50),
  });

  const [form, setForm] = useState({
    client_name: '', machine_category: '', issue_title: '',
    issue_description: '', media_urls: [], priority: 'MEDIUM', status: 'RECEIVED',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ASRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['as-requests'] });
      setOpen(false);
      setForm({ client_name: '', machine_category: '', issue_title: '', issue_description: '', media_urls: [], priority: 'MEDIUM', status: 'RECEIVED' });
      toast({ title: 'AS 접수 완료' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ASRequest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['as-requests'] }),
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleMediaUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, media_urls: [...prev.media_urls, file_url] }));
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AS 접수</h1>
          <p className="text-sm text-muted-foreground mt-1">고객사 AS 인테이크 및 처리 관리</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />AS 접수</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>원클릭 AS 접수</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <Label>고객사명 *</Label>
                <Input value={form.client_name} onChange={(e) => handleChange('client_name', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>장비 카테고리</Label>
                  <Select value={form.machine_category} onValueChange={(v) => handleChange('machine_category', v)}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>우선순위</Label>
                  <Select value={form.priority} onValueChange={(v) => handleChange('priority', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>결함 제목 *</Label>
                <Input value={form.issue_title} onChange={(e) => handleChange('issue_title', e.target.value)} required />
              </div>
              <div>
                <Label>상세 설명</Label>
                <Textarea value={form.issue_description} onChange={(e) => handleChange('issue_description', e.target.value)} rows={3} />
              </div>
              <div>
                <Label>사진/영상 첨부</Label>
                <DropZone
                  onFile={handleMediaUpload}
                  uploading={uploading}
                  accept="image/*,video/*"
                  label="드래그 또는 클릭하여 업로드"
                  className="mt-1"
                />
                {form.media_urls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {form.media_urls.map((url, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
                <Button type="submit" disabled={createMutation.isPending}>접수</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">AS 접수 내역이 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const st = STATUS_MAP[r.status] || STATUS_MAP.RECEIVED;
            const pr = PRIORITY_MAP[r.priority] || PRIORITY_MAP.MEDIUM;
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{r.issue_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.client_name} · {CATEGORY_LABELS[r.machine_category] || '-'}</p>
                        {r.issue_description && (
                          <p className="text-xs text-muted-foreground mt-1.5 max-w-md">{r.issue_description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${pr.className} border-0 text-[10px]`}>{pr.label}</Badge>
                      <Select
                        value={r.status}
                        onValueChange={(v) => updateMutation.mutate({ id: r.id, data: { status: v } })}
                      >
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_MAP).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}