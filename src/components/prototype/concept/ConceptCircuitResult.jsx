import React from 'react';
import { AlertTriangle } from 'lucide-react';
import SimStats from '@/components/prototype/sim/SimStats';
import ConnectionList from '@/components/prototype/ConnectionList';
import ConceptNotes from '@/components/prototype/concept/ConceptNotes';
import { SEVERITY, VERIFY_STATUS, fmtDate } from '@/lib/prototype';

const Tag = ({ meta }) => <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-medium ${meta.className}`}>{meta.label}</span>;

export default function ConceptCircuitResult({ circuit }) {
  const calc = circuit.calc || {};
  const notes = Object.fromEntries((circuit.steps || []).map((s) => [s.id, s.note]));
  const problems = [...(calc.checks || []).map((c) => ({ ...c, source: '계산' })), ...(circuit.risks || []).map((r) => ({ ...r, source: 'AI 검토' }))];

  return (
    <div className="space-y-4">
      {circuit.stale && <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text"><AlertTriangle className="w-4 h-4" />이전 버전의 검토 결과입니다. 형상이 바뀌었으니 다시 실행해 주세요.</p>}
      <p className="text-body">{circuit.summary}</p>
      <SimStats result={calc} />

      <div className="space-y-1.5">
        <p className="text-label font-semibold">단계별 동작 (정격값 계산)</p>
        {(calc.steps || []).map((s, i) => (
          <div key={s.step_id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-label font-medium">{i + 1}. {s.name}</p>
              <p className="text-caption text-muted-foreground tabular-nums">{s.t_start}~{s.t_end}s</p>
              <p className="ml-auto text-label font-semibold tabular-nums">{s.current_a} A · {s.power_w} W</p>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">{s.active?.length ? `동작: ${s.active.join(', ')}` : '켜진 부하 없음'}{s.trigger ? ` · 조건: ${s.trigger}` : ''}</p>
            {notes[s.step_id] && <p className="mt-1 text-caption">{notes[s.step_id]}</p>}
          </div>
        ))}
      </div>

      {problems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-label font-semibold">위험</p>
          {problems.map((p, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2"><Tag meta={SEVERITY[p.severity] || SEVERITY.MEDIUM} /><p className="text-label font-medium">{p.title}</p><span className="ml-auto text-micro text-muted-foreground">{p.source}</span></div>
              <p className="text-caption text-muted-foreground">{p.detail}</p>
              {p.mitigation && <p className="text-caption"><span className="font-medium text-primary">개선 제안</span> {p.mitigation}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-label font-semibold">전기 부하 (계산에 쓴 정격값)</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-caption">
            <thead className="bg-secondary text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">부하</th><th className="px-3 py-2 text-right font-medium">정격 V</th><th className="px-3 py-2 text-right font-medium">정격 A</th><th className="px-3 py-2 text-right font-medium">대기 A</th><th className="px-3 py-2 text-left font-medium">출처</th></tr></thead>
            <tbody>
              {(circuit.actuators || []).map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">{a.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.rated_voltage_v ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.rated_current_a ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.idle_current_a ?? '-'}</td>
                  <td className="px-3 py-2"><Tag meta={a.value_source === 'USER' ? { label: '입력값', className: 'bg-success/15 text-success-text' } : VERIFY_STATUS.ASSUMED} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {circuit.components?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-label font-semibold">회로 구성 제안</p>
          {circuit.blocks?.length > 0 && <p className="text-caption text-muted-foreground">{circuit.blocks.map((b) => `${b.block}(${b.role})`).join(' → ')}</p>}
          {circuit.components.map((p, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-label font-medium">{p.ref ? `${p.ref} · ` : ''}{p.name}<span className="ml-2 text-caption font-normal text-muted-foreground">{[p.voltage, p.current].filter(Boolean).join(' / ')}</span></p>
                <p className="text-caption text-muted-foreground">{[p.function, p.basis].filter(Boolean).join(' — ')}</p>
              </div>
              <Tag meta={VERIFY_STATUS[p.verify_status] || VERIFY_STATUS.NEEDS_CHECK} />
            </div>
          ))}
        </div>
      )}
      {circuit.connections?.length > 0 && <div className="space-y-1.5"><p className="text-label font-semibold">연결</p><ConnectionList connections={circuit.connections} /></div>}

      <ConceptNotes groups={[
        { title: '미확인 값 (계산에서 빠지거나 확인 필요)', kind: 'unverified', items: [...(calc.unknowns || []), ...(circuit.unverified || [])] },
        { title: 'AI가 둔 가정', kind: 'assume', items: circuit.assumptions },
        { title: '이 계산이 다루지 않는 것', kind: 'limit', items: circuit.limitations },
      ]} />
      <p className="text-micro text-muted-foreground">{fmtDate(circuit.generated_at)} · {circuit.generated_by_name}</p>
    </div>
  );
}