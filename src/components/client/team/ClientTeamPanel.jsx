import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { CLIENT_ROLES, ROLE_LABEL, ROLE_DESC, APPROVAL_KIND_LABEL, AMOUNT_KINDS, validateTeam } from '@/lib/clientRoles';

// 고객사 팀: 동료·역할·결재 규칙. 고객 관리자는 자기 회사를, 직원(고객사 관리)은 companyId 로 지정한 회사를 다룬다.
// 다른 고객 계정에게는 읽기 전용으로 보인다. 저장·검사는 manageClientTeam 서버 함수가 한다.
export function useClientTeam(companyId) {
  return useQuery({
    queryKey: ['client-team', companyId || 'me'],
    queryFn: async () => (await base44.functions.invoke('manageClientTeam', companyId ? { action: 'list', company_id: companyId } : withClientView({ action: 'list' }))).data,
  });
}

function RoleToggle({ role, on, disabled, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on} title={ROLE_DESC[role]}
      className={cn('rounded-full border px-2 py-0.5 text-caption transition', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50', disabled && 'cursor-default opacity-60')}>
      {ROLE_LABEL[role]}
    </button>
  );
}

export function useTeamMutation(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await base44.functions.invoke('manageClientTeam', companyId ? { ...body, company_id: companyId } : withClientView(body))).data,
    onSuccess: (data) => {
      qc.setQueryData(['client-team', companyId || 'me'], data);
      qc.invalidateQueries({ queryKey: ['client-todos'] });
    },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
}

