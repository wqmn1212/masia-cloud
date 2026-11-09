import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

// 전류·전력은 단계별 정상 상태값(계단형), 위치는 속도×시간 선형 계산
export default function SimCharts({ result, t, actuator }) {
  const track = (result.tracks || []).find((x) => x.actuator_id === actuator?.id);
  const posData = useMemo(() => (track?.keyframes || []).map((k) => ({ t: k.t, v: k.v })), [track]);
  const dur = result.duration_s || 1;
  const label = actuator ? actuator.label || actuator.ref || '부품' : '';
  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3">
        <p className="text-label font-semibold">전류·전력 파형 <span className="text-micro font-normal text-muted-foreground">계산값 · 공급 {result.supply_voltage_v}V · 정격 입력 기준 정상 상태</span></p>
        <div className="h-56 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="t" type="number" domain={[0, dur]} tick={axis} unit="s" />
              <YAxis yAxisId="a" tick={axis} unit="A" />
              <YAxis yAxisId="w" orientation="right" tick={axis} unit="W" />
              <Tooltip formatter={(v, n) => [v, n]} labelFormatter={(v) => `${v}초`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="a" type="stepAfter" dataKey="total_current_a" name="합계 전류 (A)" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="w" type="stepAfter" dataKey="power_w" name="전력 (W)" stroke="hsl(var(--chart-3))" dot={false} isAnimationActive={false} />
              {actuator && <Line yAxisId="a" type="stepAfter" dataKey={actuator.id} name={`${label} 전류 (A)`} stroke="hsl(var(--chart-5))" dot={false} isAnimationActive={false} />}
              <ReferenceLine yAxisId="a" x={t} stroke="hsl(var(--foreground))" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {track && (
        <div className="rounded-lg border p-3">
          <p className="text-label font-semibold">{label} 위치 <span className="text-micro font-normal text-muted-foreground">계산값 · {track.axis}축 {track.motion === 'ROTATE' ? '회전각' : '이동량'} ({track.unit})</span></p>
          <div className="h-40 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={posData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" type="number" domain={[0, dur]} tick={axis} unit="s" />
                <YAxis tick={axis} unit={track.unit} />
                <Tooltip labelFormatter={(v) => `${v}초`} />
                <Line type="linear" dataKey="v" name={`위치 (${track.unit})`} stroke="hsl(var(--chart-2))" dot={false} strokeWidth={2} isAnimationActive={false} />
                <ReferenceLine x={t} stroke="hsl(var(--foreground))" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}