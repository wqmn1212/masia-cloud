import React from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, ClipboardCheck, Eye, Factory, Wrench, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/prototype/develop/DevBits';

// 6단계: 시제품 조립·시험·개선과 양산 준비로 이어지는 바로 가기, 그리고 지금까지의 점검표
export default function TestStep({ project, concept, circuits, dev }) {
  const files = project.files || [];
  const checks = [
    ['컨셉 3D 확정', !!concept],
    ['3D 도면(STEP) 올림', files.some((f) => /\.(step|stp)$/i.test(f.name || ''))],
    ['기능 목록 저장', (project.dev?.features || []).length > 0],
    ['회로 시작안·시뮬레이션', circuits.length > 0],
    ['블루투스 UUID 고정', !!project.dev?.uuid_base],
    ['펌웨어 버전 기록 (제작 탭)', !!project.build?.firmware_version],
  ];
  const links = [
    [Wrench, '조립 기록', '실제 부품·펌웨어 버전·배선 메모', `/prototypes/${project.id}?tab=build`],
    [Eye, '3D 검토', 'STEP 을 돌려 보며 부품 확인·시뮬레이션', `/prototypes/${project.id}?tab=viewer`],
    [FlaskConical, '시험·개선', '시험 기록과 불합격 항목 개선', `/prototypes/${project.id}?tab=tests`],
    [ClipboardCheck, '설계 검토', '요구사항 대비 설계 위험 검토', `/prototypes/${project.id}/review`],
    [Factory, '금형 검토', '사출 외장의 두께·구배·언더컷 점검', '/mold-review'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card title="시험·양산으로" icon={FlaskConical}>
        <div className="grid gap-2 sm:grid-cols-2">
          {links.map(([Icon, t, d, to]) => (
            <Link key={t} to={to} className="rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-primary/5">
              <p className="flex items-center gap-2 text-label font-semibold"><Icon className="w-4 h-4 text-primary" />{t}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">{d}</p>
            </Link>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">시험에서 바뀐 점은 컨셉 스튜디오의 변경 요청이나 3D 도면 치수로 되돌아가 고친 뒤, 회로·펌웨어를 다시 내보내는 순서로 반복합니다.</p>
      </Card>
      <Card title="진행 점검">
        <ul className="space-y-2">
          {checks.map(([t, ok]) => (
            <li key={t} className="flex items-center gap-2 text-label">{ok ? <CheckCircle2 className="w-4 h-4 text-success-text" /> : <Circle className="w-4 h-4 text-muted-foreground" />}<span className={ok ? '' : 'text-muted-foreground'}>{t}</span></li>
          ))}
        </ul>
        <p className="text-micro text-muted-foreground">기능 {dev.features?.length || 0}개 · {dev.mcu?.toUpperCase()}</p>
        <Button asChild variant="outline" size="sm" className="w-full"><Link to={`/prototypes/${project.id}?tab=tests`}>시험 기록하러 가기</Link></Button>
      </Card>
    </div>
  );
}
