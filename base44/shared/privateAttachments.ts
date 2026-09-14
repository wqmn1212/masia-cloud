const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const clean = (value, max = 255) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function uploadPrivateAttachments(svc, input) {
  const files = Array.isArray(input) ? input.slice(0, MAX_FILES) : [];
  const attachments = [];

  for (const item of files) {
    const name = clean(item?.name);
    if (!name || typeof item?.data !== 'string') continue;
    const bytes = Uint8Array.from(atob(item.data), (char) => char.charCodeAt(0));
    if (!bytes.length) continue;
    if (bytes.length > MAX_FILE_BYTES) throw new Error(`${name}: 파일은 10MB 이하여야 합니다`);

    const file = new File([bytes], name, {
      type: clean(item.type, 100) || 'application/octet-stream',
    });
    const uploaded = await svc.integrations.Core.UploadPrivateFile({ file });
    if (!uploaded?.file_uri) throw new Error(`${name}: 파일 업로드에 실패했습니다`);
    attachments.push({ name, size: bytes.length, url: uploaded.file_uri });
  }

  return attachments;
}

export async function linkCardAttachments(svc, { tenantId, cardId, attachments, uploaderName }) {
  const records = attachments.map((item) => ({
    tenant_id: tenantId,
    card_id: cardId,
    file_name: item.name,
    file_type: (item.name.split('.').pop() || '').toLowerCase(),
    file_url: item.url,
    uploader_name: uploaderName,
    uploader_role: 'HQ',
  }));
  if (records.length) await svc.entities.CardAttachment.bulkCreate(records);
}