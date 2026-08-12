import { base44 } from '@/api/base44Client';

/** AI 이메일 추천을 특정 태스크 카드에 반영 */
export async function applyProposalToCard({ proposal, cardId, user }) {
  const tasks = proposal.suggested_tasks || [];
  if (tasks.length > 0) {
    await base44.entities.TaskItem.bulkCreate(
      tasks.map((t) => ({
        card_id: cardId,
        title: t.title,
        description: t.description || '',
        status: 'TODO',
        priority: t.priority || 'MEDIUM',
        ...(t.due_date ? { due_date: t.due_date } : {}),
      }))
    );
  }

  const block = [
    `\n\n### 📧 ${proposal.email_subject || '이메일'} (${proposal.email_date || ''})`,
    proposal.client_requirements ? `**고객 요구사항**\n${proposal.client_requirements}` : '',
    proposal.our_commitments ? `**회신/약속 내용**\n${proposal.our_commitments}` : '',
  ].filter(Boolean).join('\n');

  const [card] = await base44.entities.TaskCard.filter({ id: cardId });
  await base44.entities.TaskCard.update(cardId, {
    hq_requirements: `${card?.hq_requirements || ''}${block}`,
  });

  return base44.entities.AIProposal.update(proposal.id, {
    card_id: cardId,
    status: 'APPROVED',
    reviewed_by_name: user?.full_name || user?.email || '',
  });
}

export async function rejectProposal({ proposal, user }) {
  return base44.entities.AIProposal.update(proposal.id, {
    status: 'REJECTED',
    reviewed_by_name: user?.full_name || user?.email || '',
  });
}