import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { TEAM_MENU_OPTIONS } from '@/lib/menuPermissions';

export default function TeamPermissionGrid({ tenantId }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TEAM_MENU_OPTIONS.map((item) => (
        <Link
          key={item.path}
          to={`${item.path}?tenantId=${tenantId}`}
          className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium">{item.label}</span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}