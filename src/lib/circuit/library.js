// 자주 쓰는 실제 부품의 근사 모델 (데이터시트 대표값으로 맞춘 값)
// 시뮬레이터의 다이오드·에버스-몰·MOSFET 1단계 모델에 맞춘 근사이며, 제조사 SPICE 모델과 같지 않다.
// MOSFET 전달 계수(kp)는 데이터시트의 Rds(on) 에서 거꾸로 구했다: Rds ≈ 1 / (kp·(Vgs − Vth))

export const PART_MODELS = {
  diode: [
    { key: '1N4148', label: '1N4148 · 신호용', props: { is: 2.52e-9, n: 1.752, rs: 0.568 }, note: '고속 소신호 다이오드, 최대 200 mA' },
    { key: '1N4007', label: '1N4007 · 정류 1 A', props: { is: 7.03e-9, n: 1.808, rs: 0.0342 }, note: '범용 정류, 1 A·1000 V' },
    { key: '1N5819', label: '1N5819 · 쇼트키 1 A', props: { is: 3.17e-5, n: 1.373, rs: 0.051 }, note: '순방향 전압이 낮은 쇼트키, 1 A·40 V' },
  ],
  zener: [
    { key: 'BZX84C3V3', label: 'BZX84C3V3 · 3.3 V', props: { vz: 3.3, rs: 5 } },
    { key: 'BZX84C5V1', label: 'BZX84C5V1 · 5.1 V', props: { vz: 5.1, rs: 5 } },
    { key: '1N4742A', label: '1N4742A · 12 V 1 W', props: { vz: 12, rs: 2 } },
  ],
  led: [
    { key: 'LED5R', label: '5 mm 빨강 · 20 mA', props: { color: 'red', imax: 0.02, rs: 2 } },
    { key: 'LED5G', label: '5 mm 초록 · 20 mA', props: { color: 'green', imax: 0.02, rs: 3 } },
    { key: 'SMD3528W', label: '3528 흰색 SMD · 20 mA', props: { color: 'white', imax: 0.02, rs: 5 } },
    { key: 'SMD5730W', label: '5730 흰색 SMD · 150 mA', props: { color: 'white', imax: 0.15, rs: 1.5 } },
    { key: 'SMD2835WW', label: '2835 전구색 SMD · 60 mA', props: { color: 'warm', imax: 0.06, rs: 2.5 } },
  ],
  npn: [
    { key: '2N3904', label: '2N3904 · 소신호', props: { beta: 300, is: 6.73e-15 }, note: '200 mA·40 V' },
    { key: '2N2222A', label: '2N2222A · 범용', props: { beta: 200, is: 1.43e-14 }, note: '600 mA·40 V' },
    { key: 'BC547B', label: 'BC547B · 소신호', props: { beta: 290, is: 7.05e-15 }, note: '100 mA·45 V' },
    { key: 'S8050', label: 'S8050 · 스위칭', props: { beta: 200, is: 1e-14 }, note: '500 mA·25 V' },
  ],
  pnp: [
    { key: '2N3906', label: '2N3906 · 소신호', props: { beta: 180, is: 1.41e-15 }, note: '200 mA·40 V' },
    { key: 'BC557B', label: 'BC557B · 소신호', props: { beta: 290, is: 7e-15 }, note: '100 mA·45 V' },
    { key: 'S8550', label: 'S8550 · 스위칭', props: { beta: 200, is: 1e-14 }, note: '500 mA·25 V' },
  ],
  nmos: [
    { key: '2N7000', label: '2N7000 · 소신호', props: { vth: 2.1, kp: 0.3, lambda: 0.02 }, note: 'Rds(on) 약 1.8 Ω (Vgs 4.5 V), 200 mA·60 V' },
    { key: 'AO3400', label: 'AO3400 · 로직 레벨 SOT-23', props: { vth: 1.05, kp: 10.7, lambda: 0.01 }, note: 'Rds(on) 약 27 mΩ (Vgs 4.5 V), 5.7 A·30 V' },
    { key: 'IRLZ44N', label: 'IRLZ44N · 로직 레벨 전력', props: { vth: 1.5, kp: 13, lambda: 0.01 }, note: 'Rds(on) 약 22 mΩ (Vgs 5 V), 47 A·55 V' },
    { key: 'IRF540N', label: 'IRF540N · 전력 (10 V 구동)', props: { vth: 3, kp: 3.2, lambda: 0.01 }, note: 'Rds(on) 약 44 mΩ (Vgs 10 V), 33 A·100 V' },
  ],
  pmos: [
    { key: 'AO3401', label: 'AO3401 · 로직 레벨 SOT-23', props: { vth: 0.9, kp: 5.6, lambda: 0.01 }, note: 'Rds(on) 약 50 mΩ (Vgs −4.5 V), 4 A·30 V' },
    { key: 'IRF9540N', label: 'IRF9540N · 전력', props: { vth: 3, kp: 1.2, lambda: 0.01 }, note: 'Rds(on) 약 117 mΩ (Vgs −10 V), 23 A·100 V' },
  ],
  opamp: [
    { key: 'IDEAL15', label: '이상적 · ±15 V', props: { gain: 1e5, vmax: 15, vmin: -15 } },
    { key: 'LM358_5V', label: 'LM358 · 5 V 단전원', props: { gain: 1e5, vmax: 3.5, vmin: 0 }, note: '출력이 5 V 전원에서 약 3.5 V 까지만 올라감' },
    { key: 'RRIO_5V', label: '레일 투 레일 · 5 V', props: { gain: 1e5, vmax: 4.95, vmin: 0.05 } },
  ],
};

export const modelOf = (part) => (PART_MODELS[part.type] || []).find((m) => m.key === part.props?.model) || null;
