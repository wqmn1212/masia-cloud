import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RESULT = { PASS: '합격', CONDITIONAL_PASS: '조건부 합격', FAIL: '불합격' };

export default function MilestoneCompleteDialog({ milestone, cardId, onClose, onConfirm }) {
  const [actual, setActual] = useState('');
  const [shift, setShift] = useState(true);
  const [qcId, setQcId] = useState('');
  const [busy, setBusy] = useState(false);
  const needsQc = !!milestone?.needs_qc_report;
  const { data: reports = [] } = useQuery({ queryKey: ['qc-reports', cardId], queryFn: () => base44.entities.QCReport.filter({ card_id: cardId }, '-created_date', 50), enabled: needsQc });
  useEffect(() => { if (milestone) { setActual(new Date().toISOString().slice(0, 10)); setShift(true); setQcId(milestone.qc_report_id || ''); } }, [milestone]);
  if (!milestone) return null;
  const late = milestone.planned_date && actual > milestone.planned_date;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-base">{milestone.label} 완료</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">실제 완료일</Label><Input type="date" value={actual} onChange={(e) => setActual(e.target.value)} /></div>
          {needsQc && (
            <div>
              <Label className="text-xs">QC 보고서 연결 (필수)</Label>
              {reports.length ? (
                <Select value={qcId} onValueChange={setQcId}>
                  <SelectTrigger><SelectValue placeholder="보고서 선택" /></SelectTrigger>
                  <SelectContent>{reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.created_date?.slice(0, 10)} · {RESULT[r.qc_result] || r.qc_result}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="text-xs text-muted-foreground">이 카드에 QC 보고서가 없습니다. 오버뷰 탭에서 먼저 작성해 주세요.</p>}
            </div>
          )}
          {late && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={shift} onChange={(e) => setShift(e.target.checked)} />뒤 단계 계획일도 늦어진 만큼 밀기
            </label>
          )}
          <Button className="w-full" disabled={!actual || busy || (needsQc && !qcId)} onClick={async () => { setBusy(true); await onConfirm(actual, shift, qcId); setBusy(false); }}>{busy ? '저장 중…' : '완료 처리'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}