import { Link } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';

export default function TeamAccessCard({ tenant, admin }) {
  return (
    <Link
      to={`/master-admin/teams/${tenant.id}`}
      className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{tenant.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {admin?.email || tenant.master_email || '팀 마스터 미지정'}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}