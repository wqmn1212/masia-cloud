export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// 기존 목록에 새 파일을 합치며 개수·용량 제한을 적용한다. 거절된 파일명은 rejected 로 반환.
export const mergeFiles = (current, incoming) => {
  const next = [...current];
  const rejected = [];
  for (const f of Array.from(incoming || [])) {
    if (next.length >= MAX_FILES || f.size > MAX_FILE_BYTES) { rejected.push(f.name); continue; }
    next.push(f);
  }
  return { files: next, rejected };
};

export const toAttachmentPayload = (files) =>
  Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, size: f.size, data: await fileToBase64(f) })));