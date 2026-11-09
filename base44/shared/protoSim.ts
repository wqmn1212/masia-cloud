// 시제품 동작 시뮬레이션 계산 (정격값 기반 정상 상태). 과도 응답·돌입 전류·마찰·관성은 계산하지 않는다.

const num = (v: any) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v: number, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
const MOTOR_KINDS = ['ROTARY_MOTOR', 'SERVO', 'SOLENOID', 'PUMP_FAN', 'LINEAR'];

export function simulate(sim: any) {
  const V = num(sim.supply_voltage_v) || 0;
  const limitA = num(sim.supply_limit_a);
  const acts = (sim.actuators || []).slice(0, 30);
  const steps = (sim.steps || []).slice(0, 60);
  const name = (a: any) => a.label || a.ref || '부품';
  const checks: any[] = [];
  const unknowns = new Set<string>();
  const pos: Record<string, number> = {};
  const tracks = acts.filter((a: any) => a.motion === 'ROTATE' || a.motion === 'TRANSLATE').map((a: any) => {
    pos[a.id] = 0;
    if (!a.part_name) unknowns.add(`${name(a)}: 3D 부품 미연결 — 애니메이션 제외`);
    if (!(num(a.speed) > 0)) unknowns.add(`${name(a)}: 속도 미입력 — 움직임 0으로 계산`);
    return { actuator_id: a.id, label: name(a), part_index: num(a.part_index), part_name: a.part_name || '', motion: a.motion, axis: ['X', 'Y', 'Z'].includes(a.axis) ? a.axis : 'Z', unit: a.motion === 'ROTATE' ? '°' : 'mm', keyframes: [{ t: 0, v: 0 }] };
  });

  for (const a of acts) {
    const rv = num(a.rated_voltage_v);
    if (rv == null) unknowns.add(`${name(a)}: 정격 전압 미입력 — 전압 적합성 미확인`);
    else if (V > rv * 1.1) checks.push({ severity: 'HIGH', title: `${name(a)} 과전압`, detail: `공급 ${V}V 가 정격 ${rv}V 보다 ${Math.round((V / rv - 1) * 100)}% 높습니다` });
    else if (V < rv * 0.9) checks.push({ severity: 'MEDIUM', title: `${name(a)} 전압 부족`, detail: `공급 ${V}V 가 정격 ${rv}V 보다 낮아 출력·속도가 떨어질 수 있습니다 (계산은 입력 속도 그대로)` });
    if (num(a.rated_current_a) == null) unknowns.add(`${name(a)}: 정격 전류 미입력 — 전류·전력 합계에서 제외`);
  }

  const series: any[] = [];
  const outSteps: any[] = [];
  let t = 0; let energy = 0; let charge = 0; let peakA = 0; let peakW = 0;
  for (const s of steps) {
    const d = Math.max(0.01, Math.min(3600, num(s.duration_s) || 0));
    const row: any = { t: round(t) };
    const active: string[] = [];
    let current = 0;
    for (const a of acts) {
      const st = (s.states || []).find((x: any) => x.actuator_id === a.id) || {};
      const duty = Math.max(0, Math.min(100, num(st.duty_pct) ?? 100)) / 100;
      const ra = num(a.rated_current_a);
      const c = st.on ? (ra == null ? 0 : ra * duty) : (num(a.idle_current_a) || 0);
      row[a.id] = round(c);
      current += c;
      if (st.on) active.push(name(a));
      const tr = tracks.find((x: any) => x.actuator_id === a.id);
      if (!tr) continue;
      const rate = st.on ? (num(a.speed) || 0) * duty * (st.direction === -1 ? -1 : 1) : 0;
      if (rate === 0) { tr.keyframes.push({ t: round(t + d), v: round(pos[a.id]) }); continue; }
      const lo = num(a.travel_min); const hi = num(a.travel_max);
      let target = pos[a.id] + rate * d;
      let limit: number | null = null;
      if (hi != null && target > hi) limit = hi;
      if (lo != null && target < lo) limit = lo;
      if (limit != null) {
        const hitT = Math.max(0, (limit - pos[a.id]) / rate);
        target = limit;
        if (hitT < d) {
          tr.keyframes.push({ t: round(t + hitT), v: round(limit) });
          checks.push({ severity: 'MEDIUM', step_id: s.id, title: `${name(a)} 행정 끝 도달`, detail: `${s.name} 시작 ${round(hitT, 2)}초 뒤 한계 ${limit}${tr.unit} 에 닿아 멈춥니다` });
        }
      }
      pos[a.id] = target;
      tr.keyframes.push({ t: round(t + d), v: round(target) });
    }
    const power = V * current;
    row.total_current_a = round(current);
    row.power_w = round(power);
    series.push(row);
    if (limitA && current > limitA) checks.push({ severity: 'HIGH', step_id: s.id, title: `${s.name} 전원 전류 초과`, detail: `합계 ${round(current)}A 가 전원 허용 ${limitA}A 를 넘습니다` });
    peakA = Math.max(peakA, current); peakW = Math.max(peakW, power);
    energy += power * d; charge += current * d;
    outSteps.push({ step_id: s.id, name: s.name, trigger: s.trigger || '', t_start: round(t), t_end: round(t + d), current_a: round(current), power_w: round(power), active, positions: Object.fromEntries(tracks.map((x: any) => [x.actuator_id, round(pos[x.actuator_id])])) });
    t += d;
  }
  if (series.length) series.push({ ...series[series.length - 1], t: round(t) });
  if (acts.some((a: any) => MOTOR_KINDS.includes(a.kind))) unknowns.add('모터·솔레노이드 기동(돌입) 전류와 가속·관성은 계산하지 않았습니다 — 정격값의 정상 상태만 반영');

  return {
    duration_s: round(t), supply_voltage_v: V, peak_current_a: round(peakA), avg_current_a: t ? round(charge / t) : 0,
    peak_power_w: round(peakW), energy_wh: round(energy / 3600, 4), steps: outSteps, series, tracks, checks, unknowns: [...unknowns],
  };
}