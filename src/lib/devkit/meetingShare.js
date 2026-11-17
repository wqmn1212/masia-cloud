// 고객과 공유하는 미팅 내용: 내부 정보(핀·부품·원가 세부·공장 견적)는 빼고 진행 단계·외장·기능 이름·결정 사항·할 일만 담는다.
import { meetingSteps } from './meetingReport.js';
import { FEATURE_KINDS } from './features.js';
import { TEMPLATES } from '../cad/catalog.js';

const lines = (s) => String(s || '').split('\n').map((x) => x.replace(/^[-·]\s*/, '').trim()).filter(Boolean);

export function shareSnapshot(project, dev, { concept, circuits = [] } = {}) {
  const m = dev.meeting || {};
  const md = dev.mold_design;
  const T = md?.template ? TEMPLATES[md.template] : null;
  const summary = [
    ...(T ? [`외장: ${T.label}${md.summary ? ` · 사출 부품 ${md.summary.parts.filter((p) => p.mold).length}개` : ''}`] : []),
    ...(T ? [`주요 치수: ${(T.params || []).filter((p) => md.params?.[p.key] != null).slice(0, 6).map((p) => `${p.label} ${md.params[p.key]}${p.unit ? ` ${p.unit}` : ''}`).join(', ')}`] : []),
    ...((dev.features || []).length ? [`기능 ${dev.features.length}개: ${dev.features.map((f) => `${f.name} (${FEATURE_KINDS[f.kind]?.label || f.kind})`).join(', ')}`] : []),
    ...(dev.freeze ? [`설계 확정본 v${dev.freeze.version} (${String(dev.freeze.at || '').slice(0, 10)})`] : []),
  ];
  return {
    title: project.title, device: dev.device_name || '', date: new Date().toISOString().slice(0, 10), attendees: m.attendees || '',
    steps: meetingSteps(project, dev, { concept, circuits }).map((s) => ({ label: s.label, done: s.done, detail: s.key === 'circuit' || s.key === 'ble' ? (s.done ? '완료' : '진행 중') : s.detail })),
    summary, decisions: lines(m.decisions), actions: lines(m.actions),
  };
}

export const shareLink = (origin, token) => `${String(origin).replace(/\/$/, '')}/m/${token}`;
export const shareInvite = ({ link, pin, title, expires_at }) => `[${title}] 개발 미팅 내용을 공유드립니다.\n${link}\nPIN ${pin}\n(${String(expires_at || '').slice(0, 10)} 까지 열립니다. 결정 사항을 확인하시고 “확인”을 눌러 주세요.)`;
