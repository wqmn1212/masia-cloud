import React from 'react';
import { AlertTriangle, FileCheck2, FlaskConical, PackageCheck } from 'lucide-react';
import { VERSION_STATUS } from '@/lib/prototype';

// 단계별 상태 요약: 설계 검증 · 제작 · 시험 · 미해결 위험
export default function ProtoSummary({ project, versions, tests }) {
  const current = versions.find((v) => v.id === project.current_version_id);
  const latest = versions[0];
  const failing = tests.filter((t) => t.status === 'FAIL').length;
  const passed = tests.filter((t) => t.status === 'PASS').length;
  const risks = (current?.risks || latest?.risks || []).filter((r) => r.severity !== 'LOW');
  const diffParts = (project.build?.actual_parts || []).filter((p) => p.status !== 'MATCH').length;
  const tiles = [
    { icon: FileCheck2, label: '설계', value: current ? `v${current.version_no} 승인` : latest ? `v${latest.version_no} ${VERSION_STATUS[latest.status]?.label}` : '없음' },
    { icon: PackageCheck, label: '제작', value: project.build?.version_no ? `v${project.build.version_no} 조립${diffParts ? ` · 차이 ${diffParts}` : ''}` : '기록 없음' },
    { icon: FlaskConical, label: '시험', value: tests.length ? `합격 ${passed} / 불합격 ${failing} / 전체 ${tests.length}` : '계획 없음' },
    { icon: AlertTriangle, label: '미해결 위험', value: `${risks.length + failing}건`, warn: risks.length + failing > 0 },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-1.5 text-caption text-muted-foreground"><t.icon className={`w-3.5 h-3.5 ${t.warn ? 'text-warning' : ''}`} />{t.label}</p>
            <p className={`mt-1 text-body font-semibold ${t.warn ? 'text-warning-text' : ''}`}>{t.value}</p>
          </div>
        ))}
      </div>
      {risks.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-caption font-semibold text-warning-text">주요 위험</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption">{risks.slice(0, 5).map((r, i) => <li key={i}>• {r.title}</li>)}</ul>
        </div>
      )}
    </div>
  );
}