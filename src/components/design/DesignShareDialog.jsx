import React, { useEffect, useState } from 'react';
import { Copy, Link2, Loader2, Mail, Upload, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { callRoom } from '@/lib/designRoomLive';
import { fileKindOf } from '@/lib/designRoom';

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '');
const copy = async (text, label) => { try { await navigator.clipboard.writeText(text); toast({ title: `${label}을 복사했습니다` }); } catch { toast({ title: '복사하지 못했습니다. 직접 선택해 복사해 주세요' }); } };

// 리뷰 방 공유 (직원만): 공유 링크 + PIN, 이메일 초대, 새 시안 판, 방 닫기
export default function DesignShareDialog({ room, onClose, onChanged }) {
  const [info, setInfo] = useState(null);
  const [fresh, setFresh] = useState(null);
  const [days, setDays] = useState(14);
  const [emails, setEmails] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [files, setFiles] = useState([]);
  const load = async () => setInfo(await callRoom({ action: 'share_info', room_id: room.id }));
  useEffect(() => { load(); }, [room.id]);  
  useEffect(() => {
    if (room.kind !== 'file') return;
    base44.entities.CardAttachment.filter({ card_id: room.card_id }, '-created_date', 200)
      .then((rows) => setFiles(rows.filter((a) => fileKindOf(a.file_name, a.file_type) && !room.versions.some((v) => v.attachment_id === a.id))))
      .catch(() => setFiles([]));
  }, [room.id, room.kind, room.card_id, room.versions]);
  const run = async (key, body, ok) => {
    setBusy(key);
    const r = await callRoom({ room_id: room.id, ...body });
    setBusy('');
    if (r.error) { toast({ title: r.error, variant: 'destructive' }); return null; }
    if (ok) toast({ title: ok });
    return r;
  };
  const newLink = async () => { const r = await run('link', { action: 'set_link', on: true, days }, '새 공유 링크를 만들었습니다'); if (r) { setFresh(r); load(); } };
  const offLink = async () => { if (await run('off', { action: 'set_link', on: false }, '공유 링크를 껐습니다')) { setFresh(null); load(); } };
  const invite = async () => { const r = await run('inv', { action: 'invite', emails, note }); if (r) { toast({ title: `${r.sent.length}명에게 초대 메일을 보냈습니다` }); setEmails(''); setInfo((i) => ({ ...i, invites: r.invites })); } };
  const revoke = async (email) => { const r = await run(`rv-${email}`, { action: 'revoke_invite', email }, '초대를 취소했습니다'); if (r) setInfo((i) => ({ ...i, invites: r.invites })); };
  const addVersion = async (id) => { if (await run(`v-${id}`, { action: 'add_version', attachment_id: id }, '새 판을 올렸습니다. 모두의 화면이 새 판으로 바뀝니다')) onChanged?.(); };
  const setStatus = async (status) => { if (await run('st', { action: 'set_status', status }, status === 'CLOSED' ? '리뷰를 끝냈습니다' : '리뷰를 다시 열었습니다')) onChanged?.(); };
  const link = info?.link;
  const invites = (info?.invites || []).filter((i) => !i.revoked);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="text-title">리뷰 공유</DialogTitle></DialogHeader>
        <p className="text-caption text-muted-foreground">우리 팀원과 이 카드의 고객사 계정은 로그인해서 바로 들어옵니다. 그 밖의 사람은 아래 링크나 이메일 초대로 들어옵니다.</p>

        <section className="space-y-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-label font-semibold"><Link2 className="h-4 w-4 text-primary" />공유 링크 + PIN</p>
          {!info ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
            <p className="text-caption text-muted-foreground">{link?.on ? (link.expired ? `기한이 지났습니다 (${day(link.expires_at)})` : `켜짐 · ${day(link.expires_at)}까지`) : '꺼짐'}</p>
          )}
          {fresh && (
            <div className="space-y-1.5 rounded-md bg-primary/5 p-2">
              <p className="text-micro text-muted-foreground">PIN 은 지금 한 번만 보입니다. 링크와 PIN 을 다른 경로로 따로 보내면 더 안전합니다.</p>
              <div className="flex items-center gap-1.5"><code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1 text-micro">{fresh.url}</code><Button size="sm" variant="outline" className="h-7" onClick={() => copy(fresh.url, '링크')}><Copy className="h-3.5 w-3.5" /></Button></div>
              <div className="flex items-center gap-1.5"><span className="text-caption">PIN</span><code className="rounded bg-card px-2 py-1 font-mono text-label tracking-widest">{fresh.pin}</code><Button size="sm" variant="outline" className="h-7" onClick={() => copy(fresh.pin, 'PIN')}><Copy className="h-3.5 w-3.5" /></Button></div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="링크 기간" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-label">{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d}일</option>)}</select>
            <Button size="sm" onClick={newLink} disabled={!!busy}>{busy === 'link' && <Loader2 className="h-4 w-4 animate-spin" />}{link?.on ? '새 링크로 바꾸기' : '링크 만들기'}</Button>
            {link?.on && <Button size="sm" variant="ghost" onClick={offLink} disabled={!!busy}>링크 끄기</Button>}
          </div>
          {link?.on && !fresh && <p className="text-micro text-muted-foreground">새 링크로 바꾸면 예전 링크와 PIN 은 바로 막힙니다.</p>}
        </section>

        <section className="space-y-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-label font-semibold"><Mail className="h-4 w-4 text-primary" />이메일 초대</p>
          <Textarea aria-label="초대할 이메일" rows={2} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="이메일 (쉼표·줄바꿈으로 여러 명)" className="text-label" />
          <Textarea aria-label="초대 메모" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="메일에 넣을 말 (선택) 예: 앞면 로고 위치를 봐 주세요" className="text-label" />
          <Button size="sm" onClick={invite} disabled={!!busy || !emails.trim()}>{busy === 'inv' && <Loader2 className="h-4 w-4 animate-spin" />}초대 메일 보내기</Button>
          <p className="text-micro text-muted-foreground">사람마다 전용 링크가 갑니다. 다시 초대하면 그 사람의 예전 링크는 막힙니다.</p>
          {invites.length > 0 && (
            <ul className="space-y-1">{invites.map((i) => (
              <li key={i.email} className="flex items-center gap-2 rounded bg-secondary px-2 py-1 text-caption">
                <span className="min-w-0 flex-1 truncate">{i.email}</span>
                <span className="text-micro text-muted-foreground">{i.last_seen_at ? `들어옴 ${day(i.last_seen_at)}` : '아직 안 들어옴'}</span>
                <Button size="sm" variant="ghost" className="h-6 px-1.5" aria-label={`${i.email} 초대 취소`} onClick={() => revoke(i.email)} disabled={!!busy}><X className="h-3.5 w-3.5" /></Button>
              </li>
            ))}</ul>
          )}
        </section>

        {room.kind === 'file' && (
          <section className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-label font-semibold"><Upload className="h-4 w-4 text-primary" />새 시안 판 올리기</p>
            {files.length === 0 ? <p className="text-caption text-muted-foreground">카드 파일 탭에 새 이미지·PDF 를 먼저 올리세요.</p> : (
              <ul className="space-y-1">{files.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-caption"><span className="min-w-0 flex-1 truncate">{a.file_name}</span><Button size="sm" variant="outline" className="h-7" onClick={() => addVersion(a.id)} disabled={!!busy}>v{room.versions.length + 1} 로 올리기</Button></li>
              ))}</ul>
            )}
          </section>
        )}

        <div className="flex justify-end">
          {room.status === 'CLOSED'
            ? <Button size="sm" variant="outline" onClick={() => setStatus('OPEN')} disabled={!!busy}>리뷰 다시 열기</Button>
            : <Button size="sm" variant="ghost" onClick={() => setStatus('CLOSED')} disabled={!!busy}>리뷰 끝내기 (읽기 전용)</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
