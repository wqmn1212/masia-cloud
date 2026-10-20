import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, Boxes, ImagePlus, Loader2, Pencil, Plus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import { MOLD_OWNER, MOLD_STATUS, TRADEMARK_STATUS, lifeUsed } from '@/lib/molds';

const sel = 'h-9 w-full rounded-md border bg-background px-2 text-sm';
const EMPTY = { name: '', part_name: '', cavity: '', material: '', photos: [], ownership: 'CLIENT', ownership_confirmed: false, ownership_doc_id: '', fee_amount: '', fee_currency: 'CNY', fee_paid_at: '', return_terms: '거래 종료 시 고객이 요청하면 30일 안에 고객 지정 장소로 반환', shot_count: '', expected_life_shots: '', status: 'IN_USE', last_checked_at: '', note: '' };
const num = (v) => (v === '' || v == null ? null : Number(v));

function MoldDialog({ card, mold, open, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...EMPTY, ...(mold || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const addPhotos = async (list) => {
    setBusy(true);
    try {
      const files = Array.from(list).slice(0, 6 - f.photos.length);
      const up = await Promise.all(files.map((file) => base44.integrations.Core.UploadFile({ file })));
      setF((x) => ({ ...x, photos: [...x.photos, ...up.map((u, i) => ({ url: u.file_url, name: files[i].name }))] }));
    } catch (e) { toast({ title: '사진을 올리지 못했습니다', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  // 금형 소유 확인서: 비공개 저장 후 카드 파일에 '금형 소유 확인서'로 연결 (고객도 열람)
  const addDoc = async (file) => {
    setBusy(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const att = await base44.entities.CardAttachment.create({ tenant_id: card.tenant_id, card_id: card.id, file_name: file.name, file_type: file.name.split('.').pop().toLowerCase(), file_url: file_uri, document_type: 'MOLD_OWNERSHIP', client_visible: true, uploader_name: me?.full_name || me?.email || '', uploader_role: 'HQ' });
      setF((x) => ({ ...x, ownership_doc_id: att.id, ownership_doc_name: file.name, ownership_confirmed: true }));
    } catch (e) { toast({ title: '확인서를 올리지 못했습니다', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const data = {
        ...f, cavity: num(f.cavity), fee_amount: num(f.fee_amount), shot_count: num(f.shot_count), expected_life_shots: num(f.expected_life_shots),
        card_id: card.id, tenant_id: card.tenant_id, client_id: card.client_id || '', factory_id: f.factory_id || card.factory_id || '', factory_name: f.factory_name || card.factory_name || '',
      };
      delete data.id; delete data.created_date; delete data.updated_date;
      if (mold?.id) await base44.entities.MoldAsset.update(mold.id, data);
      else await base44.entities.MoldAsset.create(data);
      toast({ title: '금형 대장을 저장했습니다' });
      onSaved(); onClose();
    } catch (e) { toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const field = (k, label, props = {}) => <label className="space-y-1 text-xs"><span>{label}</span><Input className="h-9" value={f[k] ?? ''} onChange={set(k)} {...props} /></label>;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">{mold ? '금형 수정' : '금형 등록'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('name', '금형 이름 *', { placeholder: '예: 본체 상판 금형' })}
          {field('part_name', '부품명')}
          {field('cavity', '캐비티 수', { type: 'number', min: 0 })}
          {field('material', '강재', { placeholder: '예: P20, NAK80' })}
          <label className="space-y-1 text-xs"><span>소유자</span><select className={sel} value={f.ownership} onChange={set('ownership')}>{Object.entries(MOLD_OWNER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="space-y-1 text-xs"><span>상태</span><select className={sel} value={f.status} onChange={set('status')}>{Object.entries(MOLD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="grid grid-cols-[1fr_88px] gap-2">{field('fee_amount', '금형비', { type: 'number', min: 0 })}<label className="space-y-1 text-xs"><span>통화</span><select className={sel} value={f.fee_currency} onChange={set('fee_currency')}><option>CNY</option><option>USD</option><option>KRW</option></select></label></div>
          {field('fee_paid_at', '금형비 지급일', { type: 'date' })}
          {field('shot_count', '누적 쇼트', { type: 'number', min: 0 })}
          {field('expected_life_shots', '예상 수명 (쇼트)', { type: 'number', min: 0 })}
          {field('last_checked_at', '마지막 실물 확인일', { type: 'date' })}
          {field('factory_name', '보관 공장', { placeholder: card.factory_name || '' })}
          <label className="space-y-1 text-xs sm:col-span-2"><span>반환 조건</span><Textarea rows={2} value={f.return_terms} onChange={set('return_terms')} /></label>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold">금형 소유 확인서</p>
          <p className="text-[11px] text-muted-foreground">공장이 서명·날인한 &lsquo;이 금형은 OO 소유이며, 요청 시 반환한다&rsquo; 확인서입니다. 금형비를 냈어도 확인서가 없으면 거래를 끝낼 때 금형을 돌려받기 어렵습니다.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {f.ownership_doc_id ? <span className="flex items-center gap-1 text-primary"><BadgeCheck className="h-3.5 w-3.5" />{f.ownership_doc_name || '확인서 올림'}</span> : <span className="text-destructive">확인서 없음</span>}
            <label className="cursor-pointer rounded-md border px-2 py-1 hover:bg-muted">확인서 올리기<input type="file" className="hidden" disabled={busy} onChange={(e) => { const x = e.target.files?.[0]; if (x) addDoc(x); e.target.value = ''; }} /></label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!f.ownership_confirmed} onChange={set('ownership_confirmed')} />공장 서명 확인함</label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {f.photos.map((p, i) => (
            <div key={p.url} className="relative h-16 w-16 overflow-hidden rounded-md border"><img src={p.url} alt={p.name} className="h-full w-full object-cover" /><button type="button" aria-label={`${p.name} 빼기`} onClick={() => setF((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))} className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5"><X className="h-3 w-3" /></button></div>
          ))}
          {f.photos.length < 6 && <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-[10px] text-muted-foreground"><ImagePlus className="h-4 w-4" />사진<input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); e.target.value = ''; }} /></label>}
        </div>
        {field('note', '내부 메모')}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button disabled={busy || !f.name.trim()} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 금형 대장: 이 프로젝트 금형의 소유자·소유 확인서·보관 공장·반환 조건·사용 횟수, 고객사 중국 상표 상태
export default function MoldRegistryPanel({ card }) {
  const qc = useQueryClient();
  const key = ['mold-assets', card.id];
  const { data: molds = [] } = useQuery({ queryKey: key, queryFn: () => base44.entities.MoldAsset.filter({ card_id: card.id }, 'created_date', 50) });
  const { data: client } = useQuery({ queryKey: ['company', card.client_id], queryFn: () => base44.entities.Company.get(card.client_id), enabled: !!card.client_id });
  const [editing, setEditing] = useState(null);
  const tm = useMutation({
    mutationFn: (v) => base44.entities.Company.update(card.client_id, { cn_trademark_status: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', card.client_id] }); toast({ title: '고객사 중국 상표 상태를 저장했습니다' }); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const tmStatus = client?.cn_trademark_status || 'UNKNOWN';
  return (
    <section className="mt-6 space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Boxes className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">금형 대장</h3>
        <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => setEditing({})}><Plus className="h-3 w-3" />금형 등록</Button>
      </div>
      {card.client_id && (
        <label className="flex flex-wrap items-center gap-2 text-xs">
          <span className={tmStatus === 'REGISTERED' ? 'text-muted-foreground' : 'text-destructive'}>{tmStatus !== 'REGISTERED' && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}고객사 중국 상표</span>
          <select className="h-7 rounded-md border bg-background px-2 text-xs" value={tmStatus} disabled={tm.isPending} onChange={(e) => tm.mutate(e.target.value)}>{Object.entries(TRADEMARK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {tmStatus !== 'REGISTERED' && <span className="text-[11px] text-muted-foreground">중국 상표는 먼저 출원한 쪽이 가져갑니다. 공장이 먼저 출원하지 않도록 고객에게 안내해 주세요.</span>}
        </label>
      )}
      {molds.length === 0 ? <p className="text-xs text-muted-foreground">금형을 새로 만들면 등록해 두세요. 소유 확인서·반환 조건이 있어야 거래를 끝낼 때 금형을 돌려받을 수 있습니다.</p> : (
        <ul className="space-y-2">
          {molds.map((m) => {
            const used = lifeUsed(m);
            return (
              <li key={m.id} className="flex gap-3 rounded-lg border p-2.5">
                {m.photos?.[0] ? <img src={m.photos[0].url} alt={m.name} className="h-14 w-14 shrink-0 rounded-md border object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-md border bg-muted" />}
                <div className="min-w-0 flex-1 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <Badge variant="outline" className="text-[10px]">{MOLD_STATUS[m.status || 'IN_USE']}</Badge>
                    <Badge className="border-0 bg-muted text-[10px] text-foreground">{MOLD_OWNER[m.ownership || 'CLIENT']}</Badge>
                    {m.ownership_confirmed ? <Badge className="border-0 bg-primary/10 text-[10px] text-primary">소유 확인서 있음</Badge> : <Badge className="border-0 bg-destructive/10 text-[10px] text-destructive">소유 확인서 없음</Badge>}
                  </div>
                  <p className="text-muted-foreground">{[m.part_name, m.cavity ? `${m.cavity}캐비티` : '', m.material, m.factory_name || card.factory_name].filter(Boolean).join(' · ')}</p>
                  <p className="text-muted-foreground">{m.shot_count != null ? `${Number(m.shot_count).toLocaleString('ko-KR')}쇼트` : '쇼트 미기록'}{used != null ? ` (수명의 ${Math.round(used * 100)}%)` : ''}{m.last_checked_at ? ` · 실물 확인 ${m.last_checked_at}` : ''}</p>
                  {used != null && used >= 0.8 && <p className="text-destructive">수명의 {Math.round(used * 100)}%를 썼습니다. 보수·재제작 계획을 고객과 상의하세요.</p>}
                  {m.return_terms && <p className="text-muted-foreground">반환: {m.return_terms}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`${m.name} 수정`} onClick={() => setEditing(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {m.ownership_doc_id && <DocumentOpenButton document={{ id: m.ownership_doc_id, card_id: card.id, file_name: m.ownership_doc_name || '금형 소유 확인서' }} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <MoldDialog key={editing.id || 'new'} card={card} mold={editing.id ? editing : null} open onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: key })} />}
    </section>
  );
}
