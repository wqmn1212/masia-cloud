import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { unzipSync } from 'npm:fflate@0.8.2';

// 기판 제조 묶음 서버 연결: 워크벤치 개발 설정을 GitHub Actions(.github/workflows/pcb.yml)로 보내
// KiCad 프로젝트 → 자동 배선(Freerouting) + GND 동박 → DRC → 거버·드릴 → JLCPCB 부품표·좌표 zip 을 받아 온다.
// 비밀값은 펌웨어 빌드와 같다: FIRMWARE_GITHUB_TOKEN, FIRMWARE_REPO, FIRMWARE_REF
// action: status | build {request: {dev, title, seed}} | poll {request_id}
const GH = 'https://api.github.com';
function config() {
  const token = Deno.env.get('FIRMWARE_GITHUB_TOKEN') || '';
  const repo = Deno.env.get('FIRMWARE_REPO') || '';
  const ref = Deno.env.get('FIRMWARE_REF') || 'main';
  return { token, repo, ref, ready: !!token && /^[\w.-]+\/[\w.-]+$/.test(repo) };
}
const gh = (cfg, path, init = {}) => fetch(`${GH}/repos/${cfg.repo}${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aegis-workbench', ...(init.headers || {}) },
});
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
async function gzipB64(text) {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
  return b64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const cfg = config();
    if (body.action === 'status') return Response.json({ ready: cfg.ready });
    if (!cfg.ready) return Response.json({ error: '빌드 서버가 아직 설정되지 않았습니다 (FIRMWARE_GITHUB_TOKEN · FIRMWARE_REPO 비밀값 필요).', ready: false }, { status: 400 });

    if (body.action === 'build') {
      const r0 = body.request || {};
      if (!r0.dev || !Array.isArray(r0.dev.features)) return Response.json({ error: '개발 설정이 없습니다.' }, { status: 400 });
      const packed = await gzipB64(JSON.stringify({ dev: r0.dev, title: String(r0.title || '').slice(0, 120), seed: String(r0.seed || 'x').slice(0, 64) }));
      if (packed.length > 60000) return Response.json({ error: '개발 설정이 너무 커서 요청에 담을 수 없습니다.' }, { status: 400 });
      const request_id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const r = await gh(cfg, '/actions/workflows/pcb.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: cfg.ref, inputs: { request_id, request_gz_b64: packed } }) });
      if (r.status !== 204) return Response.json({ error: `요청이 거절되었습니다 (GitHub ${r.status}): ${(await r.text()).slice(0, 300)}` }, { status: 502 });
      return Response.json({ request_id });
    }

    if (body.action === 'poll') {
      const id = String(body.request_id || '');
      if (!/^[a-z0-9]+-[0-9a-f]{8}$/.test(id)) return Response.json({ error: '요청 번호가 올바르지 않습니다.' }, { status: 400 });
      const runs = await gh(cfg, '/actions/workflows/pcb.yml/runs?event=workflow_dispatch&per_page=30').then((r) => r.json());
      const run = (runs.workflow_runs || []).find((x) => String(x.display_title || x.name || '').includes(id));
      if (!run) return Response.json({ state: 'queued' });
      if (run.status !== 'completed') return Response.json({ state: run.status === 'in_progress' ? 'building' : 'queued', run_url: run.html_url });
      const arts = await gh(cfg, `/actions/runs/${run.id}/artifacts`).then((r) => r.json());
      const a = (arts.artifacts || [])[0];
      if (!a) return Response.json({ state: 'failed', run_url: run.html_url, log: '결과 파일이 없습니다.' });
      const files = unzipSync(new Uint8Array(await gh(cfg, `/actions/artifacts/${a.id}/zip`).then((r) => r.arrayBuffer())));
      const zipName = Object.keys(files).find((n) => n.endsWith('pcb-package.zip'));
      const summaries = Object.keys(files).filter((n) => n.endsWith('-summary.json')).map((n) => { try { const j = JSON.parse(new TextDecoder().decode(files[n])); delete j.router_log; return j; } catch { return null; } }).filter(Boolean);
      if (run.conclusion !== 'success' || !zipName) return Response.json({ state: 'failed', run_url: run.html_url, summaries, log: run.conclusion });
      return Response.json({ state: 'done', run_url: run.html_url, summaries, size: files[zipName].length, zip_b64: b64(files[zipName]) });
    }
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
