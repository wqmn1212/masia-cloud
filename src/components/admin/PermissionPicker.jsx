import { Checkbox } from '@/components/ui/checkbox';
import { TEAM_MENU_OPTIONS } from '@/lib/menuPermissions';

export default function PermissionPicker({ value, onChange }) {
  const toggle = (path, checked) => onChange(
    checked ? [...new Set([...value, path])] : value.filter(item => item !== path)
  );

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
      {TEAM_MENU_OPTIONS.map(item => (
        <label key={item.path} className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={value.includes(item.path)} onCheckedChange={checked => toggle(item.path, checked)} />
          {item.label}
        </label>
      ))}
    </div>
  );
}