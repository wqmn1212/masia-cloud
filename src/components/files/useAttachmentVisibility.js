import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function useAttachmentVisibility(cardId) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ['card_attachments', cardId];
  return useMutation({
    mutationFn: ({ id, visible }) => base44.entities.CardAttachment.update(id, { client_visible: visible }),
    onMutate: async ({ id, visible }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, old => (old || []).map(f => f.id === id ? { ...f, client_visible: visible } : f));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast({ title: '공개 설정 저장 실패', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-shared-files', cardId] });
    },
  });
}