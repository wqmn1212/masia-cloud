import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PermissionPicker from '@/components/admin/PermissionPicker';

export default function RoleEditorDialog({ role, onChange, onClose, onSave, saving }) {
  return <Dialog open={!!role} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{role?.id ? '역할 수정' : '새 역할 만들기'}</DialogTitle></DialogHeader>
      {role && <div className="space-y-4">
        <div><Label>역할명</Label><Input value={role.name} onChange={(e) => onChange({ ...role, name: e.target.value })} placeholder="예: 생산 관리자" /></div>
        <div><Label>설명</Label><Input value={role.description || ''} onChange={(e) => onChange({ ...role, description: e.target.value })} placeholder="이 역할의 담당 범위" /></div>
        <div><Label>접근 허용 메뉴</Label><PermissionPicker value={role.menu_paths || []} onChange={(menu_paths) => onChange({ ...role, menu_paths })} /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>취소</Button><Button disabled={saving || !role.name.trim()} onClick={onSave}>저장</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}