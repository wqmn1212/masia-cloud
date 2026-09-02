import React from 'react';
import { CLIENT_COLUMNS } from './clientBoardMeta';

export default function ClientStatusSummary({ cards }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {CLIENT_COLUMNS.map((col) => {
        const count = cards.filter((c) => c.status === col.id).length;
        return (
          <div key={col.id} className={`rounded-xl border p-3 ${col.color}`}>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
              <span className="text-xs font-medium">{col.label}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
        );
      })}
    </div>
  );
}