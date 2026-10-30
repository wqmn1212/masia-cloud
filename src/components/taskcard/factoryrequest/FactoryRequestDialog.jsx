import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KIND_LABEL, PRESETS, DEFAULT_DAYS, MAX_ITEMS } from '@/lib/factoryRequest';

const chip = (on) => `rounded-full border px-2.5 py-1 text-caption ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`;
const sel = 'h-8 rounded-md border bg-background px-2 text-xs';

// 공장에 받을 항목 고르기: 자주 쓰는 사진·서류, 이 카드의 일정 단계(완료 보고), 사전 QC 공장 질문, 직접 입력
export default function FactoryRequestDialog({ card, open, onClose, pending, onCreate }) {
  const { lang } = useLanguage();
  const L = (ko, zh) => (lang === 'zh' ? zh : ko);
  const [picked, setPicked] = useState([]);
  const [custom, setCustom] = useState({ kind: 'PHOTO', label_ko: '', label_cn: '' });
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [message, setMessage] = useState('');
  useEffect(() => { if (open) { setPicked([]); setDays(DEFAULT_DAYS); setMessage(''); setCustom({ kind: 'PHOTO', label_ko: '', label_cn: '' }); } }, [open]);

  const { data: milestones = [] } = useQuery({ queryKey: ['card-milestones', card.id], enabled: open, queryFn: () => base44.entities.CardMilestone.filter({ card_id: card.id }, 'seq', 100) });
  const { data: precheck = [] } = useQuery({ queryKey: ['qc-precheck', card.id], enabled: open, queryFn: () => base44.entities.QCPrecheck.filter({ card_id: card.id }, '-version', 1) });
  const questions = (precheck[0]?.items || []).filter((i) => i.kind === 'QUESTION' && i.decision !== 'DISMISSED' && !i.factory_answer);
  const steps = milestones.filter((m) => m.status !== 'done');

  const id = (x) => `${x.kind}:${x.milestone_id || x.precheck_item_key || x.label_ko}`;
  const has = (x) => picked.some((p) => id(p) === id(x));
  const toggle = (x) => setPicked((list) => (has(x) ? list.filter((p) => id(p) !== id(x)) : list.length >= MAX_ITEMS ? list : [...list, x]));
  const addCustom = () => {
    if (!custom.label_ko.trim() && !custom.label_cn.trim()) return;
    toggle({ ...custom, label_ko: custom.label_ko.trim(), label_cn: custom.label_cn.trim() });
    setCustom((c) => ({ ...c, label_ko: '', label_cn: '' }));
  };
  const customs = picked.filter((p) => !PRESETS.some((x) => id(x) === id(p)) && !p.milestone_id && !p.precheck_item_key);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{L('공장에 요청', '向工厂索取')}</DialogTitle>
          <DialogDescription className="text-label">{L('공장이 받을 항목을 고르세요. 링크와 PIN을 위챗으로 보내면 공장 담당자가 휴대폰 중국어 화면에서 올립니다.', '选择工厂需要提交的项目。通过微信发送链接和验证码，工厂负责人可在手机中文页面上传。')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-label font-medium">{L('사진·서류', '照片·文件')}</p>
            <div className="flex flex-wrap gap-1.5">{PRESETS.map((x) => <button key={id(x)} type="button" className={chip(has(x))} onClick={() => toggle(x)}>{lang === 'zh' ? x.label_cn : x.label_ko}</button>)}</div>
          </div>
          {steps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-label font-medium">{L('일정 단계 완료 보고', '进度完成报告')}</p>
              <div className="flex flex-wrap gap-1.5">{steps.map((m) => { const x = { kind: 'MILESTONE', milestone_id: m.id, label_ko: `${m.label} 완료 보고`, label_cn: `${m.label_cn || m.label} 完成报告` }; return <button key={m.id} type="button" className={chip(has(x))} onClick={() => toggle(x)}>{lang === 'zh' ? m.label_cn || m.label : m.label}</button>; })}</div>
            </div>
          )}
          {questions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-label font-medium">{L('사전 QC 공장 질문', 'QC事前检查·工厂问题')}</p>
              <div className="space-y-1">{questions.map((q) => { const x = { kind: 'ANSWER', precheck_item_key: q.key, label_ko: q.question_ko || q.title, label_cn: q.question_cn || q.title_cn || q.title }; return (
                <label key={q.key} className="flex items-start gap-2 text-caption"><input type="checkbox" className="mt-0.5" checked={has(x)} onChange={() => toggle(x)} /><span>{q.question_cn || q.title}{q.question_ko ? <span className="text-muted-foreground"> · {q.question_ko}</span> : null}</span></label>
              ); })}</div>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-label font-medium">{L('직접 추가', '自定义')}</p>
            <div className="grid grid-cols-[96px_1fr] gap-1.5 sm:grid-cols-[96px_1fr_1fr_auto]">
              <select className={sel} value={custom.kind} onChange={(e) => setCustom((c) => ({ ...c, kind: e.target.value }))}>{['PHOTO', 'DOC', 'ANSWER'].map((k) => <option key={k} value={k}>{KIND_LABEL[k][lang === 'zh' ? 'cn' : 'ko']}</option>)}</select>
              <Input className="h-8 text-xs" value={custom.label_ko} onChange={(e) => setCustom((c) => ({ ...c, label_ko: e.target.value }))} placeholder={L('한국어 (예: 금형 수정 사진)', '韩语')} />
              <Input className="col-span-2 h-8 text-xs sm:col-span-1" value={custom.label_cn} onChange={(e) => setCustom((c) => ({ ...c, label_cn: e.target.value }))} placeholder={L('중국어 (공장에 보임)', '中文（工厂可见）')} />
              <Button type="button" size="sm" variant="outline" className="col-span-2 h-8 gap-1 sm:col-span-1" onClick={addCustom}><Plus className="h-3.5 w-3.5" />{L('추가', '添加')}</Button>
            </div>
            {customs.length > 0 && <div className="flex flex-wrap gap-1.5">{customs.map((p) => <span key={id(p)} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption">{KIND_LABEL[p.kind][lang === 'zh' ? 'cn' : 'ko']} · {p.label_cn || p.label_ko}<button type="button" aria-label="remove" onClick={() => toggle(p)}><X className="h-3 w-3" /></button></span>)}</div>}
          </div>
          <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
            <label className="text-label">{L('링크 기한 (일)', '链接有效期（天）')}<Input className="mt-1 h-8 text-xs" type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} /></label>
            <label className="text-label">{L('공장에 보일 안내 (중국어, 선택)', '给工厂的说明（选填）')}<Textarea className="mt-1 min-h-[34px] text-xs" rows={1} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="例：请在11月5日前上传印刷完成的照片" /></label>
          </div>
        </div>

        <DialogFooter className="items-center gap-2">
          <span className="mr-auto text-caption text-muted-foreground">{L(`${picked.length}개 항목`, `${picked.length} 项`)}</span>
          <Button variant="ghost" onClick={onClose} disabled={pending}>{L('취소', '取消')}</Button>
          <Button disabled={pending || !picked.length} onClick={() => onCreate({ items: picked, days: Number(days) || DEFAULT_DAYS, message_cn: message })}>{pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{L('링크 만들기', '生成链接')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
