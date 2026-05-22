import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Users, Mail, Phone, MapPin, FileText, Upload, Loader2, ExternalLink, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyClient = {
  company_type: 'CLIENT',
  company_name: '',
  contact_person: '',
  address: '',
  phone: '',
  email: '',
  memo: '',
  business_registration_url: '',
};

export default function Clients() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      handleClose();
      toast({ title: t('clients.add') });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      handleClose();
      toast({ title: t('clients.form.save') });
    },
  });

  const handleClose = () => {
    setOpen(false);
    setEditTarget(null);
    setForm(emptyClient);
  };

  const openEdit = (client) => {
    setEditTarget(client);
    setForm({ ...emptyClient, ...client });
    setOpen(true);
  };

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, business_registration_url: file_url }));
    setUploading(false);
    toast({ title: t('common.upload') });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('clients.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />{t('clients.add')}
        </Button>
      </div>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('clients.form.edit') : t('clients.form.new')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <Label className="text-xs">{t('clients.form.company')}</Label>
              <Input value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} placeholder={t('clients.form.company.placeholder')} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('clients.form.contact')}</Label>
                <Input value={form.contact_person} onChange={(e) => handleChange('contact_person', e.target.value)} placeholder="홍길동" />
              </div>
              <div>
                <Label className="text-xs">{t('clients.form.phone')}</Label>
                <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="010-0000-0000" />
              </div>
            </div>

            <div>
              <Label className="text-xs">{t('clients.form.email')}</Label>
              <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="contact@company.com" />
            </div>

            <div>
              <Label className="text-xs">{t('clients.form.address')}</Label>
              <Input value={form.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="서울특별시 강남구 ..." />
            </div>

            <div>
              <Label className="text-xs">{t('clients.form.brn')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? t('common.uploading') : t('clients.form.fileselect')}
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" />
                </label>
                {form.business_registration_url && (
                  <a href={form.business_registration_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />{t('clients.form.fileview')}
                  </a>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs">{t('clients.form.memo')}</Label>
              <Input value={form.memo} onChange={(e) => handleChange('memo', e.target.value)} placeholder={t('clients.form.memo.placeholder')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isPending || uploading}>
                {editTarget ? t('clients.form.save') : t('common.register')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 고객사 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">{t('clients.empty')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('clients.empty.hint')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-lg transition-shadow group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.company_name}</CardTitle>
                    {c.contact_person && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t('clients.contact')} {c.contact_person}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{t('clients.badge')}</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEdit(c)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="line-clamp-1">{c.address}</span>
                  </div>
                )}
                {c.business_registration_url && (
                  <a href={c.business_registration_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs">{t('clients.brn.view')}</span>
                  </a>
                )}
                {c.memo && (
                  <p className="text-[11px] text-muted-foreground/70 pt-1 border-t line-clamp-2">{c.memo}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}