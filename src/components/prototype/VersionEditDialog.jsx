import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import RowsEditor from '@/components/prototype/RowsEditor';
import { VERIFY_STATUS } from '@/lib/prototype';
import { actorName, errorText } from '@/lib/prototypeApi';

const BOM_COLS = [
  { key: 'ref', label: 'Ref', width: 60 }, { key: 'name', label: '부품명', width: 140 }, { key: 'manufacturer', label: '제조사' },
  { key: 'part_no', label: '부품번호', width: 140 }, { key: 'footprint', label: '실장 모양', width: 90 }, { key: 'qty', label: '수량', width: 56, type: 'number' }, { key: 'voltage', label: '전압', width: 80 },
  { key: 'current', label: '전류', width: 80 }, { key: 'interface', label: '인터페이스' },
  { key: 'verify_status', label: '검증', options: Object.entries(VERIFY_STATUS).map(([value, m]) => ({ value, label: m.label })) },
  { key: 'basis', label: '근거', width: 180 },
];
const CONN_COLS = [{ key: 'from', label: '출발', width: 130 }, { key: 'to', label: '도착', width: 130 }, { key: 'signal', label: '신호' }, { key: 'voltage', label: '전압', width: 80 }, { key: 'note', label: '메모', width: 180 }];
const TEXTS = [
  ['summary', '요약'], ['operating_principle', '동작 원리'], ['power_budget', '전원 예산'], ['circuit_notes', '회로 설계 메모'],
  ['mechanical_notes', '사출 구조'], ['mold_notes', '금형 설계 초안'], ['firmware_notes', '펌웨어 설명'], ['firmware_draft', '펌웨어 초안 코드'],
];

// 설계 초안 수정 — 수정하면 '검토 중'이 되고 이력이 남는다
export default function VersionEditDialog({ version, open, onOpenChange, user, onSaved }) {
  const [form, setForm] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && version) { setForm({ ...version }); setNote(''); } }, [open, version]);
  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      const patch = Object.fromEntries([...TEXTS.map(([k]) => k), 'bom', 'connections'].map((k) => [k, form[k] ?? null]));
      const history = [...(version.history || []), { at: new Date().toISOString(), by: actorName(user), action: '수정', note }];
      await base44.entities.ProtoDesignVersion.update(version.id, { ...patch, status: 'REVIEW', history });
      onSaved();
    } catch (e) { window.alert(errorText(e)); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-title">v{version.version_no} 설계 수정</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5"><Label>PCB 부품표</Label><RowsEditor rows={form.bom} columns={BOM_COLS} onChange={(bom) => setForm({ ...form, bom })} addLabel="부품 추가" /></div>
          <div className="space-y-1.5"><Label>연결 관계</Label><RowsEditor rows={form.connections} columns={CONN_COLS} onChange={(connections) => setForm({ ...form, connections })} addLabel="연결 추가" /></div>
          <div className="grid gap-4 md:grid-cols-2">
            {TEXTS.map(([k, label]) => (
              <div key={k} className={`space-y-1.5 ${k === 'firmware_draft' ? 'md:col-span-2' : ''}`}>
                <Label>{label}</Label>
                <Textarea rows={k === 'firmware_draft' ? 12 : 4} className={k === 'firmware_draft' ? 'font-mono' : ''} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="space-y-1.5"><Label>수정 사유</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: MCU를 STM32G0로 변경, 5V 레귤레이터 전류 여유 확보" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}저장하고 검토 요청</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}