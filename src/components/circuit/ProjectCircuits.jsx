import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircuitBoard, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

// 시제품 PCB 탭: 이 시제품에 연결한 회로 시뮬레이션 목록과 바로 가기
export default function ProjectCircuits({ project }) {
  const { data: rows = [] } = useQuery({
    queryKey: ['circuitDesigns', 'project', project.id],
    queryFn: () => base44.entities.CircuitDesign.filter({ project_id: project.id }, '-updated_date', 20),
  });
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CircuitBoard className="h-4 w-4 text-primary" />
          <p className="text-label font-semibold">회로 동작 확인</p>
          <span className="text-caption text-muted-foreground">LED 구동·감광, 전원, 스위칭 회로를 그려 전압·전류를 미리 봅니다</span>
        </div>
        <Button size="sm" variant="outline" asChild><Link to={`/circuit-lab?project=${project.id}`}><Plus className="h-4 w-4" />새 회로 시뮬레이션</Link></Button>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rows.map((r) => (
            <Link key={r.id} to={`/circuit-lab?id=${r.id}&project=${project.id}`} className="rounded-lg border px-3 py-1.5 text-label hover:border-primary/50 hover:bg-primary/5">
              {r.title}<span className="ml-2 text-caption text-muted-foreground">부품 {r.part_count ?? '-'}개 · {String(r.updated_date || '').slice(0, 10)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
