import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

// 고객사 카드의 이메일로 고객사 팀 생성 + 담당자 초대 (TaskCard 는 client_id 로 자동 연동)
export default function CreateClientTeamButton({ company, hasTeam }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(company.email || '');
  const { toast } = useToast();
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: async () => (await base44.functions.invoke('provisionClientTeam', { company_id: company.id, emails: [email] })).data,
    onSuccess: () => { toast({ title: hasTeam ? '담당자를 초대했습니다' : '고객사 팀을 생성했습니다', description: email }); setOpen(false); qc.invalidateQueries({ queryKey: ['client-tenants'] }); },
    onError: (e) => toast({ title: '팀 생성 실패', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  return (
    <>
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8" onClick={() => { setEmail(company.email || ''); setOpen(true); }}>
        <UserPlus className="w-3.5 h-3.5" />{hasTeam ? '팀 담당자 초대' : '고객사 팀 생성'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{company.company_name} · {hasTeam ? '담당자 초대' : '고객사 팀 생성'}</DialogTitle>
            <DialogDescription>이 고객사와 연결된 업무 카드가 고객 포털에 바로 연동됩니다.</DialogDescription>
          </DialogHeader>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button disabled={!email || run.isPending} onClick={() => run.mutate()}>
              {run.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{hasTeam ? '초대' : '생성 및 초대'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}