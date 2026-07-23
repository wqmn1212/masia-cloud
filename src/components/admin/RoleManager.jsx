import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pencil, Plus, Trash2 } from 'lucide-react';

export default function RoleManager({ roles, onCreate, onEdit, onDelete, deleting }) {
  return <Card>
    <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">역할 템플릿</CardTitle><Button size="sm" onClick={onCreate}><Plus className="w-4 h-4" />역할 추가</Button></CardHeader>
    <CardContent className="space-y-2">
      {roles.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">역할을 만들어 메뉴 권한을 그룹화하세요</p> : roles.map((role) =>
        <div key={role.id} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{role.name}</p><p className="text-xs text-muted-foreground truncate">{role.description || '설명 없음'}</p></div>
          <Badge variant="secondary">메뉴 {(role.menu_paths || []).length}개</Badge>
          <Button size="icon" variant="ghost" onClick={() => onEdit(role)}><Pencil className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" disabled={deleting} onClick={() => onDelete(role)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>)}
    </CardContent>
  </Card>;
}