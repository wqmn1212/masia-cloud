import React from 'react';
import { ScanSearch, AlertTriangle } from 'lucide-react';

const AXIS = { x: '폭', y: '높이', z: '깊이' };
const off = (img, v) => Math.round(Math.abs(v / img - 1) * 100);

// 첨부 이미지 측정 결과: 어떤 시점을 썼는지, 3D 비율이 이미지와 얼마나 맞는지, 앱이 무엇을 보정했는지
export default function ConceptImageFit({ fit }) {
  if (!fit) return null;
  const v = fit.views || {};
  const views = [['정면', (v.FRONT || 0) + (v.BACK || 0)], ['측면', v.SIDE || 0], ['윗면', v.TOP || 0]].filter(([, n]) => n > 0);
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-2.5">
      <p className="flex items-center gap-1.5 text-label font-semibold"><ScanSearch className="w-4 h-4 text-primary" />첨부 이미지 기준 맞춤</p>
      {fit.files?.length > 0 && <p className="text-caption text-muted-foreground">분석한 이미지: {fit.files.join(', ')}</p>}
      {views.length > 0 && <p className="text-caption">측정에 쓴 시점: {views.map(([k, n]) => `${k} ${n}`).join(' · ')}</p>}
      {fit.anchors?.length > 0 && <p className="text-caption">이미지에 적힌 치수: {fit.anchors.join(', ')}</p>}
      {fit.ratios?.length > 0 && (
        <table className="w-full text-caption tabular-nums">
          <thead><tr className="text-muted-foreground"><th className="text-left font-medium">비율</th><th className="text-right font-medium">이미지</th><th className="text-right font-medium">AI 형상</th><th className="text-right font-medium">보정 후</th></tr></thead>
          <tbody>
            {fit.ratios.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td><td className="text-right">{r.image}</td>
                <td className="text-right text-muted-foreground">{r.before} <span className="text-micro">({off(r.image, r.before)}%)</span></td>
                <td className="text-right font-medium">{r.after} <span className="text-micro text-muted-foreground">({off(r.image, r.after)}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(fit.scaled?.length > 0 || fit.snapped?.length > 0) && (
        <ul className="list-disc pl-4 text-caption space-y-0.5">
          {fit.scaled?.map((s) => <li key={s.axis}>전체 {AXIS[s.axis]} ×{s.factor} 보정</li>)}
          {fit.snapped?.length > 0 && <li>겉 부품 {fit.snapped.length}개 위치·크기를 이미지에 맞춤: {fit.snapped.map((s) => s.name).join(', ')}</li>}
        </ul>
      )}
      {fit.matched > 0 && fit.part_offset_before_pct != null && <p className="text-micro text-muted-foreground">이미지와 대조한 겉 부품 {fit.matched}개 · 보정 전 평균 위치 차이 {fit.part_offset_before_pct}%</p>}
      {fit.skipped?.length > 0 && <p className="text-micro text-muted-foreground">비율 측정에서 뺀 시점: {fit.skipped.join(', ')}</p>}
      {fit.warnings?.map((w) => <p key={w} className="flex items-start gap-1.5 text-caption text-warning-text"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
    </div>
  );
}
