import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Loader2, Plus, X, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// 리드 → 고객사 팀 생성 및 담당자 초대. 다중 담당자를 허용하되 초대는 어드민만 수행한다.
export default function LeadProvisionPanel({ lead }) {
  const [emails, setEmails] = useState([lead.email]);
  const [draft, setDraft] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();

  const addEmail = () => {
    const e = draft.trim().toLowerCase();
    if (!e || emails.includes(e)) return;
    setEmails((prev) => [...prev, e]);
    setDraft('');
  };

  const provision = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('provisionClientTeam', { lead_id: lead.id, emails });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['manufacturing-leads'] });
      qc.invalidateQueries({ queryKey: ['task-cards'] });
      toast({ title: '고객사 팀이 발급되었습니다', description: `${data.invited?.length || 0}명에게 초대를 보냈습니다` });
    },
    onError: (err) => toast({ title: '발급 실패', description: err.message, variant: 'destructive' }),
  });

  const resetPassword = useMutation({
    mutationFn: async (email) => {
      const res = await base44.functions.invoke('resetClientPassword', { email });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => toast({ title: '비밀번호 재설정 메일이 발송되었습니다', description: lead.email }),
    onError: (err) => toast({ title: '발송 실패', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="border-t pt-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">고객사 팀 발급 및 초대</span>
        {lead.invitation_sent && <Badge variant="secondary" className="text-[10px]">발급됨</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {emails.map((e) => (
          <Badge key={e} variant="outline" className="gap-1 pr-1">
            {e}
            {emails.length > 1 && (
              <button type="button" onClick={() => setEmails((prev) => prev.filter((x) => x !== e))}>
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
          placeholder="담당자 이메일 추가"
          className="h-9"
        />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={addEmail}>
          <Plus className="w-4 h-4" />
        </Button>
        <Button disabled={provision.isPending} onClick={() => provision.mutate()} className="h-9 shrink-0">
          {provision.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lead.invitation_sent ? '초대 추가' : '팀 발급'}
        </Button>
      </div>
      {lead.invitation_sent && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={resetPassword.isPending}
            onClick={() => resetPassword.mutate(lead.email)}
          >
            {resetPassword.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            비밀번호 재설정 메일 발송
          </Button>
          <span className="text-[11px] text-muted-foreground">고객 이메일({lead.email})로 재설정 링크가 발송됩니다</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        고객은 초대 메일에서 가입한 뒤 비밀번호 설정 링크로 직접 비밀번호를 만듭니다. 비밀번호는 관리자에게 저장되거나 표시되지 않습니다.
        팀은 최초 1회만 생성되며 이후에는 같은 팀에 담당자 초대만 추가됩니다 (기본 좌석 2명).
      </p>
    </div>
  );
}