// 사용자가 준 파일 URL 을 서버에서 받기 전 검사 (parseQuotationExcel 과 같은 규칙).
// 사설/내부망 대역 차단 (SSRF 방지) — 리터럴 IP 호스트와 DNS 조회 결과 IP 모두 검사
const PRIVATE_IPV4_RANGES = [
  [/^127\./],
  [/^0\./],
  [/^10\./],
  [/^169\.254\./],
  [/^192\.168\./],
  [/^172\.(1[6-9]|2\d|3[0-1])\./],
];
const isPrivateIPv4 = (ip) => PRIVATE_IPV4_RANGES.some(([re]) => re.test(ip));
const isPrivateIPv6 = (ip) => {
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
};

export async function assertPublicHttpUrl(fileUrl) {
  let url;
  try {
    url = new URL(fileUrl);
  } catch {
    throw new Error('올바르지 않은 파일 URL입니다');
  }
  if (url.protocol !== 'https:') throw new Error('https 파일 URL만 허용됩니다');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) throw new Error('허용되지 않은 파일 URL입니다');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) throw new Error('허용되지 않은 파일 URL입니다');
    return;
  }
  if (hostname.includes(':')) {
    if (isPrivateIPv6(hostname)) throw new Error('허용되지 않은 파일 URL입니다');
    return;
  }
  try {
    const records = await Deno.resolveDns(hostname, 'A');
    if (records.some(isPrivateIPv4)) throw new Error('허용되지 않은 파일 URL입니다');
  } catch (e) {
    if (e instanceof Error && e.message === '허용되지 않은 파일 URL입니다') throw e;
    // DNS 조회 자체가 실패하면 이후 fetch 단계에서 자연스럽게 오류 처리됨
  }
}
