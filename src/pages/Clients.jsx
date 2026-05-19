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
import { Plus, Users, Mail, Phone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyClient = {
  company_type: 'CLIENT',
  company_name: '',
  contact_person: '',
  phone: '',
  email: '',
};

export default function Clients() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setOpen(false);
      setForm(emptyClient);
      toast({ title: '고객사 등록 완료' });
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">고객사 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">한국 바이어 고객사 관리</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />신규 고객사 등록</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>고객사 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <Label>회사명 *</Label>
                <Input value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} required />
              </div>
              <div>
                <Label>담당자명</Label>
                <Input value={form.contact_person} onChange={(e) => handleChange('contact_person', e.target.value)} />
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
                <Button type="submit" disabled={createMutation.isPending}>등록</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted" />)}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">등록된 고객사가 없습니다</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{c.company_name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">고객사</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {c.contact_person && <p>담당: {c.contact_person}</p>}
                {c.phone && (
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{c.phone}</div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{c.email}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}