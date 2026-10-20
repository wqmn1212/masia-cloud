import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import QCChecklistEditor, { DEFAULT_QC_ITEMS } from './QCChecklistEditor';
import QCEvidenceUploader from './QCEvidenceUploader';
import QCReportHistory from './QCReportHistory';
import { hasGoldenSample } from '@/lib/goldenSample';

const freshItems = () => DEFAULT_QC_ITEMS.map(label => ({ label, status: 'PENDING', note: '' }));
export default function QCReportPanel({ card, user }) {
  const [type, setType] = useState('MASS_PRODUCTION'); const [result, setResult] = useState('PASS');
  const [items, setItems] = useState(freshItems); const [comments, setComments] = useState(''); const [files, setFiles] = useState([]); const [error, setError] = useState(''); const [compared, setCompared] = useState(false);
  const golden = hasGoldenSample(card.golden_sample);
  const qc = useQuery({ queryKey: ['qc-reports', card.id], queryFn: () => base44.entities.QCReport.filter({ card_id: card.id }, '-created_date') });
  // 고객에게 보낸 최신 품질 기준서의 항목으로 체크리스트를 채울 수 있다
  const specs = useQuery({ queryKey: ['quality-specs', card.id], queryFn: () => base44.entities.QualitySpec.filter({ card_id: card.id }, '-version', 20) });
  const sentSpec = (specs.data || []).find(s => s.status === 'SENT');
  const loadSpec = () => setItems(sentSpec.items.map(i => ({ label: i.label, status: 'PENDING', note: '' })));
  const client = useQueryClient(); const { toast } = useToast();
  const save = useMutation({ mutationFn: async () => {
    if (result === 'CONDITIONAL_PASS' && !comments.trim()) throw new Error('조건부 합격 사유를 입력하세요.');
    const uploaded = await Promise.all(files.map(file => base44.integrations.Core.UploadFile({ file })));
    const report = await base44.entities.QCReport.create({ card_id: card.id, inspection_type: type, inspector_id: user?.id || '', inspector_name: user?.full_name || user?.email || '', checklist: items, qc_result: result, comments, golden_compared: golden && compared, media_urls: uploaded.map(x => x.file_url), media_names: files.map(x => x.name) });
    if (result === 'FAIL') await base44.entities.TaskItem.create({ card_id: card.id, title: `[공장 클레임] ${card.factory_name || card.title}`, description: comments || 'QC 불합격 항목 확인 및 재작업 필요', status: 'TODO', priority: 'URGENT' });
    await base44.entities.ProjectAuditLog.create({ card_id: card.id, event_type: 'QC_RECORDED', actor_id: user?.id || '', actor_name: user?.full_name || user?.email || '', details: `${type} 검수 결과: ${result}` });
    return report;
  }, onSuccess: () => { client.invalidateQueries({ queryKey: ['qc-reports', card.id] }); client.invalidateQueries({ queryKey: ['task-items', card.id] }); setItems(freshItems()); setComments(''); setFiles([]); setError(''); setCompared(false); toast({ title: result === 'FAIL' ? '불합격 저장 및 공장 클레임 업무 생성 완료' : 'QC 검수 결과 저장 완료' }); }, onError: e => setError(e.message) });
  return <section className="mt-5 space-y-4 border-t pt-5"><div><h3 className="text-sm font-semibold">품질 검수 관리</h3><p className="text-xs text-muted-foreground">샘플·양산품 체크리스트와 현장 증빙을 기록합니다.</p></div>
    <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">검수 유형</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SAMPLE">샘플 검수</SelectItem><SelectItem value="MASS_PRODUCTION">양산품 검수</SelectItem></SelectContent></Select></div><div><Label className="text-xs">최종 판정</Label><Select value={result} onValueChange={setResult}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PASS">합격</SelectItem><SelectItem value="CONDITIONAL_PASS">조건부 합격</SelectItem><SelectItem value="FAIL">불합격</SelectItem></SelectContent></Select></div></div>
    {sentSpec && <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={loadSpec}>품질 기준서 v{sentSpec.version || 1} 항목으로 체크리스트 채우기</Button>}
    <QCChecklistEditor items={items} onChange={setItems} /><div><Label className="text-xs">판정 의견</Label><Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="조건부 합격 조건, 불량 내용, 재작업 지시 등을 입력하세요" /></div><QCEvidenceUploader files={files} onChange={setFiles} disabled={save.isPending} />
    {golden && type === 'MASS_PRODUCTION' && <label className="flex items-center gap-2 rounded-md border p-2 text-xs"><input type="checkbox" checked={compared} onChange={e => setCompared(e.target.checked)} />기준 샘플과 나란히 비교한 사진을 올렸습니다{card.golden_sample?.seal_no ? ` (${card.golden_sample.seal_no})` : ''}</label>}
    {error && <p className="text-xs text-destructive">{error}</p>}<Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? '저장 중...' : '검수 결과 저장'}</Button><QCReportHistory card={card} user={user} reports={qc.data || []} />
  </section>;
}