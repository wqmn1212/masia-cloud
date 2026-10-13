// 어셈블리 STEP 에서 사출 검토 대상이 아닌 부품(구매품·전자부품)을 이름과 형상으로 골라낸다.
// 목록 정렬과 기본 선택에만 쓰며, 사용자는 어떤 부품이든 검토할 수 있다.

const RULES = [
  { test: /(PCB|FPC)/i, reason: '기판' },
  { test: /(SCREW|BOLT|NUT|WASHER|\bPTS\b|\bFTS\b|\bBHS\b|\(PH\)|\(FH\)|볼트|나사|와셔)/i, reason: '체결 부품' },
  { test: /(배터리|BATTERY|\bCELL\b)/i, reason: '배터리' },
  { test: /(스피커|SPEAKER|BUZZER|MOTOR|모터|진동자)/i, reason: '전장 부품' },
  { test: /(CONN|USB[-_]C(?![A-Z])|\(SMT\)|TACTILE|SWITCH|칩-LED|CHIP[-_ ]?LED|\bLED\()/i, reason: '전자 부품' },
  { test: /(RUBBER|러버|고무|실리콘|SILICONE|GASKET|PACKING|패킹|방수패드)/i, reason: '고무 부품', review: true },
];

/**
 * @param {{ part_name: string, triangle_count?: number, bbox_x_mm?: number, bbox_y_mm?: number, bbox_z_mm?: number }} part
 * @returns {{ molded: boolean, reason: string, note?: string }}
 *   molded=false 면 기본 목록 뒤로 보낸다. 고무 부품은 검토는 하되 note 로 기준 차이를 알린다.
 */
export function classifyPartForMolding(part) {
  const name = String(part?.part_name || '');
  for (const rule of RULES) {
    if (!rule.test.test(name)) continue;
    if (rule.review) return { molded: true, reason: '', note: '고무 부품은 사출 기준(구배·수축·게이트)이 달라 참고로만 보세요' };
    return { molded: false, reason: rule.reason };
  }
  const maxEdge = Math.max(part?.bbox_x_mm || 0, part?.bbox_y_mm || 0, part?.bbox_z_mm || 0);
  if ((part?.triangle_count || 0) <= 24 || maxEdge < 2) return { molded: false, reason: '단순 형상 (구매품 추정)' };
  return { molded: true, reason: '' };
}
