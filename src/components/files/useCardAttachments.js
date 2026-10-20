import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// 카드 파일 목록 (파일 탭과 같은 캐시 키라 한 번만 불러온다)
export default function useCardAttachments(cardId) {
  return useQuery({
    queryKey: ['card_attachments', cardId],
    queryFn: () => base44.entities.CardAttachment.filter({ card_id: cardId }, '-created_date'),
    enabled: !!cardId,
  });
}
