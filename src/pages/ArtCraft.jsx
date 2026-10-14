import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Download, ExternalLink, Github, Loader2, Star, GitCommit, CircleDot, Info } from 'lucide-react';

// ArtCraft (storytold/artcraft) — 설치형 AI 이미지·영상 제작 프로그램.
// 앱 안에서 실행할 수는 없으므로 GitHub 공개 API 로 최신 버전·다운로드·변경 내역을 보여 준다.
const REPO = 'storytold/artcraft';
const API = `https://api.github.com/repos/${REPO}`;
const REPO_URL = `https://github.com/${REPO}`;
const SITE_URL = 'https://getartcraft.com/';

async function gh(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 403 || res.status === 429) throw new Error('GitHub 조회 한도를 넘었습니다. 잠시 뒤 다시 열어 주세요.');
  if (!res.ok) throw new Error(`GitHub 응답 오류 (${res.status})`);
  return res.json();
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(0)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);

/** 설치 파일만 골라 운영체제로 나눈다 (서명 · 자동 업데이트용 파일은 뺀다) */
function osOf(name) {
  const n = name.toLowerCase();
  if (/\.(sig|json|txt|sha256)$/.test(n)) return null;
  if (/\.(msi|exe)$/.test(n)) return 'Windows';
  if (/\.dmg$/.test(n) || /(darwin|macos|apple)/.test(n)) return 'macOS';
  if (/\.(appimage|deb|rpm)$/.test(n)) return 'Linux';
  return null;
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-bold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Loading() {
  return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />GitHub에서 불러오는 중...</div>;
}

function Failed({ error }) {
  return (
    <p className="text-xs text-muted-foreground">
      {error.message} <a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">GitHub에서 직접 보기</a>
    </p>
  );
}

function LatestRelease() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['artcraft-releases'],
    queryFn: () => gh('/releases?per_page=10'),
    staleTime: 30 * 60 * 1000, retry: 1,
  });
  if (isLoading) return <Loading />;
  if (error) return <Failed error={error} />;
  const release = (data || []).find((r) => !r.draft);
  if (!release) return <p className="text-xs text-muted-foreground">공개된 릴리스가 없습니다.</p>;

  const groups = {};
  for (const a of release.assets || []) {
    const os = osOf(a.name);
    if (os) (groups[os] ||= []).push(a);
  }
  const notes = (release.body || '').trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold">{release.name || release.tag_name}</span>
        {release.prerelease && <Badge variant="secondary">미리보기</Badge>}
        <span className="text-xs text-muted-foreground">{release.tag_name} · {fmtDate(release.published_at)}</span>
      </div>

      {Object.keys(groups).length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {['Windows', 'macOS', 'Linux'].filter((os) => groups[os]).map((os) => (
            <div key={os} className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{os}</p>
              <div className="space-y-1.5">
                {groups[os].map((a) => (
                  <Button key={a.id} asChild variant="outline" size="sm" className="h-auto w-full justify-start py-1.5 text-left text-xs">
                    <a href={a.browser_download_url} target="_blank" rel="noreferrer">
                      <Download className="h-3.5 w-3.5 flex-none" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="flex-none text-muted-foreground">{fmtSize(a.size)}</span>
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          이 릴리스에는 설치 파일이 없습니다. <a href={SITE_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">공식 사이트</a>에서 안정 버전을 받으세요.
        </p>
      )}

      {notes && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">변경 내용 (원문)</p>
          <pre className={`overflow-hidden whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-sans text-xs leading-relaxed text-foreground/80 ${expanded ? '' : 'max-h-40'}`}>
            {notes}
          </pre>
          {notes.length > 400 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-primary">
              {expanded ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RepoStatus() {
  const repo = useQuery({ queryKey: ['artcraft-repo'], queryFn: () => gh(''), staleTime: 30 * 60 * 1000, retry: 1 });
  const commits = useQuery({ queryKey: ['artcraft-commits'], queryFn: () => gh('/commits?per_page=6'), staleTime: 30 * 60 * 1000, retry: 1 });
  if (repo.isLoading) return <Loading />;
  if (repo.error) return <Failed error={repo.error} />;
  const r = repo.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />별 {Number(r.stargazers_count || 0).toLocaleString()}</span>
        <span className="flex items-center gap-1"><CircleDot className="h-3.5 w-3.5" />열린 이슈·PR {Number(r.open_issues_count || 0).toLocaleString()}</span>
        <span>마지막 반영 {fmtDate(r.pushed_at)}</span>
        {r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' && <span>라이선스 {r.license.spdx_id}</span>}
      </div>
      {commits.data?.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {commits.data.map((c) => (
            <li key={c.sha}>
              <a href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50">
                <GitCommit className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{(c.commit?.message || '').split('\n')[0]}</span>
                <span className="flex-none text-muted-foreground">{fmtDate(c.commit?.author?.date)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ArtCraft() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">ArtCraft</h1>
          <p className="text-xs text-muted-foreground">
            AI 이미지 · 영상 · 3D 제작 프로그램(오픈소스). PC에 설치해서 쓰며, 이 화면에서 최신 버전과 설치 파일을 확인합니다
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild variant="outline" size="sm">
            <a href={REPO_URL} target="_blank" rel="noreferrer"><Github className="h-4 w-4" />GitHub</a>
          </Button>
          <Button asChild size="sm">
            <a href={SITE_URL} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />공식 사이트</a>
          </Button>
        </div>
      </div>

      <Section title="비용 안내" icon={Info}>
        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li><b className="text-foreground">프로그램 자체는 무료</b>입니다. 소스가 공개된 오픈소스(Apache-2.0 · MIT)라 내려받아 설치하는 데 비용이 들지 않습니다.</li>
          <li><b className="text-foreground">이미지 · 영상 · 3D 생성은 비용이 들 수 있습니다.</b> 생성은 ArtCraft 계정의 크레딧(잔액이 없으면 생성 불가)이나, 연결한 외부 서비스(Grok, Midjourney, Sora 등)의 유료 계정으로 실행됩니다.</li>
          <li>회사 계정으로 쓸 때는 크레딧 충전 · 외부 서비스 구독을 누가 관리할지 먼저 정해 두세요. 요금은 공식 사이트에서 확인합니다.</li>
        </ul>
      </Section>

      <Section title="최신 버전 · 설치 파일" icon={Download}>
        <LatestRelease />
      </Section>

      <Section
        title="저장소 현황"
        icon={Github}
        action={<a href={`${REPO_URL}/commits`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">전체 변경 내역</a>}
      >
        <RepoStatus />
      </Section>
    </div>
  );
}
