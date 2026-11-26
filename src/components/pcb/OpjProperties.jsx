import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { patchOpjAtom } from '@/lib/pcbArt/opj';

export default function OpjProperties({ node, text, onChange, files = [] }) {
  const [error, setError] = useState('');
  const edit = (atom, value) => {
    try { onChange(patchOpjAtom(text, atom, value)); setError(''); }
    catch (e) { setError(e.message); }
  };
  const basename = name => (name || '').split(/[\\/]/).pop().toLowerCase();
  const reference = node.head === 'File' ? node.atoms[1]?.value : null;
  const matches = reference ? files.filter(f => basename(f.name) === basename(reference)) : [];
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-title font-semibold">선택 항목 · {node.head}</h2>
      {node.atoms.slice(1).map((atom, i) => <label key={i} className="block space-y-1"><span className="text-caption text-muted-foreground">{node.head === 'File' ? '참조 파일 경로' : node.head === 'ExpressProject' || node.head === 'Project' ? '프로젝트 이름' : `값 ${i + 1}`}</span><Input aria-label={`${node.head} 값 ${i + 1}`} value={atom.value} onChange={e => edit(atom, e.target.value)} /></label>)}
      {!node.atoms.slice(1).length && <p className="text-caption text-muted-foreground">이 항목은 하위 항목만 포함합니다.</p>}
      {reference && <p className="text-caption text-muted-foreground">{matches.length === 1 ? `시제품 등록 파일: ${matches[0].name}` : matches.length > 1 ? '같은 이름의 파일이 여러 개 등록되어 있습니다. 경로를 확인하세요.' : '이 참조 파일은 현재 시제품에 등록되어 있지 않습니다.'}</p>}
      {node.children.length > 0 && <dl className="space-y-2 text-caption">{node.children.map(child => <div key={child.id}><dt className="font-semibold">{child.head}</dt><dd className="break-all text-muted-foreground">{child.atoms.slice(1).map(a => a.value).join(' · ') || `${child.children.length}개 하위 항목`}</dd></div>)}</dl>}
      {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
    </div>
  );
}