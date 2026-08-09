function decodeB64Url(data) {
  const norm = data.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(norm), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function extractBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeB64Url(payload.body.data);
  const parts = payload.parts || [];
  for (const part of parts) {
    const text = extractBody(part);
    if (text) return text;
  }
  if (payload.body?.data) {
    const html = decodeB64Url(payload.body.data);
    return html.replace(/<[^>]+>/g, ' ');
  }
  return '';
}

export function header(message, name) {
  const headers = message.payload?.headers || [];
  const found = headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase());
  return found ? found.value : '';
}

export async function loadMatchingContext(base44) {
  const clients = await base44.asServiceRole.entities.Company.filter({ company_type: 'CLIENT' }, '-created_date', 500);
  const cards = await base44.asServiceRole.entities.TaskCard.list('-created_date', 300);
  return { clients, cards };
}

export function findClient(clients, participants) {
  const text = participants.toLowerCase();
  return clients.find((c) => {
    const email = (c.email || '').trim().toLowerCase();
    if (!email) return false;
    const domain = email.split('@')[1];
    return text.includes(email) || (domain && text.includes(`@${domain}`));
  });
}

export async function processMessageIds(base44, messageIds) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const { clients, cards } = await loadMatchingContext(base44);

  const results = [];
  for (const messageId of messageIds) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: authHeader }
    );
    if (!res.ok) {
      results.push({ messageId, skipped: 'fetch failed' });
      continue;
    }
    const message = await res.json();

    const from = header(message, 'From');
    const to = header(message, 'To');
    const subject = header(message, 'Subject');
    const date = header(message, 'Date');

    const client = findClient(clients, `${from} ${to}`);
    if (!client) {
      results.push({ messageId, skipped: 'no matching client' });
      continue;
    }

    const card = cards.find((c) => c.client_id === client.id) || cards.find((c) => c.client_name === client.company_name);
    if (!card) {
      results.push({ messageId, skipped: 'no matching card' });
      continue;
    }

    const existing = await base44.asServiceRole.entities.AIProposal.filter({ gmail_message_id: messageId });
    if (existing.length > 0) {
      results.push({ messageId, skipped: 'already processed' });
      continue;
    }

    const emailText = extractBody(message.payload).slice(0, 12000);

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `아래는 무역 소싱 에이전시가 고객사와 주고받은 이메일입니다. 한국어로 정리해 주세요.

프로젝트: ${card.title}
고객사: ${client.company_name}
제목: ${subject}
발신: ${from}

본문:
${emailText}

요구사항:
1) summary: 이 메일의 핵심을 2~3문장으로 요약
2) client_requirements: 고객이 요청한 요구사항을 불릿(- )으로 정리
3) our_commitments: 우리(에이전시)가 약속하거나 회신한 내용을 불릿(- )으로 정리 (없으면 빈 문자열)
4) suggested_tasks: 이 메일로 인해 실제로 해야 할 세부 작업 목록 (최대 5개, 각 title/description/priority/due_date). 기한이 명시되지 않으면 due_date는 빈 문자열.`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          client_requirements: { type: 'string' },
          our_commitments: { type: 'string' },
          suggested_tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                due_date: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const proposal = await base44.asServiceRole.entities.AIProposal.create({
      card_id: card.id,
      client_name: client.company_name,
      gmail_message_id: messageId,
      email_from: from,
      email_subject: subject,
      email_date: date,
      summary: analysis.summary || '',
      client_requirements: analysis.client_requirements || '',
      our_commitments: analysis.our_commitments || '',
      suggested_tasks: (analysis.suggested_tasks || []).map((t) => ({
        title: t.title || '',
        description: t.description || '',
        priority: t.priority || 'MEDIUM',
        due_date: t.due_date || '',
      })),
      status: 'PENDING',
    });

    results.push({ messageId, proposalId: proposal.id, cardId: card.id });
  }
  return results;
}