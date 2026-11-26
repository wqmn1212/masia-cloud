import React from 'react';

export default function OpjTreeNode({ node, selected, onSelect }) {
  const label = [node.head, ...node.atoms.slice(1).map(a => a.value)].join(' ');
  return (
    <li className="min-w-0">
      {node.children.length ? (
        <details open>
          <summary className="cursor-pointer py-1">
            <button type="button" aria-pressed={selected === node.id} className={`ml-1 rounded px-2 py-1 text-left break-all ${selected === node.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} onClick={e => { e.preventDefault(); onSelect(node.id); }}>{label}</button>
          </summary>
          <ul className="ml-3 border-l pl-2">{node.children.map(child => <OpjTreeNode key={child.id} node={child} selected={selected} onSelect={onSelect} />)}</ul>
        </details>
      ) : (
        <button type="button" aria-pressed={selected === node.id} className={`my-0.5 w-full rounded px-2 py-1 text-left break-all ${selected === node.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} onClick={() => onSelect(node.id)}>{label}</button>
      )}
    </li>
  );
}