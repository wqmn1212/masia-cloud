const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// 화면 입력이 잘못된 경우(크기 초과·깨진 내용): 호출한 쪽이 400 으로 돌려줄 수 있게 status 를 붙인다
const badInput = (message) => Object.assign(new Error(message), { status: 400 });

const clean = (value, max = 255) => typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * 화면이 보낸 파일 하나({name, type, data: base64})를 서버가 비공개 저장소에 올린다.
 * 화면이 보낸 저장소 주소는 받지 않는다 — 돌려주는 url 은 이 서버가 올린 파일의 주소뿐이다.
 * 이름이나 내용이 없으면 null, 크기를 넘거나 내용이 깨졌으면 오류.
 */
export async function uploadPrivateFile(svc, item, maxBytes = MAX_FILE_BYTES) {
  const name = clean(item?.name);
  if (!name || typeof item?.data !== 'string' || !item.data) return null;
  const limitMb = Math.round(maxBytes / 1024 / 1024);
  // 풀기 전에 길이로 먼저 거른다 (base64 는 원본의 4/3)
  if (item.data.length > Math.ceil(maxBytes / 3) * 4 + 4) throw badInput(`${name}: 파일은 ${limitMb}MB 이하여야 합니다`);
  let bytes;
  try { bytes = Uint8Array.from(atob(item.data), (char) => char.charCodeAt(0)); }
  catch { throw badInput(`${name}: 파일 내용을 읽지 못했습니다`); }
  if (!bytes.length) return null;
  if (bytes.length > maxBytes) throw badInput(`${name}: 파일은 ${limitMb}MB 이하여야 합니다`);

  const file = new File([bytes], name, {
    type: clean(item.type, 100) || 'application/octet-stream',
  });
  const uploaded = await svc.integrations.Core.UploadPrivateFile({ file });
  if (!uploaded?.file_uri) throw new Error(`${name}: 파일 업로드에 실패했습니다`);
  return { name, size: bytes.length, url: uploaded.file_uri };
}

export async function uploadPrivateAttachments(svc, input) {
  const files = Array.isArray(input) ? input.slice(0, MAX_FILES) : [];
  const attachments = [];

  for (const item of files) {
    const uploaded = await uploadPrivateFile(svc, item);
    if (uploaded) attachments.push(uploaded);
  }

  return attachments;
}

export async function linkCardAttachments(svc, { tenantId, cardId, attachments, uploaderName, clientVisible = false, uploaderRole = 'HQ', documentType = 'GENERAL' }) {
  const records = attachments.map((item) => ({
    client_visible: clientVisible,
    document_type: documentType,
    tenant_id: tenantId,
    card_id: cardId,
    file_name: item.name,
    file_type: (item.name.split('.').pop() || '').toLowerCase(),
    file_url: item.url,
    uploader_name: uploaderName,
    ...(uploaderRole ? { uploader_role: uploaderRole } : {}),
  }));
  if (records.length) await svc.entities.CardAttachment.bulkCreate(records);
}