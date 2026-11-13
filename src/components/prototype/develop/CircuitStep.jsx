import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CircuitBoard, Loader2, Play, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import ProjectCircuits from '@/components/circuit/ProjectCircuits';
import { Card, CopyButton } from '@/components/prototype/develop/DevBits';
import { FEATURE_KINDS, MCUS, featureBom } from '@/lib/devkit/features';
import { starterCircuit, hasBlock } from '@/lib/devkit/circuitStarter';
import { actorName, errorText } from '@/lib/prototypeApi';

// 4단계: 기능 → 회로 블록 → 회로 시뮬레이터 시작 회로, 그리고 부품 목록
export default function CircuitStep({ project, dev, user }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const features = dev.features || [];
  const withBlock = features.filter((f) => hasBlock(f.kind));
  const bom = useMemo(() => featureBom(features, dev.mcu), [features, dev.mcu]);
  const bomText = bom.map((b) => `${b.name}\t${b.qty}\t${b.used_by.join(', ')}`).join('\n');

  const create = async () => {
    setBusy(true);
    try {
      const c = starterCircuit(features, { supply_v: dev.supply_v });
      const rec = await base44.entities.CircuitDesign.create({
        tenant_id: user.tenant_id, title: `${project.title} 기능 회로 시작안`, project_id: project.id, project_title: project.title,
        description: `기능 ${c.blocks.length}개: ${c.blocks.map((b) => b.name).join(', ')}. MCU 핀은 3.3 V 전원·펄스로 바꿔 놓았습니다.`,
        circuit: { version: 1, parts: c.parts, dt: c.dt }, part_count: c.parts.filter((p) => p.type !== 'wire').length,
        created_by_name: actorName(user), updated_by_name: actorName(user),
      });
      qc.invalidateQueries({ queryKey: ['circuitDesigns'] });
      nav(`/circuit-lab?id=${rec.id}&project=${project.id}`);
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card title="기능별 회로 블록" icon={CircuitBoard}
          actions={<Button size="sm" onClick={create} disabled={!withBlock.length || busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}회로 시작안 만들어 시뮬레이터에서 열기</Button>}>
          {!features.length && <p className="text-caption text-muted-foreground">3단계에서 기능을 먼저 추가하세요.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => {
              const k = FEATURE_KINDS[f.kind];
              return (
                <div key={f.id} className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-label font-semibold">{f.name}<span className="ml-auto text-micro font-normal text-muted-foreground tabular-nums">{Number.isInteger(f.pin) ? `GPIO${f.pin}` : '핀 없음'}</span></p>
                  <p className="mt-1 text-caption text-muted-foreground">{k.block}</p>
                  {!hasBlock(f.kind) && <p className="mt-1 text-micro text-muted-foreground">회로 블록 없음 (펌웨어 명령만)</p>}
                </div>
              );
            })}
          </div>
          <p className="text-micro text-muted-foreground">시작안은 기능마다 MCU 핀을 3.3 V 전원·PWM 펄스로 바꿔 놓은 작은 회로들입니다. 시뮬레이터에서 저항·소자 값을 바꿔 전류·발열을 확인한 뒤, 실제 회로도(MCU·전원부 포함)는 PCB 설계에서 그립니다.</p>
        </Card>

        <Card title="부품 목록 (초안)" icon={Package} tag={(MCUS[dev.mcu] || MCUS.esp32c3).module} actions={<CopyButton text={bomText} label="표 복사" />}>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-caption">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground"><tr><th className="py-1.5 pr-2 font-medium">부품</th><th className="py-1.5 pr-2 text-right font-medium">수량</th><th className="py-1.5 font-medium">쓰는 곳</th></tr></thead>
              <tbody>
                {bom.map((b) => (
                  <tr key={b.name} className="border-t align-top"><td className="py-1.5 pr-2">{b.name}</td><td className="py-1.5 pr-2 text-right tabular-nums">{b.qty}</td><td className="py-1.5 text-muted-foreground">{b.used_by.join(', ')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-micro text-muted-foreground">부품 번호(LCSC)는 PCB 부품 탭에서 확정합니다.</p>
        </Card>
      </div>
      <ProjectCircuits project={project} />
    </div>
  );
}
