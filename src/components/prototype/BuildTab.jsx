import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import ProtoFiles from '@/components/prototype/ProtoFiles';
import BuildPartsTable from '@/components/prototype/BuildPartsTable';
import { ARTIFACT_CATEGORIES } from '@/lib/prototype';
import { actorName, errorText } from '@/lib/prototypeApi';

// 조립 기록: 실제 사용 부품·배선·펌웨어 버전을 승인 설계와 대조하고 산출물 파일을 연결한다
export default function BuildTab({ project, versions, user, onChanged }) {
  const v = versions.find((x) => x.id === project.current_version_id);
  const seed = () => {
    const b = project.build || {};
    const sameVersion = b.version_id === v?.id;
    const parts = sameVersion && b.actual_parts?.length ? b.actual_parts
      : (v?.bom || []).map((p) => ({ ref: p.ref, name: p.name, planned_part_no: p.part_no, actual_part_no: p.part_no, actual_manufacturer: p.manufacturer, status: 'MATCH', note: '' }));
    return { firmware_version: b.firmware_version || '', wiring_note: b.wiring_note || '', assembled_at: b.assembled_at || '', actual_parts: parts };
  };
  const [form, setForm] = useState(seed);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(seed()); }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.ProtoProject.update(project.id, {
        build: { ...form, version_id: v.id, version_no: v.version_no, updated_by_name: actorName(user) },
        stage: project.stage === 'BUILD' ? 'TEST' : project.stage,
      });
      onChanged();
      toast({ title: '조립 기록을 저장했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {!v ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">설계 버전을 승인하면 조립 대조표가 만들어집니다.</div>
      ) : (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-title font-semibold">조립 기록 · v{v.version_no} 대조</p>
              <p className="text-caption text-muted-foreground">실제로 단 부품이 설계와 다르면 ‘대체’ 또는 ‘누락’으로 표시하세요. AI 시험 분석에 함께 쓰입니다.</p>
            </div>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}저장</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>펌웨어 버전</Label><Input value={form.firmware_version} onChange={(e) => setForm({ ...form, firmware_version: e.target.value })} placeholder="예: fw-0.3.1 (git a1b2c3)" /></div>
            <div className="space-y-1.5"><Label>조립일</Label><Input type="date" value={form.assembled_at} onChange={(e) => setForm({ ...form, assembled_at: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>배선·조립 메모</Label><Textarea rows={3} value={form.wiring_note} onChange={(e) => setForm({ ...form, wiring_note: e.target.value })} placeholder="설계와 다른 배선, 점퍼, 수정 사항" /></div>
          <BuildPartsTable parts={form.actual_parts} onChange={(actual_parts) => setForm({ ...form, actual_parts })} />
        </div>
      )}
      <ProtoFiles project={project} user={user} categories={ARTIFACT_CATEGORIES} versionNo={v?.version_no} onChanged={onChanged} title="CAD · PCB · 코드 · 제조 산출물" />
    </div>
  );
}