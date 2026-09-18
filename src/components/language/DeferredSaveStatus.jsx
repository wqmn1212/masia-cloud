import React from 'react';

const labels = {
  saving: '원문 저장 중… / 正在保存原文…',
  saved: '원문 저장됨 / 原文已保存',
  pending: '원문 저장됨 · 번역 대기 / 原文已保存 · 待翻译',
  translating: '원문 저장됨 · 일괄 번역 중… / 原文已保存 · 正在批量翻译…',
  translated: '원문·번역 저장됨 / 原文与译文已保存',
  translationError: '원문 저장됨 · 번역 미완료 / 原文已保存 · 翻译未完成',
  error: '원문 저장 실패 / 原文保存失败',
};
export default function DeferredSaveStatus({ status }) {
  return <div className="space-y-1 text-[11px] text-muted-foreground" aria-live="polite">
    <p className={status === 'error' || status === 'translationError' ? 'text-destructive' : ''}>{labels[status] || labels.saved}</p>
    <p>원문 자동저장 · 15초 입력 중단 또는 탭 이동·닫기 시 변경분만 번역 / 原文自动保存 · 停止输入15秒或离开时仅翻译变更内容</p>
  </div>;
}