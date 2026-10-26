import { base44 } from '@/api/base44Client';

// 새 견적 등록은 서버 함수를 거친다 — 팀 범위는 서버가 확정한다.
export default async function createQuotation(data) {
  const res = await base44.functions.invoke('quotationHistory', { action: 'create', data });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}