import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarPlus, CheckCircle2, Download, FileSearch, Loader2, RotateCcw, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import VerifyDocumentDialog from '@/components/signature/VerifyDocumentDialog';

export const REQUEST_STATUS = {
  OUT: { label: '서명 대기', cls: 'bg-primary/10 text-primary' },
  COMPLETED: { label: '체결', cls: 'bg-primary text-primary-foreground' },
  DECLINED: { label: '수정 요청', cls: 'bg-chart-3/15 text-chart-3' },
  REVOKED: { label: '회수', cls: 'bg-muted text-muted-foreground' },
  EXPIRED: { label: '기한 지남', cls: 'bg-muted text-muted-foreground' },
};
const EVENT = { SENT: '서명 요청', VIEWED: '열람', READ_TO_END: '끝까지 확인', OTP_SENT: '인증번호 발송', OTP_VERIFIED: '본인 확인', OTP_FAILED: '인증 실패', SIGNED: '서명', DECLINED: '수정 요청', REVOKED: '회수', EXPIRED: '기한 지남', COMPLETED: '체결 완료', DOWNLOADED: '완료본 내려받기', REMINDED: '다시 알림', EXTENDED: '기한 연장' };
const kst = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const kstDate = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10) : '');
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000));
const errText = (e) => e?.response?.data?.error || e?.message;

function detail(e) {
  const d = e.data || {};
  if (e.type === 'SIGNED') return `${d.name || ''}${d.title ? ` (${d.title})` : ''} · ${{ DRAW: '그린 서명', TYPE: '이름 입력', SEAL: '직인 이미지' }[d.method] || ''}`;
  if (e.type === 'DECLINED') return d.reason || '';
  if (e.type === 'OTP_SENT' || e.type === 'REMINDED') return d.email || '';
  if (e.type === 'OTP_FAILED') return d.reason === 'LOCKED_NOW' ? '5회 실패, 30분 잠금' : `남은 ${d.left}회`;
  if (e.type === 'EXTENDED') return `기한 ${kstDate(d.due_at)}`;
  if (e.type === 'SENT') return `v${d.version} · ${d.signer_email || ''}`;
  return '';
}

