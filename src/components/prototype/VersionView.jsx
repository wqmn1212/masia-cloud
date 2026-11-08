import React from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, HelpCircle, Lightbulb, Shuffle } from 'lucide-react';
import Pill from '@/components/prototype/Pill';
import BomTable from '@/components/prototype/BomTable';
import ConnectionList from '@/components/prototype/ConnectionList';
import { SEVERITY } from '@/lib/prototype';

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-label font-semibold text-muted-foreground">{title}</h3>
    {children}
  </section>
);
const Text = ({ value }) => (value ? <div className="prose prose-sm max-w-none text-body"><ReactMarkdown>{value}</ReactMarkdown></div> : <p className="text-caption text-muted-foreground">-</p>);

const Notes = ({ icon: Icon, title, items, tone }) => (items?.length ? (
  <div className={`rounded-lg p-3 ${tone}`}>
    <p className="flex items-center gap-1.5 text-label font-semibold"><Icon className="w-4 h-4" />{title} {items.length}</p>
    <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-caption">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
  </div>
) : null);

export default function VersionView({ version: v }) {
  return (
    <div className="space-y-6">
      {v.summary && <p className="text-body">{v.summary}</p>}
      <div className="grid gap-2 md:grid-cols-3">
        <Notes icon={HelpCircle} title="누락 정보" items={v.missing} tone="bg-warning/10 text-warning-text" />
        <Notes icon={Shuffle} title="모순" items={v.contradictions} tone="bg-destructive/10 text-destructive" />
        <Notes icon={Lightbulb} title="가정" items={v.assumptions} tone="bg-muted text-muted-foreground" />
      </div>
      {v.risks?.length > 0 && (
        <Section title="위험">
          <ul className="space-y-2">
            {v.risks.map((r, i) => (
              <li key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /><span className="text-body font-medium">{r.title}</span><Pill meta={SEVERITY[r.severity]} /></div>
                {r.detail && <p className="mt-1 text-caption text-muted-foreground">{r.detail}</p>}
                {r.mitigation && <p className="mt-1 text-caption">대응: {r.mitigation}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="제품 구성과 동작 원리">
        <Text value={v.operating_principle} />
        {v.architecture?.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {v.architecture.map((a, i) => <div key={i} className="rounded-lg border p-3"><p className="text-label font-semibold">{a.block}</p><p className="text-caption text-muted-foreground">{a.role}</p></div>)}
          </div>
        )}
      </Section>
      <Section title="PCB 부품표"><BomTable bom={v.bom} /></Section>
      <Section title="연결 관계"><ConnectionList connections={v.connections} /></Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="전원 예산"><Text value={v.power_budget} /></Section>
        <Section title="회로 설계 메모"><Text value={v.circuit_notes} /></Section>
        <Section title="사출 구조"><Text value={v.mechanical_notes} /></Section>
        <Section title="금형 설계 초안"><Text value={v.mold_notes} /></Section>
      </div>
      <Section title="펌웨어 초안">
        <Text value={v.firmware_notes} />
        {v.firmware_draft && <pre className="max-h-[420px] overflow-auto rounded-lg bg-sidebar p-4 text-caption text-sidebar-foreground"><code>{v.firmware_draft}</code></pre>}
      </Section>
    </div>
  );
}