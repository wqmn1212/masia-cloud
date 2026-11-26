import React, { useEffect, useMemo, useState } from 'react';
import { Rotate3D, Ruler, Triangle, Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MeasureCanvas from '@/components/prototype/measure/MeasureCanvas';
import PartVisibilityList from '@/components/prototype/measure/PartVisibilityList';
import BomMeasureList from '@/components/bom/BomMeasureList';
import { partsBounds, distanceMm, angleDeg, fmtMeasure } from '@/lib/measure3d';

const MODES = [['ORBIT', '회전', Rotate3D], ['DIST', '거리', Ruler], ['ANGLE', '각도', Triangle]];
const HINTS = {
  ORBIT: '드래그로 회전, 휠로 확대합니다. 오른쪽 목록의 눈 아이콘으로 부품을 보이고 숨깁니다.',
  DIST: '거리 측정: 모델 위에서 두 점을 차례로 찍습니다.',
  ANGLE: '각도 측정: 세 점을 찍습니다. 두 번째 점이 꼭짓점입니다.',
};
const HOME = { rotX: 0.5, rotY: 0.8, zoom: 1 };

// STEP 전체 조립품을 한 화면에 합쳐 보고 거리·각도를 재는 도면 뷰어
export default function BomAssemblyViewer({ parts }) {
  const meshParts = useMemo(() => parts.filter((p) => p.mesh?.positions?.length), [parts]);
  const bounds = useMemo(() => (meshParts.length ? partsBounds(meshParts) : null), [meshParts]);
  const [visible, setVisible] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [view, setView] = useState(HOME);
  const [mode, setMode] = useState('ORBIT');
  const [picks, setPicks] = useState([]);
  const [rows, setRows] = useState([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    setVisible(meshParts.map(() => true));
    setSelected(-1); setPicks([]); setRows([]); setActiveId(''); setView(HOME);
  }, [meshParts]);

  if (!bounds) return null;
  const need = mode === 'ANGLE' ? 3 : 2;

  const changeMode = (next) => { setMode(next); setPicks([]); };

  const handlePick = (hit) => {
    if (mode === 'ORBIT') return;
    const next = [...picks, hit];
    if (next.length < need) { setPicks(next); return; }
    const angle = mode === 'ANGLE';
    const id = `m-${Date.now()}`;
    setRows((prev) => [{
      id,
      label: `${angle ? '각도' : '거리'} ${prev.length + 1}`,
      unit: angle ? 'deg' : 'mm',
      value: angle ? angleDeg(next[0], next[1], next[2]) : distanceMm(next[0], next[1]),
      points: next,
      partNames: [...new Set(next.map((p) => meshParts[p.part]?.part_name).filter(Boolean))],
    }, ...prev]);
    setActiveId(id);
    setPicks([]);
  };

  const active = rows.find((r) => r.id === activeId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-auto text-title font-semibold">조립 도면 뷰어</p>
          {MODES.map(([key, text, Icon]) => (
            <Button key={key} size="sm" variant={mode === key ? 'default' : 'outline'} onClick={() => changeMode(key)}>
              <Icon className="h-4 w-4" />{text}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setView(HOME)}><Maximize className="h-4 w-4" />화면 맞춤</Button>
          {picks.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPicks([])}><RotateCcw className="h-4 w-4" />찍은 점 지우기</Button>}
        </div>
        <div className="mx-auto max-w-[820px]">
          <MeasureCanvas
            parts={meshParts}
            bounds={bounds}
            visible={visible}
            selectedPart={selected}
            view={view}
            setView={setView}
            picks={picks}
            overlays={active ? [active.points] : []}
            picking={mode !== 'ORBIT'}
            onPick={handlePick}
          />
        </div>
        <p className="text-micro text-muted-foreground">
          {HINTS[mode]}{mode !== 'ORBIT' && ` (${picks.length}/${need}점)`} 화면 측정값은 메시 기준 근사치입니다.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1 rounded-xl border bg-card p-4">
          <p className="text-caption font-semibold text-muted-foreground">전체 치수 (가로 × 세로 × 높이)</p>
          <p className="text-title font-semibold">{bounds.size.map((n) => fmtMeasure(n, 'mm')).join(' × ')}</p>
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-xl border bg-card p-3">
          <PartVisibilityList
            parts={meshParts}
            visible={visible}
            boxes={bounds.boxes}
            selected={selected}
            onToggle={(i) => setVisible((prev) => prev.map((on, k) => (k === i ? !on : on)))}
            onShowAll={() => setVisible(meshParts.map(() => true))}
            onSelect={setSelected}
          />
        </div>
        <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-xl border bg-card p-3">
          <p className="px-1 text-caption font-semibold text-muted-foreground">측정 {rows.length ? `(${rows.length})` : ''}</p>
          <BomMeasureList
            rows={rows}
            selectedId={activeId}
            onSelect={setActiveId}
            onDelete={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
          />
        </div>
      </div>
    </div>
  );
}