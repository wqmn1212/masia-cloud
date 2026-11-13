import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Loader2, RefreshCw, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { actorName, errorText } from '@/lib/prototypeApi';
import ProjectCircuits from '@/components/circuit/ProjectCircuits';
import { LCSC_TYPES, isLcsc, isSmt, jlcBomRows, lcscSearchUrl, normalizeLcsc, pcbSummary, seedPcbRows, toCsv } from '@/lib/pcb';

// PCB 부품 확정: 승인 설계의 부품표마다 LCSC 부품번호·실장 모양을 확정하고 JLCPCB 양식 부품표로 내보낸다.
// 실제 회로·PCB 설계는 EasyEDA·KiCad 에서 하고, 여기서는 구매 가능한 부품으로 확정하는 단계를 맡는다.
export default function PcbTab({ project, versions, user, onChanged }) {
  const v = versions.find((x) => x.id === project.current_version_id);
  const saved = project.pcb || {};
  const seed = () => (saved.version_id === v?.id && saved.rows?.length ? saved.rows : seedPcbRows(v?.bom, saved.rows));
  const [rows, setRows] = useState(seed);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRows(seed()); }, [v?.id, project.pcb?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const sum = useMemo(() => pcbSummary(rows), [rows]);
  const stale = !!saved.version_id && saved.version_id !== v?.id;
  const set = (i, k, val) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: val } : r)));

  const save = async () => {
    setSaving(true);
    try {
      const clean = rows.map((r) => ({ ...r, lcsc: normalizeLcsc(r.lcsc), smt: isSmt(r) }));
      await base44.entities.ProtoProject.update(project.id, { pcb: { version_id: v.id, version_no: v.version_no, rows: clean, updated_by_name: actorName(user), updated_at: new Date().toISOString() } });
      onChanged();
      toast({ title: 'PCB 부품 확정 내용을 저장했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setSaving(false);
  };

  const exportCsv = () => {
    const out = jlcBomRows(rows.map((r) => ({ ...r, lcsc: normalizeLcsc(r.lcsc) })));
    const blob = new Blob([toCsv(out)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.title || 'prototype'}_v${v.version_no}_JLCPCB_BOM.csv`.replace(/[\\/:*?"<>|]/g, '_');
    a.click();
    URL.revokeObjectURL(a.href);
    const gaps = sum.missing + sum.invalid;
    if (gaps || sum.noFootprint) toast({ title: '빈 칸이 있는 채로 내보냈습니다', description: `LCSC 번호 미확정 ${gaps}개 · 실장 모양 빈칸 ${sum.noFootprint}개 — 공장에 보내기 전에 채워 주세요.` });
  };

  if (!v) return <div className="space-y-4"><ProjectCircuits project={project} /><div className="rounded-xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">설계 버전을 승인하면 그 부품표로 PCB 부품을 확정할 수 있습니다.</div></div>;

  const tiles = [
    ['LCSC 번호 확정 (SMT 대상)', `${sum.confirmed} / ${sum.total}`, sum.confirmed < sum.total],
    ['기본 부품', sum.basic, false],
    ['확장 부품', sum.extended, false],
    ['실장 모양 빈칸', sum.noFootprint, sum.noFootprint > 0],
  ];
  const smtCount = sum.total;
  const input = 'h-8 rounded-md border bg-transparent px-2 text-label';

  return (
    <div className="space-y-4">
      <ProjectCircuits project={project} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([l, n, warn]) => (
          <div key={l} className="rounded-xl border bg-card p-4"><p className="text-caption text-muted-foreground">{l}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${warn ? 'text-warning-text' : ''}`}>{n}</p></div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-title font-semibold">PCB 부품 확정 · v{v.version_no}</p>
            <p className="text-caption text-muted-foreground">SMT 조립 대상 {smtCount}개 부품의 LCSC 부품번호(C로 시작)와 실장 모양(예: 0603, SOT-23-5)을 정하세요. 확장 부품은 SMT 조립 때 추가 비용이 생길 수 있습니다.{sum.excluded ? ` 조립 대상이 아닌 ${sum.excluded}개(기구·기판·케이블 등)는 부품표 내보내기에서 뺍니다.` : ''}</p>
            {stale && <p className="mt-1 text-caption text-warning-text">저장된 확정 내용은 v{saved.version_no} 기준입니다. 같은 Ref·부품명은 이어 받았고, 바뀐 부품만 새로 확인하면 됩니다.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRows(seedPcbRows(v.bom, rows))}><RefreshCw className="w-4 h-4" />부품표 다시 불러오기</Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="w-4 h-4" />JLCPCB 부품표 (CSV)</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}저장</Button>
          </div>
        </div>

        {rows.length === 0 ? <p className="text-caption text-muted-foreground">v{v.version_no} 설계에 부품표가 없습니다.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-label">
              <thead>
                <tr className="text-left text-caption text-muted-foreground">
                  {['SMT', 'Ref', '부품', '수량', 'Comment (값·부품번호)', '실장 모양', 'LCSC 번호', '유형', ''].map((h) => <th key={h} className="px-1 py-1.5 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const lcsc = normalizeLcsc(r.lcsc);
                  const bad = !!lcsc && !isLcsc(lcsc);
                  const smt = isSmt(r);
                  return (
                    <tr key={`${r.ref}-${i}`} className={`border-t ${smt ? '' : 'opacity-50'}`}>
                      <td className="px-1 py-1.5"><input type="checkbox" className="h-4 w-4 accent-primary" checked={smt} onChange={(e) => set(i, 'smt', e.target.checked)} aria-label={`${r.ref} SMT 조립 대상`} /></td>
                      <td className="px-1 py-1.5 font-medium whitespace-nowrap">{r.ref || '-'}</td>
                      <td className="px-1 py-1.5 min-w-[140px]"><p>{r.name}</p><p className="text-micro text-muted-foreground">{[r.manufacturer, r.part_no].filter(Boolean).join(' · ')}</p></td>
                      <td className="px-1 py-1.5 tabular-nums">{r.qty || '-'}</td>
                      <td className="px-1 py-1.5"><input className={input} style={{ width: 170 }} value={r.comment || ''} onChange={(e) => set(i, 'comment', e.target.value)} /></td>
                      <td className="px-1 py-1.5"><input className={input} style={{ width: 110 }} value={r.footprint || ''} onChange={(e) => set(i, 'footprint', e.target.value)} placeholder="0603" /></td>
                      <td className="px-1 py-1.5">
                        <input className={`${input} ${bad ? 'border-destructive' : ''}`} style={{ width: 110 }} value={r.lcsc || ''} onChange={(e) => set(i, 'lcsc', e.target.value)} onBlur={(e) => set(i, 'lcsc', normalizeLcsc(e.target.value))} placeholder="C25804" />
                        {bad && <p className="text-micro text-destructive">C+숫자 형식</p>}
                      </td>
                      <td className="px-1 py-1.5">
                        <select className="h-8 rounded-md border bg-transparent px-1 text-label" value={r.lcsc_type || ''} onChange={(e) => set(i, 'lcsc_type', e.target.value)}>
                          {LCSC_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8" title={isLcsc(lcsc) ? `LCSC에서 ${lcsc} 보기` : 'LCSC에서 찾기'}>
                          <a href={lcscSearchUrl(isLcsc(lcsc) ? lcsc : (r.part_no || r.comment || r.name || ''))} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-micro text-muted-foreground">
          내보낸 CSV는 JLCPCB SMT 주문의 부품표 양식(Comment · Designator · Footprint · LCSC Part #)입니다. SMT 대상만 넣고, 같은 값·실장 모양·부품번호는 한 줄로 묶으며, SW1~SW3 같은 범위는 SW1,SW2,SW3 로 풉니다.
          재고·가격은 LCSC 링크에서 확인하세요. 회로도·PCB 아트웍은 EasyEDA·KiCad에서 만듭니다.
        </p>
      </div>
    </div>
  );
}
