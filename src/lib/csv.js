// 엑셀에서 바로 열리는 CSV (UTF-8 BOM 포함 → 한글이 깨지지 않음)
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob(['﻿', toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
export const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|[\]]/g, '').trim().slice(0, 60) || 'AEGIS';
