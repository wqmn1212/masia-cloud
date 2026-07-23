import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PermissionPicker from '@/components/admin/PermissionPicker';

export default function AccessEditorDialog({ member, onChange, onClose, onSave, saving }) {
  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>사용자 역할 및 권한</DialogTitle></DialogHeader>
        {member && <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{member.email}</p>
          <div>
            <Label>팀 역할</Label>
            <Select value={member.team_role || 'member'} onValueChange={(team_role) => onChange({ ...member, team_role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">관리자 · 운영 기능 접근</SelectItem>
                <SelectItem value="member">일반 멤버 · 지정 메뉴 접근</SelectItem>
                <SelectItem value="viewer">조회 전용 · 지정 메뉴 열람</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>접근 허용 기능</Label><PermissionPicker value={member.allowed_tabs || []} onChange={(allowed_tabs) => onChange({ ...member, allowed_tabs })} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>취소</Button><Button disabled={saving} onClick={onSave}>저장</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}