// 계약서 상세: 서명 요청 버전별 상태, 감사 기록 타임라인(사슬 검사 결과), 다시 알림·기한 연장·회수·완료본
export default function SignaturePanel({ contract }) {
  const qc = useQueryClient();
  const key = ['signature-requests', contract.id];
  const [busy, setBusy] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [verify, setVerify] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => (await base44.functions.invoke('getSignatureRequest', { contract_id: contract.id })).data, refetchInterval: contract.status === 'SENT' ? 30000 : false });
  const requests = data?.requests || [];
  if (isLoading) return <Card><CardContent className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  if (!requests.length) return null;
  const r = requests[0];
  const older = requests.slice(1);
  const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.OUT;
  const signer = r.signers[0] || {};

  const manage = async (action, extra = {}, msg = '') => {
    setBusy(action);
    try {
      await base44.functions.invoke('manageSignatureRequest', { request_id: r.id, action, ...extra });
      if (msg) toast({ title: msg });
      qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['contracts'] });
    } catch (e) { toast({ title: errText(e), variant: 'destructive' }); } finally { setBusy(''); }
  };
  const open = async (id, purpose) => {
    try { const res = await base44.functions.invoke('getSignatureRequest', { request_id: id, purpose }); window.open(res.data.url, '_blank', 'noopener'); } catch (e) { toast({ title: errText(e), variant: 'destructive' }); }
  };
  const allSigned = r.signers.every((s) => s.status === 'SIGNED');
  const events = showAll ? r.events : r.events.filter((e) => !['OTP_SENT', 'DOWNLOADED'].includes(e.type));

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold">전자서명</p>
              <Badge className={`${st.cls} border-0 text-[10px]`}>{st.label}{r.status === 'OUT' ? (signer.status === 'VIEWED' ? ' · 열람함' : ' · 열람 전') : ''}</Badge>
              <span className="text-xs text-muted-foreground">{r.document_no} · v{r.version}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              서명자 {signer.name || ''} ({signer.email}){r.status === 'OUT' && ` · ${daysSince(r.created_date)}일째 · 기한 ${kstDate(r.due_at)}`}
              {r.status === 'COMPLETED' && ` · ${kst(r.completed_at)} 체결 · ${signer.signed_name}${signer.signed_title ? ` ${signer.signed_title}` : ''}`}
              {r.status === 'REVOKED' && ` · ${r.revoked_by_name} 회수`}
            </p>
            {r.status === 'DECLINED' && <p className="mt-1 rounded-md bg-chart-3/10 px-2 py-1 text-xs">수정 요청: {r.decline_reason}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.status === 'COMPLETED' && <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => open(r.id, 'download')}><Download className="h-3 w-3" />완료본</Button>}
            {r.status === 'OUT' && allSigned && <Button size="sm" className="h-7 gap-1 text-xs" disabled={!!busy} onClick={() => manage('complete', {}, '완료본을 발급했습니다')}><RotateCcw className="h-3 w-3" />완료본 다시 발급</Button>}
            {r.status === 'OUT' && !allSigned && <>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!busy} onClick={() => manage('remind', {}, '다시 알림을 보냈습니다')}><BellRing className="h-3 w-3" />다시 알림</Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!busy} onClick={() => manage('extend', { days: 7 }, '기한을 7일 늘렸습니다')}><CalendarPlus className="h-3 w-3" />기한 +7일</Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" disabled={!!busy} onClick={() => window.confirm('서명 요청을 회수할까요? 고객 화면에는 "담당자가 회수한 계약서"로 보입니다.') && manage('revoke', {}, '회수했습니다. 본문을 고쳐 새 버전으로 보낼 수 있습니다')}><Undo2 className="h-3 w-3" />회수</Button>
            </>}
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => open(r.id, 'original')}>원본</Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setVerify(true)}><FileSearch className="h-3 w-3" />문서 확인</Button>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <p className={`flex items-center gap-1 text-[11px] ${r.chain_ok ? 'text-muted-foreground' : 'font-medium text-destructive'}`}>
              {r.chain_ok ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {r.chain_ok ? `감사 기록 ${r.events.length}건 · 사슬 검사 정상` : `감사 기록 검사 실패 (${r.chain_reason}) — 개발 담당에게 바로 알려 주세요`}
            </p>
            <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setShowAll((v) => !v)}>{showAll ? '주요 기록만' : '전체 보기'}</button>
          </div>
          <ol className="max-h-64 space-y-0 overflow-y-auto px-3 py-2">
            {events.map((e) => (
              <li key={e.seq} className="flex gap-2 py-1 text-xs">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{kst(e.at)}</span>
                <span className={`w-20 shrink-0 font-medium ${e.type === 'COMPLETED' || e.type === 'SIGNED' ? 'text-primary' : e.type === 'OTP_FAILED' || e.type === 'DECLINED' ? 'text-chart-3' : ''}`}>{EVENT[e.type] || e.type}</span>
                <span className="min-w-0 flex-1 truncate">{e.actor_label}{detail(e) ? ` · ${detail(e)}` : ''}</span>
                <span className="hidden shrink-0 text-muted-foreground sm:inline">{e.ip}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="break-all font-mono text-[10px] text-muted-foreground">원본 SHA-256 {r.original_sha256}{r.completed_sha256 ? ` · 완료본 ${r.completed_sha256}` : ''}</p>
        {older.length > 0 && (
          <p className="text-[11px] text-muted-foreground">이전 버전: {older.map((o) => `v${o.version} ${REQUEST_STATUS[o.status]?.label || o.status}`).join(' · ')}</p>
        )}
        {r.status === 'COMPLETED' && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-primary" />체결된 계약은 고칠 수 없습니다. 바꿔야 하면 변경 계약서를 새로 만들어 보내세요.</p>}
        <VerifyDocumentDialog open={verify} onOpenChange={setVerify} />
      </CardContent>
    </Card>
  );
}
