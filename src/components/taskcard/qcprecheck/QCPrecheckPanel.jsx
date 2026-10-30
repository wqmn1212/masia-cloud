import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Copy, Plus, RefreshCw, Sparkles, X, Loader2, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { COMPONENT_TYPES, STAGES, SEVERITY as SEV_I18N, UNKNOWN, TASK_PRIORITY, optionLabel, factoryQuestions, sortItems } from '@/lib/qcPrecheck';
import { DEFAULT_AQL, DEFAULT_SPEC_ITEMS, SEVERITY, newItemKey } from '@/lib/qualitySpec';
import useQCPrecheck from './useQCPrecheck';

const sel = 'h-8 w-full rounded-md border bg-background px-2 text-xs';
const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }) : '');
const SPEC_FIELDS = ['aql_level', 'aql_critical', 'aql_major', 'aql_minor', 'sampling_note', 'items', 'note'];

// 구성품 사양 입력. 선택 칸은 '미정'(빈칸)·'모름·공장 확인'을 고를 수 있고, 빈칸은 '정하지 않은 사양'으로 남는다.
function SpecEditor({ comp, onSave, onClose }) {
  const { t, lang } = useLanguage();
  const def = COMPONENT_TYPES[comp.type];
  const [name, setName] = useState(comp.name);
  const [specs, setSpecs] = useState(comp.specs || {});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setSpecs((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setBusy(true);
    try { await onSave({ ...comp, name: name.trim() || comp.name, specs }); onClose(); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <label className="block max-w-sm space-y-1 text-[11px] text-muted-foreground">
        <span>{def[lang] || def.ko}</span>
        <Input className="h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {def.fields.map((f) => {
          const v = specs[f.key];
          const missing = !f.optional && !filled(v);
          const ring = missing ? 'border-chart-3 bg-chart-3/5' : '';
          return (
            <label key={f.key} className="space-y-1 text-[11px]">
              <span className="text-muted-foreground">{f[lang] || f.ko}{f.optional ? '' : ' *'}</span>
              {f.options ? (
                <select className={`${sel} ${ring}`} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">{t('qcp.notSet')}</option>
                  {f.options.map((o) => <option key={o.v} value={o.v}>{o[lang] || o.ko}</option>)}
                  <option value={UNKNOWN}>{t('qcp.unknown')}</option>
                </select>
              ) : (
                <div className="flex gap-1">
                  <Input className={`h-8 text-xs ${ring}`} type={f.number ? 'number' : 'text'} step="any" disabled={v === UNKNOWN}
                    placeholder={v === UNKNOWN ? t('qcp.unknown') : f.unit || ''} value={v === UNKNOWN ? '' : v ?? ''}
                    onChange={(e) => set(f.key, f.number && e.target.value !== '' ? Number(e.target.value) : e.target.value)} />
                  <Button type="button" size="sm" variant={v === UNKNOWN ? 'secondary' : 'ghost'} className="h-8 shrink-0 px-2 text-[10px]"
                    onClick={() => set(f.key, v === UNKNOWN ? '' : UNKNOWN)}>{lang === 'zh' ? '不清楚' : '모름'}</Button>
                </div>
              )}
            </label>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button size="sm" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t('qcp.saveSpecs')}</Button>
      </div>
    </div>
  );
}

function ItemRow({ item, comp, kase, onTask, onSpec, onDismiss, busy }) {
  const { t, lang } = useLanguage();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');
  const tx = (f) => (lang === 'zh' ? item[`${f}_cn`] || item[f] : item[f]);
  const decided = (item.decision || 'PENDING') !== 'PENDING';
  const sev = SEVERITY[item.severity] || SEVERITY.MAJOR;
  return (
    <li className={`space-y-1.5 rounded-lg border p-3 ${decided ? 'bg-muted/30' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={`border-0 text-[10px] ${sev.cls}`}>{lang === 'zh' ? SEV_I18N[item.severity]?.zh : sev.label}</Badge>
        <Badge variant="outline" className={`text-[10px] ${item.source === 'CASE' ? 'border-primary/30 text-primary' : ''}`}>{t(`qcp.source.${item.source}`)}</Badge>
        <span className="text-[11px] text-muted-foreground">{STAGES[item.stage]?.[lang] || STAGES[item.stage]?.ko}{comp ? ` · ${comp.name}` : ''}</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {decided ? (
            <Badge variant="secondary" className="text-[10px]">{t(`qcp.decision.${item.decision}`)}{item.decided_by_name ? ` · ${item.decided_by_name}` : ''}</Badge>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={busy} onClick={onTask}>{t('qcp.toTask')}</Button>
              {item.kind === 'RISK' && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={busy} onClick={onSpec}>{t('qcp.toSpec')}</Button>}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground" disabled={busy} onClick={() => setDismissing((x) => !x)}>{t('qcp.dismiss')}</Button>
            </>
          )}
        </div>
      </div>
      <p className={`text-sm font-medium ${decided ? 'text-muted-foreground' : ''}`}>{tx('title')}</p>
      {tx('how') && <p className="text-xs text-muted-foreground"><span className="text-foreground/80">{t('qcp.how')}</span> · {tx('how')}</p>}
      {tx('criteria') && <p className="text-xs text-muted-foreground"><span className="text-foreground/80">{t('qcp.criteria')}</span> · {tx('criteria')}</p>}
      {item.question_cn && <p className="text-xs text-muted-foreground"><span className="text-foreground/80">{t('qcp.question')}</span> · {item.question_cn}</p>}
      {item.factory_answer && <p className="whitespace-pre-line rounded bg-primary/5 px-2 py-1 text-xs"><span className="font-medium text-primary">{t('qcp.factoryAnswer')}</span> · {item.factory_answer}</p>}
      {kase && item.rule_id && <p className="text-[11px] text-primary">{t('qcp.source.CASE')}: {kase.issue_case}{kase.trigger_decision ? ` (${kase.trigger_decision})` : ''}</p>}
      {item.decision === 'DISMISSED' && item.dismiss_reason && <p className="text-[11px] text-muted-foreground">{item.dismiss_reason}</p>}
      {dismissing && !decided && (
        <div className="flex gap-1.5 pt-1">
          <Input className="h-8 text-xs" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('qcp.dismissReason')} />
          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => { onDismiss(reason.trim()); setDismissing(false); }}>{t('qcp.dismiss')}</Button>
        </div>
      )}
    </li>
  );
}

// 사전 QC 점검 (업무 탭, 품질 기준서 위): 견적 품목에서 구성품을 찾고, 정하지 않은 사양과 그 사양이 부르는 위험을 보여 준다.
// 규칙·우리 사례 점검은 즉시·무료, AI 보강은 버튼을 눌렀을 때만 (크레딧 사용).
export default function QCPrecheckPanel({ card, user }) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const p = useQCPrecheck(card);
  const { record } = p;
  const [editing, setEditing] = useState('');
  const [busy, setBusy] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const by = user?.full_name || user?.email || '';
  useEffect(() => { setEditing(''); }, [record?.id]);

  const act = async (kind, fn, done) => {
    setBusy(kind);
    try { await fn(); if (done) toast({ title: done }); }
    catch (e) { toast({ title: e?.response?.data?.error || e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };
  const typeLabel = (type) => COMPONENT_TYPES[type]?.[lang] || COMPONENT_TYPES[type]?.ko || type;
  const components = record?.components || [];
  const compOf = (key) => components.find((c) => c.key === key);
  const items = record?.items || [];
  const pending = items.filter((i) => (i.decision || 'PENDING') === 'PENDING');
  const missing = pending.filter((i) => i.kind === 'MISSING_SPEC');
  const questions = pending.filter((i) => i.kind === 'QUESTION');
  const risks = sortItems(items.filter((i) => i.kind === 'RISK'));
  const openRisks = risks.filter((i) => (i.decision || 'PENDING') === 'PENDING');
  const closedRisks = risks.filter((i) => (i.decision || 'PENDING') !== 'PENDING');
  // 처리 안 한 위험 5개까지 + 처리한 위험(흐리게)을 아래에. 합쳐 8개를 넘으면 '나머지 보기'
  const all = [...openRisks, ...closedRisks];
  const visible = showAll ? all : [...openRisks.slice(0, 5), ...closedRisks].slice(0, 8);
  const hidden = all.length - visible.length;
  const caseOf = (id) => p.cases.find((k) => k.id === id);

  const decide = (item, patch) => p.saveItems(items.map((i) => (i.key === item.key ? { ...i, ...patch, decided_by_name: by, decided_at: new Date().toISOString() } : i)));
  const createTask = async (item) => {
    const lines = (...xs) => xs.filter(Boolean).join('\n');
    const task = await base44.entities.TaskItem.create({
      tenant_id: card.tenant_id, card_id: card.id, status: 'TODO', priority: TASK_PRIORITY[item.severity] || 'HIGH', cn_manual: true,
      title: item.kind === 'MISSING_SPEC' ? `사양 확정: ${item.title}` : item.title,
      title_cn: item.kind === 'MISSING_SPEC' ? `规格确认：${item.title_cn || item.title}` : item.title_cn || item.title,
      description: lines(item.how && `확인·예방: ${item.how}`, item.criteria && `합격 기준: ${item.criteria}`, item.question_ko && `공장 질문: ${item.question_ko}`),
      description_cn: lines(item.how_cn && `确认·预防：${item.how_cn}`, item.criteria_cn && `合格标准：${item.criteria_cn}`, item.question_cn && `工厂问题：${item.question_cn}`),
    });
    qc.invalidateQueries({ queryKey: ['task-items', card.id] });
    return task;
  };
  const toTask = (item) => act(`task:${item.key}`, async () => { const task = await createTask(item); await decide(item, { decision: 'TASK', linked_id: task?.id || '' }); }, t('qcp.taskAdded'));
  const missingToTasks = () => act('tasks', async () => {
    const made = [];
    for (const item of missing) made.push([item, await createTask(item)]);
    await p.saveItems(items.map((i) => { const m = made.find(([x]) => x.key === i.key); return m ? { ...i, decision: 'TASK', linked_id: m[1]?.id || '', decided_by_name: by, decided_at: new Date().toISOString() } : i; }));
  }, t('qcp.taskAdded'));
  // 품질 기준서: 작성 중 판본이 있으면 거기에, 보낸 판본만 있으면 그 항목을 복사한 새 버전 초안에 더한다
  const toSpec = (item) => act(`spec:${item.key}`, async () => {
    const specs = await base44.entities.QualitySpec.filter({ card_id: card.id }, '-version', 1);
    const cur = specs[0];
    const row = { key: newItemKey(), label: item.title, label_cn: item.title_cn || '', standard: item.criteria || item.how || '', standard_cn: item.criteria_cn || item.how_cn || '', severity: item.severity, ok_photo_url: '', ng_photo_url: '' };
    let id;
    if (cur && cur.status !== 'SENT') { await base44.entities.QualitySpec.update(cur.id, { items: [...(cur.items || []), row] }); id = cur.id; }
    else {
      const base = cur ? Object.fromEntries(SPEC_FIELDS.map((k) => [k, cur[k] ?? (k === 'items' ? [] : '')])) : { ...DEFAULT_AQL, sampling_note: '', items: DEFAULT_SPEC_ITEMS(), note: '' };
      const created = await base44.entities.QualitySpec.create({ tenant_id: card.tenant_id, card_id: card.id, version: (cur?.version || 0) + 1, status: 'DRAFT', ...base, items: [...base.items, row], created_by_name: by });
      id = created?.id;
    }
    qc.invalidateQueries({ queryKey: ['quality-specs', card.id] });
    await decide(item, { decision: 'SPEC', linked_id: id || '' });
    toast({ title: cur?.status === 'SENT' ? t('qcp.specResend') : t('qcp.specAdded') });
  });
  const dismiss = (item, reason) => act(`dis:${item.key}`, () => decide(item, { decision: 'DISMISSED', dismiss_reason: reason }));
  const copyQuestions = () => act('copy', async () => {
    const { text, count } = factoryQuestions(pending);
    if (!count) return;
    await navigator.clipboard.writeText(text);
    await p.saveItems(items.map((i) => (i.kind === 'QUESTION' && (i.decision || 'PENDING') === 'PENDING' ? { ...i, decision: 'QUESTION', decided_by_name: by, decided_at: new Date().toISOString() } : i)));
  }, t('qcp.copied'));
  const runAI = () => act('ai', async () => {
    const res = await base44.functions.invoke('runQCPrecheckAI', { precheck_id: record.id });
    await p.refresh();
    const d = res?.data || res;
    if (d?.skipped) toast({ title: t('qcp.aiSame') });
    else if (d?.ok === false) throw new Error(t('qcp.aiFailed'));
    else toast({ title: t('qcp.aiDone'), description: d?.added != null ? `+${d.added}` : undefined });
  });
  const removeComp = (key) => act(`rm:${key}`, () => p.saveComponents(components.filter((c) => c.key !== key)));
  const addComp = (type) => act('add', async () => {
    const n = Math.max(0, ...components.map((c) => Number(String(c.key).replace(/\D/g, '')) || 0)) + 1;
    const comp = { key: `c${n}`, type, name: typeLabel(type), source_line: '', specs: {} };
    await p.saveComponents([...components, comp]);
    setEditing(comp.key);
  });

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" />{t('qcp.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('qcp.desc')}</p>
      </div>
      <div className="flex items-center gap-2">
        {record && (p.quoteChanged
          ? <span className="text-[11px] text-chart-3">{t('qcp.quoteChanged')}</span>
          : <span className="text-[11px] text-muted-foreground">{fmtDay(record.created_date)} {record.created_by_name} {t('qcp.checked')} · v{record.version}</span>)}
        <Button size="sm" variant={record ? 'outline' : 'default'} className="h-8 gap-1" disabled={!!busy || p.loading} onClick={() => act('run', () => p.run(by))}>
          {busy === 'run' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : record ? <RefreshCw className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
          {record ? t('qcp.rerun') : t('qcp.start')}
        </Button>
      </div>
    </div>
  );

  if (!record) {
    const pv = p.preview || { components: [], unmatched: [] };
    return (
      <section id="qc-precheck" className="mt-5 space-y-3 border-t pt-5">
        {header}
        <p className="text-xs text-muted-foreground">{t('qcp.intro')}{!p.quotation && ` ${t('qcp.noQuote')}`}</p>
        {!!pv.components.length && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{t('qcp.components')}</span>
            {pv.components.map((c) => <span key={c.key} className="rounded-full border px-2.5 py-0.5 text-xs">{typeLabel(c.type)} · {c.name}</span>)}
          </div>
        )}
      </section>
    );
  }

  return (
    <section id="qc-precheck" className="mt-5 space-y-3 border-t pt-5">
      {header}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">{t('qcp.components')}</span>
        {components.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs">
            <span className="text-muted-foreground">{typeLabel(c.type)}</span>{c.name !== typeLabel(c.type) && <span>· {c.name}</span>}
            <button type="button" aria-label={`${c.name} 빼기`} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted" disabled={!!busy} onClick={() => removeComp(c.key)}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {adding ? (
          <select className="h-7 rounded-full border bg-background px-2 text-xs" autoFocus defaultValue="" onBlur={() => setAdding(false)} onChange={(e) => { setAdding(false); if (e.target.value) addComp(e.target.value); }}>
            <option value="">{t('qcp.addComponent')}</option>
            {Object.keys(COMPONENT_TYPES).map((k) => <option key={k} value={k}>{typeLabel(k)}</option>)}
          </select>
        ) : (
          <button type="button" className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted" onClick={() => setAdding(true)}><Plus className="h-3 w-3" />{t('qcp.addComponent')}</button>
        )}
      </div>
      {!components.length && <p className="text-xs text-muted-foreground">{t('qcp.empty')}</p>}

      {(missing.length > 0 || questions.length > 0) && (
        <div className="space-y-1.5 rounded-md bg-chart-3/10 p-3 text-xs">
          {missing.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-chart-3">{t('qcp.todo')} {missing.length}</p>
                <Button size="sm" variant="outline" className="h-7 bg-background px-2 text-[11px]" disabled={!!busy} onClick={missingToTasks}>{t('qcp.todoToTask')}</Button>
              </div>
              <ul className="space-y-1">
                {missing.map((i) => (
                  <li key={i.key} className="flex items-start justify-between gap-2">
                    <span>· {lang === 'zh' ? i.title_cn || i.title : i.title}</span>
                    <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => setEditing(i.component_key)}>{t('qcp.editSpecs')}</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {questions.length > 0 && (
            <ul className="space-y-1">
              {questions.map((i) => <li key={i.key}>· {lang === 'zh' ? i.title_cn || i.title : i.title}</li>)}
            </ul>
          )}
        </div>
      )}

      {components.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {components.map((c) => {
            const def = COMPONENT_TYPES[c.type];
            const vals = (def?.fields || []).filter((f) => filled(c.specs?.[f.key])).map((f) => `${f[lang] || f.ko} ${optionLabel(c.type, f.key, c.specs[f.key], lang)}`);
            return (
              <li key={c.key} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{c.name}</p>
                  <span className="text-[11px] text-muted-foreground">{typeLabel(c.type)}{c.source_line && c.source_line !== c.name ? ` · ${c.source_line}` : ''}</span>
                  {editing !== c.key && <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 px-2 text-[11px]" onClick={() => setEditing(c.key)}><Pencil className="h-3 w-3" />{t('qcp.editSpecs')}</Button>}
                </div>
                {editing === c.key
                  ? <SpecEditor comp={c} onClose={() => setEditing('')} onSave={async (next) => { await p.saveComponents(components.map((x) => (x.key === c.key ? next : x))); toast({ title: t('qcp.saved') }); }} />
                  : <p className="text-xs text-muted-foreground">{vals.length ? vals.join(' · ') : t('qcp.notSet')}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {components.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">{t('qcp.risks')} {openRisks.length > 0 && <span className="text-muted-foreground">{openRisks.length}</span>}</p>
          {risks.length === 0 ? <p className="text-xs text-muted-foreground">{t('qcp.noRisks')}</p> : (
            <ul className="space-y-2">
              {visible.map((i) => (
                <ItemRow key={i.key} item={i} comp={compOf(i.component_key)} kase={caseOf(i.case_id)} busy={!!busy}
                  onTask={() => toTask(i)} onSpec={() => toSpec(i)} onDismiss={(r) => dismiss(i, r)} />
              ))}
            </ul>
          )}
          {(hidden > 0 || (showAll && all.length > 5)) && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAll((x) => !x)}>{showAll ? t('qcp.less') : `${t('qcp.more')} ${hidden}`}</button>
          )}
        </div>
      )}

      {components.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!!busy || record.ai_status === 'RUNNING'} onClick={runAI}>
            {busy === 'ai' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy === 'ai' ? t('qcp.aiRunning') : t('qcp.ai')} <span className="text-[10px] text-muted-foreground">({t('qcp.aiNote')})</span>
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!!busy || !factoryQuestions(pending).count} onClick={copyQuestions}><Copy className="h-3.5 w-3.5" />{t('qcp.copyQuestions')}</Button>
          {record.ai_status === 'FAILED' && <span className="text-[11px] text-destructive">{t('qcp.aiFailed')}</span>}
        </div>
      )}
    </section>
  );
}
