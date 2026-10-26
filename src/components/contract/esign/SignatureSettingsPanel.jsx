import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Stamp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';

// 마스터 전용: 전자서명 완료본의 이지스 서명자(대표 이름·직책·회사명)와 직인 이미지. 직인은 비공개 저장소에 둔다.
export default function SignatureSettingsPanel({ user }) {
  const qc = useQueryClient();
  const { data: setting, isLoading } = useQuery({
    queryKey: ['operation-setting', user?.tenant_id],
    queryFn: async () => (await base44.entities.OperationSetting.filter({ tenant_id: user.tenant_id }, '-updated_date', 1))[0] || null,
  });
  const [f, setF] = useState({ name: '', title: '대표', company: 'DONGGUAN AEGIS TRADE CO., LTD' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (setting) setF({ name: setting.signature_rep_name || '', title: setting.signature_rep_title || '대표', company: setting.signature_company || 'DONGGUAN AEGIS TRADE CO., LTD' }); }, [setting]);
  if (user?.account_tier !== 'master' || isLoading) return null;

  const save = async (patch) => {
    setBusy(true);
    try {
      if (setting) await base44.entities.OperationSetting.update(setting.id, patch);
      else await base44.entities.OperationSetting.create({ tenant_id: user.tenant_id, ...patch });
      qc.invalidateQueries({ queryKey: ['operation-setting', user.tenant_id] });
      toast({ title: '전자서명 서명자 정보를 저장했습니다' });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const uploadSeal = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 600 * 1024) { toast({ title: 'PNG·JPG, 600KB 이하 이미지만 올릴 수 있습니다', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await save({ signature_seal_uri: file_uri, signature_seal_updated_at: new Date().toISOString(), signature_seal_updated_by: user.full_name || user.email || '' });
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Stamp className="h-4 w-4 text-primary" />전자서명 이지스 서명자</p>
        <p className="text-xs text-muted-foreground">서명 요청을 보낼 때 이 정보가 고정되어 완료본의 전자서명 확인서에 들어갑니다. 마스터만 바꿀 수 있습니다.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="대표 이름" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="직책" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input placeholder="회사명" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy || !f.name.trim()} onClick={() => save({ signature_rep_name: f.name.trim(), signature_rep_title: f.title.trim(), signature_company: f.company.trim() })}>{busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}저장</Button>
          <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            직인 이미지 {setting?.signature_seal_uri ? '바꾸기' : '올리기'}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => uploadSeal(e.target.files?.[0])} />
          </label>
          <span className="text-[11px] text-muted-foreground">{setting?.signature_seal_uri ? `직인 등록됨 · ${setting.signature_seal_updated_by || ''} ${setting.signature_seal_updated_at ? new Date(setting.signature_seal_updated_at).toLocaleDateString('ko-KR') : ''}` : '직인 미등록 (확인서에 "이미지 없음"으로 표시)'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
