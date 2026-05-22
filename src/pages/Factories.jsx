import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Plus, Factory, MapPin, Users, Calendar, DollarSign } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyFactory = {
  company_type: 'FACTORY',
  company_name: '',
  factory_address: '',
  annual_revenue: '',
  employee_count: '',
  establishment_date: '',
  contact_person: '',
  wechat_id: '',
  phone: '',
  email: '',
};

export default function Factories() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyFactory);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: factories = [], isLoading } = useQuery({
    queryKey: ['companies-factory'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }, 'company_name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create({
      ...data,
      annual_revenue: data.annual_revenue ? Number(data.annual_revenue) : undefined,
      employee_count: data.employee_count ? Number(data.employee_count) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies-factory'] });
      setOpen(false);
      setForm(emptyFactory);
      toast({ title: '공장 등록 완료', description: '신규 공장이 성공적으로 등록되었습니다.' });
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공장 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">중국 현지 공장 마스터 프로필 관리</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />신규 공장 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>공장 프로필 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <Label>공장명 *</Label>
                <Input value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} placeholder="공장 법인명" required />
              </div>
              <div>
                <Label>공장 주소 *</Label>
                <Input value={form.factory_address} onChange={(e) => handleChange('factory_address', e.target.value)} placeholder="중국 공장 주소" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>연간 매출액 (CNY) *</Label>
                  <Input type="number" value={form.annual_revenue} onChange={(e) => handleChange('annual_revenue', e.target.value)} placeholder="0" required />
                </div>
                <div>
                  <Label>임직원 수 *</Label>
                  <Input type="number" value={form.employee_count} required onChange={(e) => handleChange('employee_count', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>설립일 *</Label>
                <Input type="date" value={form.establishment_date} onChange={(e) => handleChange('establishment_date', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>담당자명</Label>
                  <Input value={form.contact_person} onChange={(e) => handleChange('contact_person', e.target.value)} />
                </div>
                <div>
                  <Label>위챗 ID</Label>
                  <Input value={form.wechat_id} onChange={(e) => handleChange('wechat_id', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>전화번호</Label>
                  <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                </div>
                <div>
                  <Label>이메일</Label>
                  <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? '등록 중...' : '등록'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}
        </div>
      ) : factories.length === 0 ? (
        <Card className="p-12 text-center">
          <Factory className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">등록된 공장이 없습니다</p>
          <p className="text-sm text-muted-foreground mt-1">신규 공장을 등록해 주세요</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {factories.map((f) => (
            <Card key={f.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{f.company_name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">공장</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {f.factory_address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{f.factory_address}</span>
                  </div>
                )}
                {f.employee_count && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{f.employee_count}명</span>
                  </div>
                )}
                {f.annual_revenue && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>¥{Number(f.annual_revenue).toLocaleString()}</span>
                  </div>
                )}
                {f.establishment_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{f.establishment_date}</span>
                  </div>
                )}
                {f.contact_person && (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                    담당: {f.contact_person} {f.wechat_id && `(WeChat: ${f.wechat_id})`}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}