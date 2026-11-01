import React from 'react';
import { Eye } from 'lucide-react';

export const LEVEL_STYLE = {
  hi: { label: '높음', zh: '高', className: 'bg-destructive/15 text-destructive' },
  mid: { label: '주의', zh: '注意', className: 'bg-warning/15 text-warning-text' },
  ok: { label: '양호', zh: '良好', className: 'bg-success/15 text-success-text' },
  info: { label: '확인', zh: '确认', className: 'bg-muted text-muted-foreground' },
};

/** 검토 결과 목록. 항목의 '보기'를 누르면 뷰어가 그 보기 방식과 위치로 바뀐다 */
export default function MoldIssueList({ items, lang = 'ko', onShow }) {
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const lv = LEVEL_STYLE[it.level] || LEVEL_STYLE.info;
        return (
          <div key={it.id} className="rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-micro font-bold ${lv.className}`}>{lang === 'zh' ? lv.zh : lv.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold leading-snug">{it.title[lang]}</p>
                <p className="mt-1 text-caption leading-relaxed text-muted-foreground break-keep">{it.text[lang]}</p>
              </div>
              {it.mode && (
                <button
                  type="button"
                  onClick={() => onShow(it)}
                  className="flex flex-none items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold text-primary hover:bg-primary/10"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {lang === 'zh' ? '查看' : '보기'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
