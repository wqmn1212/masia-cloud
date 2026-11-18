// 고객 시연: 기능·규칙으로 '보여 줄 순서'를 만들고, 시뮬레이터를 그 순서대로 움직인다 (React 없이 — 검산에서도 그대로 돌린다)
// 단계: { key, title, caption, speed(시뮬레이션 배속), dur(실제 초), setup(s), tick?(s, 지난 초) }
import { setInput, stepSim, turnDial, setClock, lampModes, setLampMode, setLampBright, lampIsOn } from './deviceSim.js';
import { hhmm } from './rules.js';

const shortName = (f) => String(f?.name || '').split(/\s[(—-]/)[0].trim() || f?.name || '';
const clockAt = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/** 누르고 sec 초 뒤 떼기 */
export function tapInput(s, id, sec = 0.1) {
  setInput(s, { pressed: { ...s.input.pressed, [id]: true } }); stepSim(s, sec);
  setInput(s, { pressed: { ...s.input.pressed, [id]: false } }); stepSim(s, 0.05);
}

/** 이 제품으로 보여 줄 시연 순서. 조명 제품이 아니면 빈 목록 (그때는 직접 해 보기만) */
export function demoScript(dev) {
  const f = dev?.features || [];
  const rules = dev?.rules || [];
  const lights = f.filter((x) => x.kind === 'light');
  if (!lights.length) return [];
  const dial = f.find((x) => x.kind === 'encoder');
  const clock = f.find((x) => x.kind === 'display');
  const sched = rules.find((r) => r.type === 'schedule');
  const sw = sched && f.find((x) => x.id === sched.src && x.kind === 'switch');
  const bt = f.find((x) => x.kind === 'button' && rules.some((r) => r.type === 'event' && r.src === x.id && r.action === 'pair'));
  const modes = lampModes(f);
  const dialName = dial ? shortName(dial) : '';
  const lightsOn = (s) => { if (lampIsOn(s)) return; if (dial) tapInput(s, dial.id); else s.levels = { ...s.levels, ...Object.fromEntries(lights.map((x) => [x.id, s.lamp.bright])) }; };
  const lightsOff = (s) => { if (!lampIsOn(s)) return; if (dial) tapInput(s, dial.id); else s.levels = { ...s.levels, ...Object.fromEntries(lights.map((x) => [x.id, 0])) }; };
  const steps = [];

  steps.push({
    key: 'on', title: '켜기', speed: 1, dur: 3.5,
    caption: dial ? `${dialName}을 짧게 누르면 ${modes[0].label}이 60 %로 서서히 켜집니다. 번쩍이지 않게 부드럽게 올라옵니다.` : `${modes[0].label}이 켜집니다.`,
    setup: (s) => { if (sw) setInput(s, { switches: { ...s.input.switches, [sw.id]: false } }); lightsOff(s); setLampMode(s, modes[0].key); setLampBright(s, 60); lightsOn(s); },
  });
  modes.slice(1).forEach((m) => steps.push({
    key: `mode-${m.key}`, title: m.label, speed: 1, dur: 3,
    caption: dial ? `${dialName}을 길게 누를 때마다 빛이 바뀝니다 → ${m.label}.` : `${m.label}.`,
    // 다이얼이 있으면 실제처럼 길게 눌러 넘기고, 순서가 어긋나 있으면(직접 해 본 뒤) 그 빛으로 맞춘다
    setup: (s) => { lightsOn(s); if (dial) tapInput(s, dial.id, 0.9); if (s.lamp.face !== m.key) setLampMode(s, m.key); },
  }));
  if (dial) steps.push({
    key: 'bright', title: '밝기', speed: 1, dur: 5.5,
    caption: `${dialName}을 돌리면 밝기가 바뀝니다. 어두운 쪽은 1 %씩 세밀하게 내려가 잠들기 전 아주 은은한 빛까지 맞출 수 있습니다.`,
    setup: (s) => { lightsOn(s); setLampBright(s, 60); },
    // 0~2초: 100 %까지 올리고, 그다음 3 %까지 내린다
    tick: (s, e) => { const target = e < 2 ? 60 + 20 * e : Math.max(3, 100 - 36 * (e - 2)); const d = target - s.lamp.bright; if (Math.abs(d) >= (s.lamp.bright < 10 ? 1 : 5)) turnDial(s, dial.id, Math.sign(d)); },
  });
  if (clock) steps.push({
    key: 'clock', title: '시계', speed: 1, dur: 3,
    caption: `${shortName(clock)}가 아래 띠 패브릭 뒤에서 비칩니다. 불을 끄면 시계도 함께 꺼져 밤에 눈부시지 않습니다.`,
    setup: (s) => { lightsOn(s); setLampBright(s, 60); },
  });
  if (sched && sw) {
    const bed = hhmm(sched.bed), wake = hhmm(sched.wake);
    const dim = Number(sched.dim_min) || 0, rise = Number(sched.rise_min) || 0;
    const wakeL = lights.find((x) => x.id === sched.wake_dst) || lights[0];
    steps.push({
      key: 'sleep', title: '잠들 때', speed: 600, dur: Math.max(3, (dim + 2) * 60 / 600 + 0.5),
      caption: `수면 모드를 켜 두면 잘 시각 ${sched.bed} 의 ${dim}분 전부터 서서히 어두워지다 ${sched.bed}에 꺼집니다. (600배 빠르게)`,
      setup: (s) => { setClock(s, clockAt(bed - dim - 1)); setLampMode(s, modes[0].key); setLampBright(s, 60); lightsOn(s); setInput(s, { switches: { ...s.input.switches, [sw.id]: true } }); stepSim(s, 0.05); },
    });
    steps.push({
      key: 'wake', title: '일어날 때', speed: 600, dur: Math.max(3, (rise + 2) * 60 / 600 + 0.5),
      caption: `일어날 시각 ${sched.wake} 의 ${rise}분 전부터 ${shortName(wakeL)}이 해 뜨듯 밝아져 ${sched.wake}에 ${sched.wake_level} %가 됩니다. (600배 빠르게)`,
      setup: (s) => { setInput(s, { switches: { ...s.input.switches, [sw.id]: true } }); setClock(s, clockAt(wake - rise - 1)); stepSim(s, 0.05); },
    });
  }
  if (bt) steps.push({
    key: 'app', title: '앱 연결', speed: 1, dur: 3,
    caption: `${shortName(bt)}을 누르면 휴대폰 앱과 연결됩니다. 앱에서 밝기·수면 시각을 바꿀 수 있습니다.`,
    setup: (s) => { if (!s.input.app) tapInput(s, bt.id); },
  });
  steps.push({
    key: 'off', title: '끄기', speed: 1, dur: 2.5,
    caption: dial ? `${dialName}을 다시 짧게 누르면 꺼집니다.` : '꺼집니다.',
    setup: (s) => { if (sw) setInput(s, { switches: { ...s.input.switches, [sw.id]: false } }); stepSim(s, 0.05); lightsOff(s); },
  });
  return steps;
}

/** 한 단계를 처음부터 끝까지 돌린다 (검산·미리 계산용). 화면은 같은 일을 0.1초씩 나눠서 한다 */
export function runStep(s, step, realSec = step.dur) {
  step.setup(s);
  for (let e = 0; e < realSec - 1e-9; e += 0.1) { step.tick?.(s, e); stepSim(s, 0.1 * step.speed); }
}
