import { Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function FileVisibilitySwitch({ visible, onChange, disabled = false }) {
  return <div className={`flex items-center gap-1 transition-opacity ${visible ? 'text-primary' : 'text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'}`}>
    {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    <Switch className="scale-75" checked={visible === true} onCheckedChange={onChange} disabled={disabled} aria-label="고객 노출" title={visible ? '고객에게 공개 중' : '고객에게 비공개'} />
  </div>;
}