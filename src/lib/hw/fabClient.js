// 기판 제조 묶음 서버(pcbBuild → GitHub Actions pcb.yml) 호출: 자동 배선 + 거버·드릴 + JLCPCB 부품표·좌표
import { base44 } from '@/api/base44Client';
import { b64ToBytes } from '@/lib/devkit/flasher';

export const fabStatus = async () => (await base44.functions.invoke('pcbBuild', { action: 'status' })).data;

/** 요청 → 끝날 때까지 기다림. 돌려줌 { zip: Uint8Array, summaries, run_url } */
export async function fabricate(dev, { title, seed, onState, signal, timeoutMs = 30 * 60 * 1000, everyMs = 15000 } = {}) {
  const { request_id: id } = (await base44.functions.invoke('pcbBuild', { action: 'build', request: { dev, title, seed } })).data;
  const t0 = Date.now();
  for (;;) {
    if (signal?.aborted) throw new Error('기다리기를 멈췄습니다');
    if (Date.now() - t0 > timeoutMs) throw new Error('30분 안에 끝나지 않았습니다');
    await new Promise((r) => setTimeout(r, everyMs));
    const r = (await base44.functions.invoke('pcbBuild', { action: 'poll', request_id: id })).data;
    if (r.state === 'done') return { zip: b64ToBytes(r.zip_b64), summaries: r.summaries || [], run_url: r.run_url };
    if (r.state === 'failed') { const e = new Error(`제조 파일을 만들지 못했습니다${r.log ? ` (${r.log})` : ''}`); e.run_url = r.run_url; e.summaries = r.summaries; throw e; }
    onState?.(r.state, Math.round((Date.now() - t0) / 1000), r.run_url);
  }
}
