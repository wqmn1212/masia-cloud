import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, PackageCheck, Search, Truck, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { downloadCsv, fileDate, safeName } from '@/lib/csv';

// 카드 '양산' 탭: 현장 검사 성적서(엑셀, 날짜별 시트)를 올려 시리얼마다 검사 결과를 남기고,
// 파레트 지정 → 출하 처리 → 출고 시리얼 목록을 내려받는다. 불량(불합격)은 출하에서 자동으로 빠진다.
const STATUS = {
  READY: ['출하 대기', 'bg-primary/10 text-primary'],
  SHIPPED: ['출하됨', 'bg-success/15 text-success-text'],
  FAILED: ['불량', 'bg-destructive/10 text-destructive'],
  REWORK: ['수리 중', 'bg-warning/15 text-warning-text'],
  SCRAPPED: ['폐기', 'bg-muted text-muted-foreground'],
  INCOMPLETE: ['미검사 항목', 'bg-warning/15 text-warning-text'],
};
const errorText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';
const call = async (body) => (await base44.functions.invoke('productionUnits', body)).data;
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const md = (d) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '');

function Section({ title, hint, children, action }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1"><h3 className="text-body font-semibold">{title}</h3>{hint && <p className="text-caption text-muted-foreground">{hint}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ProductionTab({ card }) {
  const qc = useQueryClient();
  const key = ['production-units', card.id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => call({ action: 'list', card_id: card.id }) });
  const units = data?.units || [];
  const sm = data?.summary || { counts: {}, days: [], pallets: [], shipments: [] };
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [busy, setBusy] = useState('');
  const run = async (kind, fn) => { setBusy(kind); try { await fn(); } catch (e) { toast({ title: '처리하지 못했습니다', description: errorText(e), variant: 'destructive' }); } finally { setBusy(''); } };

  // ── 성적서 올리기
  const fileRef = useRef(null);
  const [upload, setUpload] = useState(null); // { file_url, file_name, preview }
  const [lot, setLot] = useState('');
  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run('preview', async () => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const preview = await call({ action: 'preview', card_id: card.id, file_url, file_name: file.name });
      setUpload({ file_url, file_name: file.name, preview });
    });
  };
  const doImport = () => run('import', async () => {
    const res = await call({ action: 'import', card_id: card.id, file_url: upload.file_url, file_name: upload.file_name, lot });
    setUpload(null); refresh();
    toast({ title: '성적서를 등록했습니다', description: `새로 ${res.create}대 · 갱신 ${res.update}대${res.conflict_count ? ` · 다른 카드와 겹친 ${res.conflict_count}대 건너뜀` : ''}` });
  });

  // ── 파레트·출하
  const [palletForm, setPalletForm] = useState({ serials: '', pallet: '' });
  const [selected, setSelected] = useState([]);
  const [ship, setShip] = useState({ date: kstToday(), label: '' });
  const assign = () => run('pallet', async () => {
    const res = await call({ action: 'assign_pallet', card_id: card.id, ...palletForm });
    setPalletForm({ serials: '', pallet: palletForm.pallet }); refresh();
    toast({ title: `${res.updated}대에 파레트를 지정했습니다`, description: res.skipped_shipped?.length ? `출하된 ${res.skipped_shipped.length}대는 바꾸지 않았습니다` : undefined });
  });
  const doShip = () => window.confirm(`파레트 ${selected.join(', ')}의 출하 대기 제품을 ${ship.date} 출하로 처리할까요? 불량·수리 중·폐기 제품은 자동으로 빠집니다.`) && run('ship', async () => {
    const res = await call({ action: 'ship', card_id: card.id, pallets: selected, date: ship.date, label: ship.label });
    setSelected([]); refresh();
    toast({ title: `${res.shipped}대를 출하 처리했습니다`, description: res.skipped_count ? `출하 대기가 아닌 ${res.skipped_count}대는 빠졌습니다` : undefined });
  });

  // ── 불량 처리
  const dispose = (serial, disposition) => {
    const note = disposition === 'REWORK' || disposition === 'REPASS' ? window.prompt(disposition === 'REPASS' ? '수리 내용 (예: RF 모듈 교체)' : '불량 내용 (예: RF 출력 약함)', '') : '';
    if (note === null) return;
    run(`d-${serial}`, async () => { await call({ action: 'dispose', card_id: card.id, serial, disposition, note }); refresh(); });
  };

  // ── 내려받기
  const exportShipment = (s) => {
    const list = units.filter((u) => u.shipped_date === s.date && (u.shipment_label || '') === (s.label || ''));
    downloadCsv(`${safeName(card.title)}_출고시리얼_${s.date}.csv`, ['순번', '시리얼', '검사일', '파레트', '박스', '출하일', '출하'], list.map((u, i) => [i + 1, u.serial, u.inspected_date, u.pallet, u.box, u.shipped_date, u.shipment_label]));
  };
  const exportAll = () => downloadCsv(`${safeName(card.title)}_시리얼전체_${fileDate()}.csv`, ['시리얼', 'LOT', '검사일', '판정', '불합격 항목', '불량 내용', '처리', '파레트', '출하일', '출하', '상태'],
    units.map((u) => [u.serial, u.lot, u.inspected_date, u.verdict, u.failed_items.join(' · '), u.fail_note, u.disposition, u.pallet, u.shipped_date, u.shipment_label, STATUS[u.status]?.[0] || u.status]));

  const [q, setQ] = useState('');
  const found = useMemo(() => { const t = q.trim().toUpperCase(); return t.length >= 3 ? units.filter((u) => u.serial.includes(t)).slice(0, 30) : []; }, [q, units]);
  const defects = units.filter((u) => ['FAILED', 'REWORK', 'INCOMPLETE', 'SCRAPPED'].includes(u.status));
  const c = sm.counts || {};

  if (isLoading) return <p className="py-8 text-center text-body text-muted-foreground">불러오는 중…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[['전체', c.total || 0, ''], ...Object.entries(STATUS).map(([k, [label, cls]]) => [label, c[k] || 0, cls])].filter(([, n], i) => i === 0 || n).map(([label, n, cls]) => (
          <span key={label} className={`rounded-full border px-3 py-1 text-caption ${cls}`}>{label} <b className="tabular-nums">{n}</b></span>
        ))}
        <div className="ml-auto flex gap-1.5">
          {!!units.length && <Button size="sm" variant="outline" className="gap-1.5" onClick={exportAll}><Download className="h-3.5 w-3.5" />전체 목록 엑셀</Button>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={pickFile} />
          <Button size="sm" className="gap-1.5" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === 'preview' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}검사 성적서 올리기</Button>
        </div>
      </div>

      {upload && (
        <Section title={`성적서 확인 · ${upload.file_name}`} hint="아래 내용으로 등록합니다. 종합 판정은 항목 결과로 다시 계산했습니다 (빈 항목은 미검사).">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-label">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1.5 pr-3">시트</th><th className="pr-3">검사일</th><th className="pr-3">LOT</th><th className="pr-3 text-right">대수</th><th className="pr-3 text-right">합격</th><th className="pr-3 text-right">불합격</th><th className="pr-3 text-right">미검사</th><th>시리얼</th></tr></thead>
              <tbody>{upload.preview.sheets.map((s) => (
                <tr key={s.name} className="border-b last:border-0"><td className="py-1.5 pr-3">{s.name}</td><td className="pr-3">{s.date}</td><td className="pr-3">{s.lot || '-'}</td><td className="pr-3 text-right tabular-nums">{s.count}</td><td className="pr-3 text-right tabular-nums">{s.pass}</td><td className={`pr-3 text-right tabular-nums ${s.fail ? 'text-destructive' : ''}`}>{s.fail}</td><td className={`pr-3 text-right tabular-nums ${s.incomplete ? 'text-warning-text' : ''}`}>{s.incomplete}</td><td className="font-mono text-caption">{s.range || '-'}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-3 text-body">새로 등록 <b>{upload.preview.create}</b>대 · 결과 갱신 <b>{upload.preview.update}</b>대 · 그대로 {upload.preview.same}대</p>
          {!!upload.preview.conflict_count && <p className="mt-1 text-caption text-destructive">다른 카드에 이미 있는 시리얼 {upload.preview.conflict_count}대는 건너뜁니다: {upload.preview.conflict.slice(0, 10).join(', ')}{upload.preview.conflict_count > 10 ? ' …' : ''}</p>}
          {!!upload.preview.locked_count && <p className="mt-1 text-caption text-warning-text">이미 출하된 {upload.preview.locked_count}대는 결과를 바꾸지 않습니다.</p>}
          {!!upload.preview.warnings?.length && <ul className="mt-2 space-y-0.5 rounded-lg bg-warning/10 p-2 text-caption text-warning-text">{upload.preview.warnings.slice(0, 8).map((w) => <li key={w} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</li>)}</ul>}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {upload.preview.sheets.some((s) => s.count && !s.lot) && <label className="text-label">LOT (성적서에 비어 있으면)<Input className="mt-1 h-9 w-40" value={lot} placeholder="예: 1차" onChange={(e) => setLot(e.target.value)} /></label>}
            <div className="ml-auto flex gap-2"><Button variant="outline" onClick={() => setUpload(null)}>취소</Button><Button disabled={!!busy || !(upload.preview.create + upload.preview.update)} onClick={doImport} className="gap-1.5">{busy === 'import' && <Loader2 className="h-4 w-4 animate-spin" />}등록</Button></div>
          </div>
        </Section>
      )}

      {!units.length && !upload && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-body font-medium">아직 등록된 시리얼이 없습니다</p>
          <p className="mt-1 text-caption text-muted-foreground">현장의 검사 성적서(날짜별 시트, 시리얼·검사 항목·종합 판정)를 그대로 올리면 시리얼마다 검사 결과가 등록됩니다. 스티커 불량으로 버린 번호는 성적서에 없으니 따로 관리하지 않아도 됩니다.</p>
        </div>
      )}

      {!!units.length && (
        <>
          <Section title="일별 생산" hint="성적서 시트 날짜 기준">
            <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-label">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1.5 pr-3">검사일</th><th className="pr-3 text-right">대수</th><th className="pr-3 text-right">합격</th><th className="pr-3 text-right">불량</th><th className="pr-3 text-right">출하</th><th>시리얼</th></tr></thead>
              <tbody>{sm.days.map((d) => <tr key={d.key} className="border-b last:border-0"><td className="py-1.5 pr-3">{d.key || '-'}</td><td className="pr-3 text-right tabular-nums">{d.count}</td><td className="pr-3 text-right tabular-nums">{d.pass}</td><td className={`pr-3 text-right tabular-nums ${d.fail ? 'text-destructive' : ''}`}>{d.fail}</td><td className="pr-3 text-right tabular-nums">{d.shipped}</td><td className="font-mono text-caption">{d.range}</td></tr>)}</tbody>
            </table></div>
          </Section>

          <Section title="파레트" hint="시리얼 범위로 파레트를 지정하고, 출하할 파레트를 골라 출하 처리합니다. 앞부분 없이 숫자만 넣어도 됩니다 (예: 4900-5001).">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-label">시리얼 (범위·쉼표)<Input className="mt-1 h-9 w-72 font-mono" value={palletForm.serials} placeholder="예: 4900-5001, 4890" onChange={(e) => setPalletForm((f) => ({ ...f, serials: e.target.value }))} /></label>
              <label className="text-label">파레트<Input className="mt-1 h-9 w-36" value={palletForm.pallet} placeholder="P-1104-01" onChange={(e) => setPalletForm((f) => ({ ...f, pallet: e.target.value }))} /></label>
              <Button variant="outline" disabled={!!busy || !palletForm.serials.trim() || !palletForm.pallet.trim()} onClick={assign}>{busy === 'pallet' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}지정</Button>
              {!!sm.no_pallet_ready && <span className="text-caption text-muted-foreground">파레트 없는 출하 대기 {sm.no_pallet_ready}대</span>}
            </div>
            {!!sm.pallets.length && (
              <div className="mt-3 overflow-x-auto"><table className="w-full whitespace-nowrap text-label">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="w-8 py-1.5" /><th className="pr-3">파레트</th><th className="pr-3 text-right">대수</th><th className="pr-3 text-right">불량</th><th className="pr-3 text-right">출하</th><th>시리얼</th></tr></thead>
                <tbody>{sm.pallets.map((p) => {
                  const done = p.shipped === p.count;
                  return (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="py-1.5"><input type="checkbox" aria-label={`${p.key} 출하 선택`} disabled={done} checked={selected.includes(p.key)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.key] : s.filter((x) => x !== p.key)))} /></td>
                      <td className="pr-3 font-medium">{p.key}</td><td className="pr-3 text-right tabular-nums">{p.count}</td><td className={`pr-3 text-right tabular-nums ${p.fail ? 'text-destructive' : ''}`}>{p.fail}</td>
                      <td className="pr-3 text-right tabular-nums">{done ? <Badge className="border-0 bg-success/15 text-success-text">출하 완료</Badge> : p.shipped}</td><td className="font-mono text-caption">{p.range}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
            {!!selected.length && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-muted/60 p-3">
                <label className="text-label">출하일<Input type="date" className="mt-1 h-9 w-40" value={ship.date} onChange={(e) => setShip((s) => ({ ...s, date: e.target.value }))} /></label>
                <label className="text-label">출하 이름<Input className="mt-1 h-9 w-40" value={ship.label} placeholder="예: 1차 출하" onChange={(e) => setShip((s) => ({ ...s, label: e.target.value }))} /></label>
                <Button className="gap-1.5" disabled={!!busy || !ship.date} onClick={doShip}>{busy === 'ship' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}파레트 {selected.length}개 출하 처리</Button>
              </div>
            )}
          </Section>

          {!!sm.shipments.length && (
            <Section title="출하 기록" hint="출고된 시리얼만 담습니다. 고객사에 보낼 출고 시리얼 목록을 내려받으세요.">
              <ul className="divide-y">{sm.shipments.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center gap-2 py-2">
                  <PackageCheck className="h-4 w-4 text-success-text" />
                  <span className="text-body font-medium">{md(s.date)} {s.label || '출하'}</span>
                  <span className="text-caption text-muted-foreground">{s.count}대 · <span className="font-mono">{s.range}</span></span>
                  <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => exportShipment(s)}><Download className="h-3.5 w-3.5" />출고 시리얼 엑셀</Button>
                </li>
              ))}</ul>
            </Section>
          )}

          {!!defects.length && (
            <Section title={`불량 · 미검사 ${defects.length}대`} hint="출하에서 자동으로 빠집니다. 수리 후 재검사에 합격하면 출하 대기로 돌아갑니다.">
              <ul className="divide-y">{defects.slice(0, 100).map((u) => (
                <li key={u.serial} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-mono text-label">{u.serial}</span>
                  <span className={`rounded-md px-2 py-0.5 text-micro font-semibold ${STATUS[u.status][1]}`}>{STATUS[u.status][0]}</span>
                  <span className="order-last w-full text-caption text-muted-foreground sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate">{[u.inspected_date, u.failed_items.join(' · '), u.fail_note].filter(Boolean).join(' · ')}</span>
                  {u.status !== 'SCRAPPED' && <div className="ml-auto flex gap-1 sm:ml-0">
                    {u.status !== 'REWORK' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => dispose(u.serial, 'REWORK')}>수리</Button>}
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => dispose(u.serial, 'REPASS')}>재검사 합격</Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={!!busy} onClick={() => window.confirm(`${u.serial} 을 폐기할까요? 출하되지 않습니다.`) && dispose(u.serial, 'SCRAP')}>폐기</Button>
                  </div>}
                </li>
              ))}</ul>
            </Section>
          )}

          <Section title="시리얼 찾기" hint="이 카드 안에서 찾습니다. 다른 카드까지 찾으려면 왼쪽 메뉴 '시리얼 조회'를 쓰세요.">
            <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-8 font-mono" value={q} placeholder="시리얼 또는 끝자리 (예: 3982)" onChange={(e) => setQ(e.target.value)} /></div>
            {!!found.length && <ul className="mt-2 divide-y">{found.map((u) => (
              <li key={u.serial} className="flex flex-wrap items-center gap-2 py-1.5 text-label">
                <span className="font-mono">{u.serial}</span>
                <span className={`rounded-md px-2 py-0.5 text-micro font-semibold ${STATUS[u.status][1]}`}>{STATUS[u.status][0]}</span>
                <span className="text-caption text-muted-foreground">{[u.inspected_date && `검사 ${u.inspected_date}`, u.pallet && `파레트 ${u.pallet}`, u.shipped_date && `출하 ${u.shipped_date}${u.shipment_label ? ` (${u.shipment_label})` : ''}`].filter(Boolean).join(' · ')}</span>
              </li>
            ))}</ul>}
            {q.trim().length >= 3 && !found.length && <p className="mt-2 text-caption text-muted-foreground">없습니다.</p>}
          </Section>
        </>
      )}
    </div>
  );
}
