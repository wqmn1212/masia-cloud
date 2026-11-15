import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { unzipSync } from 'npm:fflate@0.8.2';

// 펌웨어 빌드 서버 연결: 워크벤치가 만든 스케치를 GitHub Actions(.github/workflows/firmware.yml)로 보내 컴파일하고,
// 끝나면 합친 바이너리(merged.bin)를 돌려준다. 브라우저는 받은 바이너리를 USB(WebSerial)로 ESP32 에 굽는다.
// 비밀값: FIRMWARE_GITHUB_TOKEN (저장소 Actions 읽기·쓰기 권한의 fine-grained 토큰), FIRMWARE_REPO (owner/repo), FIRMWARE_REF (브랜치, 기본 main)
// action: status | build {sketch, fqbn} | poll {request_id} | universal {mcu} (미리 빌드해 둔 공용 펌웨어 받기, 기다림 없음)
const GH = 'https://api.github.com';
const FQBN = /^esp32:esp32:(esp32|esp32c3|esp32s3)(:[A-Za-z0-9_=,]+)?$/;

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

async function gzipB64(text) {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const cfg = config();

    if (body.action === 'status') return Response.json({ ready: cfg.ready, repo: cfg.ready ? cfg.repo : null, ref: cfg.ref });
    if (!cfg.ready) return Response.json({ error: '빌드 서버가 아직 설정되지 않았습니다 (FIRMWARE_GITHUB_TOKEN · FIRMWARE_REPO 비밀값 필요).', ready: false }, { status: 400 });

    if (body.action === 'build') {
      const sketch = String(body.sketch || '');
      const fqbn = String(body.fqbn || '');
      if (!sketch.includes('void setup()') || sketch.length > 200000) return Response.json({ error: '스케치가 올바르지 않습니다.' }, { status: 400 });
      if (!FQBN.test(fqbn)) return Response.json({ error: '보드 이름(FQBN)이 올바르지 않습니다.' }, { status: 400 });
      const packed = await gzipB64(sketch);
      if (packed.length > 60000) return Response.json({ error: '스케치가 너무 커서 빌드 요청에 담을 수 없습니다.' }, { status: 400 });
      const request_id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const r = await gh(cfg, '/actions/workflows/firmware.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: cfg.ref, inputs: { request_id, fqbn, sketch_gz_b64: packed } }) });
      if (r.status !== 204) return Response.json({ error: `빌드 요청이 거절되었습니다 (GitHub ${r.status}): ${(await r.text()).slice(0, 300)}` }, { status: 502 });
      return Response.json({ request_id, started_at: new Date().toISOString() });
    }

    if (body.action === 'universal') {
      const mcu = String(body.mcu || '');
      if (!['esp32', 'esp32c3', 'esp32s3'].includes(mcu)) return Response.json({ error: '칩 종류가 올바르지 않습니다.' }, { status: 400 });
      // 푸시 빌드가 올려 둔 공용 펌웨어 묶음(universal-<커밋>) 중 가장 새것
      const list = await gh(cfg, '/actions/artifacts?per_page=100').then((r) => r.json());
      const arts = (list.artifacts || []).filter((a) => /^universal-[0-9a-f]{40}$/.test(a.name) && !a.expired);
      const a = arts.find((x) => x.workflow_run?.head_branch === cfg.ref) || arts[0];
      if (!a) return Response.json({ error: '미리 빌드한 공용 펌웨어가 없습니다. 저장소의 firmware 작업을 한 번 실행하세요.' }, { status: 404 });
      const zip = new Uint8Array(await gh(cfg, `/actions/artifacts/${a.id}/zip`).then((r) => r.arrayBuffer()));
      const files = unzipSync(zip);
      const name = Object.keys(files).find((n) => n.includes(`universal_${mcu}/`) && n.endsWith('.merged.bin')) || Object.keys(files).find((n) => n.includes(`universal_${mcu}.`) && n.endsWith('.merged.bin'));
      if (!name) return Response.json({ error: `공용 펌웨어 묶음에 ${mcu} 용 바이너리가 없습니다.` }, { status: 404 });
      return Response.json({ name: name.split('/').pop(), size: files[name].length, bin_b64: toB64(files[name]), built_at: a.created_at, commit: a.name.slice(10, 17) });
    }

    if (body.action === 'poll') {
      const id = String(body.request_id || '');
      if (!/^[a-z0-9]+-[0-9a-f]{8}$/.test(id)) return Response.json({ error: '빌드 번호가 올바르지 않습니다.' }, { status: 400 });
      const runs = await gh(cfg, '/actions/workflows/firmware.yml/runs?event=workflow_dispatch&per_page=30').then((r) => r.json());
      const run = (runs.workflow_runs || []).find((x) => String(x.display_title || x.name || '').includes(id));
      if (!run) return Response.json({ state: 'queued' });
      if (run.status !== 'completed') return Response.json({ state: run.status === 'in_progress' ? 'building' : 'queued', run_url: run.html_url });
      if (run.conclusion !== 'success') {
        // 컴파일 오류 줄을 찾아 돌려준다
        let log = '';
        try {
          const arts = await gh(cfg, `/actions/runs/${run.id}/artifacts`).then((r) => r.json());
          const a = (arts.artifacts || [])[0];
          if (a) {
            const zip = new Uint8Array(await gh(cfg, `/actions/artifacts/${a.id}/zip`).then((r) => r.arrayBuffer()));
            const files = unzipSync(zip);
            const name = Object.keys(files).find((n) => n.endsWith('.log'));
            if (name) log = new TextDecoder().decode(files[name]).split('\n').filter((l) => /error|오류/i.test(l)).slice(0, 15).join('\n');
          }
        } catch { /* 로그 없이 */ }
        return Response.json({ state: 'failed', conclusion: run.conclusion, run_url: run.html_url, log });
      }
      const arts = await gh(cfg, `/actions/runs/${run.id}/artifacts`).then((r) => r.json());
      const a = (arts.artifacts || []).find((x) => x.name === `firmware-${id}`) || (arts.artifacts || [])[0];
      if (!a) return Response.json({ state: 'failed', run_url: run.html_url, log: '빌드 결과 파일이 없습니다.' });
      const zip = new Uint8Array(await gh(cfg, `/actions/artifacts/${a.id}/zip`).then((r) => r.arrayBuffer()));
      const files = unzipSync(zip);
      const merged = Object.keys(files).find((n) => n.endsWith('.merged.bin'));
      if (!merged) return Response.json({ state: 'failed', run_url: run.html_url, log: '합친 바이너리(merged.bin)가 없습니다.' });
      return Response.json({ state: 'done', run_url: run.html_url, name: merged.split('/').pop(), size: files[merged].length, bin_b64: toB64(files[merged]) });
    }
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
