import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

// 부품 보이기·숨기기 + 부품 크기(mm) 확인
export default function PartVisibilityList({ parts, visible, boxes, selected, onToggle, onShowAll, onSelect }) {
  if (!parts?.length) return <p className="text-caption text-muted-foreground">부품 정보가 없습니다.</p>;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-caption font-semibold text-muted-foreground">구성 부품 {parts.length}</p>
        <button type="button" onClick={onShowAll} className="text-caption text-primary hover:underline">모두 보기</button>
      </div>
      {parts.map((p, i) => (
        <div key={i} className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${selected === i ? 'bg-primary/10' : 'hover:bg-muted'}`}>
          <button
            type="button"
            onClick={() => onToggle(i)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            title={visible[i] ? '숨기기' : '보이기'}
          >
            {visible[i] ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => onSelect(selected === i ? -1 : i)} className="min-w-0 flex-1 text-left">
            <span className={`block truncate text-label ${visible[i] ? '' : 'text-muted-foreground line-through'}`}>{p.part_name}</span>
            {boxes?.[i] && (
              <span className="block text-micro text-muted-foreground">
                {boxes[i].map((n) => Math.round(n * 10) / 10).join(' × ')} mm
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}