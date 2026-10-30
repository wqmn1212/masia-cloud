// 공장 업로드 링크 (4단계 ②) 화면용 사본. 서버 base44/shared/factoryRequest.ts 와 같은 목록·상태 규칙 (토큰·PIN 만들기는 서버만).
// 검산: npm run check:factory-request
export const ITEM_KINDS = ['PHOTO', 'DOC', 'ANSWER', 'MILESTONE'];
export const KIND_LABEL = {
  PHOTO: { ko: '진행 사진', cn: '照片' },
  DOC: { ko: '서류', cn: '文件' },
  ANSWER: { ko: '질문 답변', cn: '回答问题' },
  MILESTONE: { ko: '완료 보고', cn: '完成报告' },
};
export const DOC_TYPES = ['GENERAL', 'INVOICE_CI', 'INVOICE_PI', 'PACKING_LIST', 'CERT_ORIGIN', 'QUOTATION', 'TEST_REPORT', 'CERTIFICATE', 'SPEC_SHEET'];
export const DEFAULT_DAYS = 14;
export const MAX_ITEMS = 20;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const STATUS_LABEL = {
  WAITING: { ko: '미제출', cn: '未提交' },
  SUBMITTED: { ko: '확인 대기', cn: '已提交' },
  ACCEPTED: { ko: '채택', cn: '已确认' },
  REDO: { ko: '재요청', cn: '需重新提交' },
};
export const REQUEST_LABEL = { OPEN: '진행 중', DONE: '완료', EXPIRED: '기한 지남', REVOKED: '회수함' };

// 자주 쓰는 항목 (서류는 문서 종류가 정해져 있어 채택하면 카드 파일에 그 종류로 들어간다)
export const PRESETS = [
  { kind: 'PHOTO', label_ko: '생산 진행 사진', label_cn: '生产进度照片' },
  { kind: 'PHOTO', label_ko: '포장 상태 사진', label_cn: '包装照片' },
  { kind: 'DOC', label_ko: '상업 송장 (CI)', label_cn: '商业发票 (CI)', doc_type: 'INVOICE_CI' },
  { kind: 'DOC', label_ko: '패킹 리스트', label_cn: '装箱单', doc_type: 'PACKING_LIST' },
  { kind: 'DOC', label_ko: '원산지 증명서', label_cn: '原产地证明', doc_type: 'CERT_ORIGIN' },
  { kind: 'DOC', label_ko: '견적서 파일', label_cn: '报价单', doc_type: 'QUOTATION' },
  { kind: 'DOC', label_ko: '시험 성적서', label_cn: '检测报告', doc_type: 'TEST_REPORT' },
];

export function effectiveStatus(req, now = new Date().toISOString()) {
  if (!req) return 'MISSING';
  if (req.status === 'REVOKED') return 'REVOKED';
  const items = req.items || [];
  if (items.length && items.every((i) => i.status === 'ACCEPTED')) return 'DONE';
  if (req.expires_at && now > req.expires_at) return 'EXPIRED';
  return 'OPEN';
}
export function counts(req) {
  const c = { WAITING: 0, SUBMITTED: 0, ACCEPTED: 0, REDO: 0 };
  for (const i of req?.items || []) c[i.status] = (c[i.status] || 0) + 1;
  return { waiting: c.WAITING, submitted: c.SUBMITTED, accepted: c.ACCEPTED, redo: c.REDO, open: c.WAITING + c.REDO, total: (req?.items || []).length };
}

export function inviteText({ link, pin, product, expires_at, items }) {
  const lines = [
    '您好！请通过下面的链接上传资料，不需要注册账号。',
    `产品：${product || ''}`,
    `链接：${link}`,
    `验证码（PIN）：${pin}`,
    `截止日期：${String(expires_at || '').slice(0, 10)}`,
  ];
  if (items?.length) lines.push('需要提交：', ...items.map((i, n) => `${n + 1}. ${i.label_cn || i.label_ko}`));
  lines.push('可以分多次上传，用同一个链接继续即可。谢谢！');
  return lines.join('\n');
}

// 공장 화면 주소. 위챗에서 열기 쉽게 짧게 둔다
export const factoryLink = (origin, token) => `${String(origin || '').replace(/\/$/, '')}/f/${token}`;

// 휴대폰 사진은 크면 공장 와이파이에서 올리기 어렵다: 긴 변 1600px, JPEG 0.82로 줄인다 (이미지가 아니면 그대로)
export async function shrinkImage(file, maxSide = 1600, quality = 0.82) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (_e) { return file; }
}
export async function fileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
