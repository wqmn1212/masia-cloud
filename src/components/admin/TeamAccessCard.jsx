import { Link } from 'react-router-dom';
import { Building2, ChevronRight, MoreVertical, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function TeamAccessCard({ tenant, admin, isOwnTeam, onToggle, onDelete, disabled }) {
  const active = tenant.is_active !== false;
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${active ? '' : 'bg-red-50/50 border-red-200'}`}>
      <Link to={`/master-admin/teams/${tenant.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{tenant.name}</p>
            <Badge variant="outline" className={active ? 'bg-green-50 text-green-700 border-green-200 text-[10px]' : 'bg-red-50 text-red-700 border-red-200 text-[10px]'}>
              {active ? '활성' : '중지됨'}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{admin?.email || tenant.master_email || '팀 마스터 미지정'}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
      {!isOwnTeam && (
        <>
          <Switch checked={active} onCheckedChange={onToggle} disabled={disabled} aria-label="팀 활성 상태" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onDelete}><Trash2 className="h-4 w-4" />팀 삭제</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}