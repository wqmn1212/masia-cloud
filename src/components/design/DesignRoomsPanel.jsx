import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link2, Loader2, MessagesSquare, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { callRoom } from '@/lib/designRoomLive';
import { fileKindOf, openDesignRoom } from '@/lib/designRoom';

const ago = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '');

// 카드의 실시간 디자인 리뷰 방 목록. 직원은 카드 파일(이미지·PDF)로 방을 만들고, 고객은 열린 방에 들어간다
export default function DesignRoomsPanel({ cardId, staff = false }) {
  const qc = useQueryClient();
  const key = ['design-rooms', cardId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => callRoom({ action: 'list', card_id: cardId }), enabled: !!cardId, staleTime: 15_000 });
  const { data: files = [] } = useQuery({
    queryKey: ['design-room-files', cardId],
    queryFn: async () => (await base44.entities.CardAttachment.filter({ card_id: cardId }, '-created_date', 200)).filter((a) => fileKindOf(a.file_name, a.file_type)),
    enabled: staff && !!cardId, staleTime: 30_000,
  });
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const rooms = data?.rooms || [];
  const create = async () => {
    setBusy(true);
    const r = await callRoom({ action: 'create', card_id: cardId, attachment_id: pick });
    setBusy(false);
    if (r.error) { toast({ title: r.error, variant: 'destructive' }); return; }
    qc.invalidateQueries({ queryKey: key });
    setPick('');
    openDesignRoom(r.room.id);
  };
  if (!staff && !isLoading && rooms.length === 0) return null;
  return (
    <section className="mb-4 space-y-2 rounded-xl border p-4" aria-label="디자인 실시간 리뷰">
      <p className="flex items-center gap-1.5 text-label font-semibold"><MessagesSquare className="h-4 w-4 text-primary" />디자인 실시간 리뷰</p>
      <p className="text-caption text-muted-foreground">{staff ? '시안을 여러 사람이 동시에 보며 위치를 찍고 댓글을 남깁니다. 고객사 계정은 로그인해서, 외부 디자이너는 링크 + PIN 이나 이메일 초대로 들어옵니다.' : '담당자와 같은 시안을 함께 보며 위치를 찍고 댓글을 남길 수 있습니다.'}</p>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : rooms.length > 0 && (
        <ul className="space-y-1.5">{rooms.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-caption">
            <span className="min-w-0 flex-1"><span className="font-medium">{r.title}</span> <span className="text-muted-foreground">{r.kind === 'model' ? '3D' : `v${r.versions.length}`} · 열린 댓글 {r.open_count} · {ago(r.last_activity_at)}{r.status === 'CLOSED' ? ' · 끝남' : ''}</span></span>
            {staff && r.link_on && <span className="flex items-center gap-0.5 text-micro text-primary"><Link2 className="h-3 w-3" />링크 켜짐</span>}
            <Button size="sm" variant="outline" className="h-7" onClick={() => openDesignRoom(r.id)}><ExternalLink className="h-3.5 w-3.5" />열기</Button>
          </li>
        ))}</ul>
      )}
      {staff && (
        files.length === 0 ? <p className="text-micro text-muted-foreground">이미지(PNG·JPG)나 PDF 시안을 아래에 올리면 리뷰 방을 만들 수 있습니다.</p> : (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="리뷰할 시안" value={pick} onChange={(e) => setPick(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-label">
              <option value="">리뷰할 시안 고르기</option>
              {files.map((a) => <option key={a.id} value={a.id}>{a.file_name}</option>)}
            </select>
            <Button size="sm" onClick={create} disabled={!pick || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}리뷰 방 열기</Button>
          </div>
        )
      )}
    </section>
  );
}
