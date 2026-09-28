import { useMemo, useState } from 'react';
import { Search, Trash2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TIER_LABELS = { service: '팀 마스터', sub: '팀원', client: '고객' };

export default function AccountDirectory({ accounts, tenants, onToggle, onDelete, disabled }) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('all');
  const teamName = useMemo(() => Object.fromEntries(tenants.map((t) => [t.id, t.name])), [tenants]);
  const q = query.trim().toLowerCase();
  const rows = accounts.filter((a) => (tier === 'all' || a.account_tier === tier) && (!q || [a.full_name, a.email, teamName[a.tenant_id], TIER_LABELS[a.account_tier]].some((v) => String(v || '').toLowerCase().includes(q))));

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름·이메일·팀·등급 검색" />
        </div>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 등급</SelectItem>
            {Object.entries(TIER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">계정을 막으려면 스위치로 비활성 처리하세요. 삭제는 되돌릴 수 없는 별도 작업입니다.</p>
      <div className="max-h-[520px] divide-y overflow-y-auto">
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다</p> : rows.map((a) => {
          const active = a.is_active !== false;
          return (
            <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><User className="h-4 w-4 text-muted-foreground" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{a.full_name || a.email}</span>
                  <Badge variant="outline" className="text-[10px]">{TIER_LABELS[a.account_tier]}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{teamName[a.tenant_id] || '소속 팀 없음'}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
              </div>
              <Badge variant="outline" className={active ? 'bg-green-50 text-green-700 border-green-200 text-[10px]' : 'bg-red-50 text-red-700 border-red-200 text-[10px]'}>{active ? '활성' : '비활성'}</Badge>
              <Switch checked={active} onCheckedChange={(v) => onToggle(a, v)} disabled={disabled} aria-label="계정 활성 상태" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(a)} aria-label="계정 삭제"><Trash2 /></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}