export default function ClientTeamPanel({ companyId, staff = false }) {
  const { data, isLoading, isError } = useClientTeam(companyId);
  const save = useTeamMutation(companyId);
  const [emails, setEmails] = useState('');
  const [inviteRoles, setInviteRoles] = useState(['MEMBER']);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (isError || !data) return <p className="py-6 text-center text-label text-destructive">팀 정보를 불러오지 못했습니다.</p>;
  const manage = data.can_manage;
  const busy = save.isPending;
  const members = data.members || [];
  const setRoles = (m, role) => {
    const roles = m.roles.includes(role) ? m.roles.filter((r) => r !== role) : [...m.roles, role];
    const next = members.map((x) => (x.email === m.email ? { ...x, roles } : x));
    const problem = validateTeam(next, data.rules);
    if (problem) { toast({ title: problem, variant: 'destructive' }); return; }
    save.mutate({ action: 'set_roles', email: m.email, roles });
  };
  const invite = (e) => {
    e.preventDefault();
    const list = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!list.length) return;
    save.mutate({ action: 'invite', emails: list, roles: data.has_setup ? inviteRoles : [] }, {
      onSuccess: (d) => { setEmails(''); toast({ title: `${d.invited?.length || list.length}명에게 초대 메일을 보냈습니다`, description: '받은 메일의 링크로 비밀번호를 정하면 바로 쓸 수 있습니다.' }); },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto flex items-center gap-1.5 text-body font-semibold"><Users className="h-4 w-4 text-primary" />{staff ? `${data.company_name} 고객 계정` : '우리 회사 계정'}</h3>
        <span className="text-caption text-muted-foreground">자리 {data.seats_used} / {data.seat_limit}명</span>
      </div>
      {!data.has_setup && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-label text-muted-foreground">
          {staff ? '아직 역할을 정하지 않은 고객사입니다. 지금은 모든 계정이 같은 권한으로 결정합니다. 고객 관리자를 한 명 정하면 고객이 직접 동료를 초대하고 역할과 결재 규칙을 정할 수 있습니다.'
            : '아직 역할을 정하지 않았습니다. 지금은 모든 계정이 같은 권한으로 결정합니다. 역할과 사내 결재를 쓰려면 이지스 담당자에게 고객 관리자 지정을 요청해 주세요.'}
        </p>
      )}
      <ul className="divide-y rounded-lg border">
        {members.map((m) => (
          <li key={m.email} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5', !m.active && 'opacity-60')}>
            <div className="min-w-[180px] flex-1">
              <p className="truncate text-label font-medium">{m.name || m.email}{m.is_me && <span className="ml-1 text-caption text-muted-foreground">(나)</span>}</p>
              <div className="flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
                {m.name && <span className="truncate">{m.email}</span>}
                {m.pending && <Badge variant="outline" className="text-micro">초대 대기</Badge>}
                {!m.active && <Badge variant="outline" className="text-micro">사용 중지</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {manage && m.active
                ? CLIENT_ROLES.map((r) => <RoleToggle key={r} role={r} on={m.roles.includes(r)} disabled={busy} onClick={() => setRoles(m, r)} />)
                : m.roles.length ? m.roles.map((r) => <Badge key={r} variant="secondary" className="text-micro">{ROLE_LABEL[r]}</Badge>)
                : data.has_setup && m.active ? <span className="text-caption text-muted-foreground">역할 없음 (실무자로 봄)</span> : null}
            </div>
            {manage && !m.is_me && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-caption text-muted-foreground" disabled={busy}
                onClick={() => (m.active ? window.confirm(`${m.email} 계정을 사용 중지할까요?${m.pending ? ' 초대가 취소됩니다.' : ' 로그인할 수 없게 되고 역할도 빠집니다.'}`) : true) && save.mutate({ action: 'set_active', email: m.email, active: !m.active })}>
                {m.active ? (m.pending ? '초대 취소' : '사용 중지') : '다시 사용'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <form onSubmit={invite} className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="flex items-center gap-1.5 text-label font-semibold"><UserPlus className="h-4 w-4 text-primary" />동료 초대</p>
          <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="메일 주소 (여러 명은 쉼표로)" className="text-label" disabled={busy} />
          {data.has_setup && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-caption text-muted-foreground">역할</span>
              {CLIENT_ROLES.map((r) => <RoleToggle key={r} role={r} on={inviteRoles.includes(r)} disabled={busy} onClick={() => setInviteRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} />)}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-muted-foreground">자리가 모자라면 이지스 담당자에게 늘려 달라고 요청해 주세요.</p>
            <Button type="submit" size="sm" disabled={busy || !emails.trim()}>{busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}초대 메일 보내기</Button>
          </div>
        </form>
      )}
      <dl className="grid gap-1 text-caption text-muted-foreground sm:grid-cols-2">
        {CLIENT_ROLES.map((r) => <div key={r}><dt className="inline font-medium text-foreground">{ROLE_LABEL[r]}</dt> <dd className="inline">· {ROLE_DESC[r]}</dd></div>)}
      </dl>
    </div>
  );
}

// 결재 규칙: 결정 종류별 결재 필요(금액 기준) · 자기 요청 결재 막기
export function ClientApprovalRulesPanel({ companyId }) {
  const { data, isLoading } = useClientTeam(companyId);
  const save = useTeamMutation(companyId);
  const [rules, setRules] = useState(null);
  useEffect(() => { if (data?.rules) setRules(data.rules); }, [data?.rules]);
  if (isLoading || !rules) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const manage = data.can_manage && data.has_setup;
  const set = (kind, patch) => setRules((r) => ({ ...r, kinds: { ...r.kinds, [kind]: { ...r.kinds[kind], ...patch } } }));
  const problem = validateTeam(data.members.filter((m) => m.active), rules);
  const dirty = JSON.stringify(rules) !== JSON.stringify(data.rules);

  return (
    <div className="space-y-3">
      <p className="text-label text-muted-foreground">켠 결정은 실무자가 누르면 '결재 요청'이 되고, 결재권자가 승인해야 이지스에 전달됩니다. 보류·수정 요청은 결재 없이 바로 전달됩니다.</p>
      {!data.has_setup && <p className="rounded-lg bg-muted/50 px-3 py-2 text-label text-muted-foreground">역할을 먼저 정해야 결재 규칙을 쓸 수 있습니다.</p>}
      <ul className="divide-y rounded-lg border">
        {Object.entries(APPROVAL_KIND_LABEL).map(([kind, label]) => (
          <li key={kind} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <Switch checked={rules.kinds[kind]?.on === true} disabled={!manage || save.isPending} onCheckedChange={(on) => set(kind, { on })} aria-label={`${label} 결재 필요`} />
            <span className="min-w-[96px] flex-1 text-label font-medium">{label}</span>
            {AMOUNT_KINDS.includes(kind) && rules.kinds[kind]?.on && (
              <label className="flex items-center gap-1.5 text-caption text-muted-foreground">
                금액 기준
                <Input type="number" min={0} step={100000} value={rules.kinds[kind]?.min_amount_krw ?? ''} disabled={!manage || save.isPending}
                  onChange={(e) => set(kind, { min_amount_krw: e.target.value === '' ? null : Number(e.target.value) })} placeholder="없음" className="h-8 w-32 text-right text-label tabular-nums" />
                원 이상만{rules.kinds[kind]?.min_amount_krw >= 10000 && <span className="tabular-nums">({Math.round(rules.kinds[kind].min_amount_krw / 10000).toLocaleString('ko-KR')}만원)</span>}
              </label>
            )}
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <Switch checked={rules.block_self_approval === true} disabled={!manage || save.isPending} onCheckedChange={(v) => setRules((r) => ({ ...r, block_self_approval: v }))} aria-label="자기 요청 결재 막기" />
          <span className="flex-1 text-label"><b className="font-medium">결재권자도 다른 결재권자의 결재를 받기</b><span className="block text-caption text-muted-foreground">끄면 결재권자가 직접 누른 결정은 바로 전달됩니다. 켜려면 결재권자가 두 명 이상 있어야 합니다.</span></span>
        </li>
      </ul>
      <p className="text-caption text-muted-foreground">금액은 견적·비교표 총액을 원화로 바꿔 봅니다. 환율을 알 수 없으면 기준 이상으로 보고 결재를 받습니다.</p>
      {manage && (
        <div className="flex items-center justify-end gap-2">
          {problem && <p className="mr-auto text-caption text-destructive">{problem}</p>}
          <Button type="button" variant="ghost" size="sm" disabled={!dirty || save.isPending} onClick={() => setRules(data.rules)}>되돌리기</Button>
          <Button type="button" size="sm" disabled={!dirty || !!problem || save.isPending} onClick={() => save.mutate({ action: 'set_rules', rules }, { onSuccess: () => toast({ title: '결재 규칙을 저장했습니다' }) })}>
            {save.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}저장
          </Button>
        </div>
      )}
    </div>
  );
}
