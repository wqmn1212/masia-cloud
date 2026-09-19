import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TEAM_MENU_OPTIONS } from '@/lib/menuPermissions';

export default function InvitePermissionPicker({ value, onChange }) {
  const toggle = (path, checked) => {
    onChange(checked ? [...value, path] : value.filter((item) => item !== path));
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>접근 가능 기능</Label>
        <p className="text-xs text-muted-foreground">초대할 팀원이 사용할 기능을 선택하세요.</p>
      </div>
      <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3">
        {TEAM_MENU_OPTIONS.map((item) => {
          const id = `invite-permission-${item.path.slice(1)}`;
          return (
            <div key={item.path} className="flex items-center gap-2">
              <Checkbox id={id} checked={value.includes(item.path)} onCheckedChange={(checked) => toggle(item.path, checked === true)} />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{item.label}</Label>
            </div>
          );
        })}
      </div>
      {value.length === 0 && <p className="text-xs text-destructive">한 개 이상의 기능을 선택하세요.</p>}
    </div>
  );
}