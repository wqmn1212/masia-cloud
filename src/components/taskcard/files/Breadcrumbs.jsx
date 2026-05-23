import { Home, ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ path, onNavigate }) {
  return (
    <div className="flex items-center gap-1 text-xs flex-wrap min-w-0">
      <button
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 hover:text-primary text-muted-foreground px-2 py-1 rounded hover:bg-accent/40"
      >
        <Home className="w-3.5 h-3.5" />
        <span>루트</span>
      </button>
      {path.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
          <button
            onClick={() => onNavigate(i)}
            className={`px-2 py-1 rounded hover:bg-accent/40 truncate max-w-[140px] ${
              i === path.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-primary'
            }`}
            title={p.name}
          >
            {p.name}
          </button>
        </span>
      ))}
    </div>
  );
}