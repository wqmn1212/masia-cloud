import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { serviceGuideContent } from '@/components/guide/serviceGuideContent';

// 이용 가이드 맨 위: 서비스 사용 가이드의 업무 순서를 한눈에 (내용은 serviceGuideContent 를 그대로 쓴다)
export default function ServiceFlowSummary({ zh }) {
  const content = serviceGuideContent[zh ? 'zh' : 'ko'];
  return (
    <Card id="ch-flow" className="scroll-mt-28 p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-label font-semibold text-primary">{zh ? '服务使用指南' : '서비스 사용 가이드'}</div>
          <h2 className="mt-0.5 text-title font-bold">{zh ? '工作顺序一览' : '업무 순서 한눈에 보기'}</h2>
          <p className="mt-1 text-body text-muted-foreground">{zh ? '从客户需求到管理员工作的 9 个步骤。点击各步骤可查看检查清单与交接内容。' : '고객 요청부터 관리자가 하는 일까지 9단계입니다. 단계를 누르면 체크리스트와 넘길 내용을 볼 수 있습니다.'}</p>
        </div>
        <Link to="/service-guide" className="inline-flex items-center gap-1 text-label font-medium text-primary hover:underline">{zh ? '打开服务使用指南' : '서비스 사용 가이드 열기'}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {content.steps.map((step, i) => (
          <li key={step.id}>
            <Link to={`/service-guide#guide-${step.id}`} className="flex h-full gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-label font-bold tabular-nums text-primary">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0">
                <span className="block text-body font-semibold">{step.title}</span>
                <span className="mt-0.5 block text-caption text-muted-foreground">{step.owner}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
