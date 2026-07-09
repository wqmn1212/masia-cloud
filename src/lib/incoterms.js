// Incoterms 2020 — 11가지 국제무역 거래조건 (+ 레거시 항구 지정 FOB)
export const INCOTERMS_2020 = [
  // 모든 운송 수단 사용 가능 (7가지)
  { value: 'EXW', label: 'EXW — Ex Works (공장 인도)', full: 'EXW (Ex Works · 공장 인도 조건)', group: '모든 운송 수단' },
  { value: 'FCA', label: 'FCA — Free Carrier (운송인 인도)', full: 'FCA (Free Carrier · 운송인 인도 조건)', group: '모든 운송 수단' },
  { value: 'CPT', label: 'CPT — Carriage Paid To (운송비 지급)', full: 'CPT (Carriage Paid To · 운송비 지급 인도 조건)', group: '모든 운송 수단' },
  { value: 'CIP', label: 'CIP — Carriage & Insurance Paid To (운송비·보험료 지급)', full: 'CIP (Carriage and Insurance Paid To · 운송비·보험료 지급 인도 조건)', group: '모든 운송 수단' },
  { value: 'DAP', label: 'DAP — Delivered At Place (목적지 인도)', full: 'DAP (Delivered At Place · 목적지 인도 조건)', group: '모든 운송 수단' },
  { value: 'DPU', label: 'DPU — Delivered at Place Unloaded (도착지 양하 인도)', full: 'DPU (Delivered at Place Unloaded · 도착지 양하 인도 조건)', group: '모든 운송 수단' },
  { value: 'DDP', label: 'DDP — Delivered Duty Paid (관세 지급 인도)', full: 'DDP (Delivered Duty Paid · 관세 지급 인도 조건)', group: '모든 운송 수단' },
  // 해상·내륙 수로 운송 전용 (4가지)
  { value: 'FAS', label: 'FAS — Free Alongside Ship (선측 인도)', full: 'FAS (Free Alongside Ship · 선측 인도 조건)', group: '해상 운송 전용' },
  { value: 'FOB', label: 'FOB — Free On Board (본선 인도)', full: 'FOB (Free On Board · 본선 인도 조건)', group: '해상 운송 전용' },
  { value: 'CFR', label: 'CFR — Cost and Freight (운임 포함)', full: 'CFR (Cost and Freight · 운임 포함 인도 조건)', group: '해상 운송 전용' },
  { value: 'CIF', label: 'CIF — Cost, Insurance & Freight (운임·보험료 포함)', full: 'CIF (Cost, Insurance and Freight · 운임·보험료 포함 인도 조건)', group: '해상 운송 전용' },
];

// 레거시 값 (기존 데이터 호환)
export const LEGACY_INCOTERMS = [
  { value: 'FOB_SHANGHAI', label: 'FOB Shanghai (상하이 본선 인도)', full: 'FOB Shanghai (Free On Board · 상하이항 본선 인도)', group: '항구 지정' },
  { value: 'FOB_GUANGZHOU', label: 'FOB Guangzhou (광저우 본선 인도)', full: 'FOB Guangzhou (Free On Board · 광저우항 본선 인도)', group: '항구 지정' },
];

export const ALL_INCOTERMS = [...INCOTERMS_2020, ...LEGACY_INCOTERMS];

export const INCOTERMS_LABEL = Object.fromEntries(ALL_INCOTERMS.map(t => [t.value, t.full]));
export const INCOTERMS_SHORT_LABEL = Object.fromEntries(ALL_INCOTERMS.map(t => [t.value, t.label]));