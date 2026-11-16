// 실시간 디자인 리뷰에서 열 수 있는 파일 (서버 base44/shared/designRoom.ts fileKind 와 같은 규칙)
const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export function fileKindOf(name, type) {
  const ext = String(type || String(name || '').split('.').pop() || '').toLowerCase().replace(/^\./, '');
  if (IMAGE.includes(ext) || /^image\//.test(ext)) return 'image';
  if (ext === 'pdf' || ext === 'application/pdf') return 'pdf';
  return null;
}

export const openDesignRoom = (id) => window.open(`/design/${id}`, '_blank', 'noopener');
