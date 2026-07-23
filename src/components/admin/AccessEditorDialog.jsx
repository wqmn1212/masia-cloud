import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AccessEditorDialog({ member, roles, onChange, onClose, onSave, saving }) {
  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>사용자 역할 및 권한</DialogTitle></DialogHeader>
        {member && <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{member.email}</p>
          <div>
            <Label>팀 역할</Label>
            <Select value={member.team_role_id || ''} onValueChange={(team_role_id) => onChange({ ...member, team_role_id })}>
              <SelectTrigger><SelectValue placeholder="역할을 선택하세요" /></SelectTrigger>
              <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name} · 메뉴 {(role.menu_paths || []).length}개</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">선택한 역할의 메뉴 권한이 이 팀원에게 자동으로 적용됩니다.</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>취소</Button><Button disabled={saving || !member.team_role_id} onClick={onSave}>저장</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}