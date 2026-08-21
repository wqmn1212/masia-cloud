import { base44 } from '@/api/base44Client';

const SCHEMA = {
  type: 'object',
  properties: {
    matched_card_id: { type: 'string', description: '가장 적합한 기존 카드 ID. 없으면 빈 문자열' },
    new_card_title: { type: 'string', description: '새로 만들 카드 제목 (기존 카드가 없을 때만)' },
    client_name: { type: 'string', description: '파일에서 파악한 고객사명 (모르면 빈 문자열)' },
    summary: { type: 'string', description: '파일 내용 한국어 요약 1~2문장' },
    reason: { type: 'string', description: '분류 근거 한국어 1문장' },
  },
};

/** 파일 1개를 업로드하고 AI로 적합한 태스크 카드를 판별한다 (등록은 하지 않음) */
export async function classifyFile(file, cards, clients) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  const cardLines = cards
    .map(c => `- id: ${c.id} | 제목: ${c.title} | 고객사: ${c.client_name || '미지정'} | 공장: ${c.factory_name || '미지정'} | 상태: ${c.status}`)
    .join('\n') || '(기존 카드 없음)';

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `당신은 중국 소싱 무역 회사의 문서 관리자입니다. 첨부된 파일의 내용과 파일명을 보고 어떤 프로젝트(태스크 카드)에 속하는 문서인지 판별하세요.

파일명: ${file.name}

[기존 태스크 카드 목록]
${cardLines}

[등록된 고객사]
${clients.map(c => c.company_name).join(', ') || '없음'}

규칙:
- 파일 내용의 고객사명, 공장명, 제품/모델명을 기존 카드와 비교해 가장 잘 맞는 카드 1개를 고르고 matched_card_id에 그 id를 넣으세요.
- 확실히 맞는 카드가 없으면 matched_card_id는 빈 문자열로 두고, new_card_title에 새 카드 제목을 간결하게 제안하세요 (예: "OO커피 드립백 기계 견적").
- 모든 텍스트는 한국어로 작성하세요.`,
    file_urls: [file_url],
    response_json_schema: SCHEMA,
  });

  const matched = cards.find(c => c.id === result.matched_card_id) || null;
  return {
    file_name: file.name,
    file_url,
    file_type: (file.name.split('.').pop() || '').toLowerCase(),
    matched_card: matched,
    new_card_title: matched ? '' : (result.new_card_title || file.name),
    client_name: result.client_name || '',
    summary: result.summary || '',
    reason: result.reason || '',
  };
}

/** 분류 결과를 실제로 등록한다 — 기존 카드에 첨부하거나 새 카드를 만들어 첨부 */
export async function applyClassification(item, clients, uploaderName) {
  let cardId = item.matched_card?.id;
  if (!cardId) {
    const client = clients.find(c => c.company_name === item.client_name);
    const created = await base44.entities.TaskCard.create({
      title: item.new_card_title,
      status: 'TODO',
      priority: 'MEDIUM',
      ...(client ? { client_id: client.id, client_name: client.company_name } : (item.client_name ? { client_name: item.client_name } : {})),
      ...(item.summary ? { hq_requirements: item.summary } : {}),
    });
    cardId = created.id;
  }
  await base44.entities.CardAttachment.create({
    card_id: cardId,
    file_name: item.file_name,
    file_type: item.file_type,
    file_url: item.file_url,
    uploader_name: uploaderName || '',
    uploader_role: 'HQ',
    ai_parsed_text: item.summary || undefined,
    ai_parse_status: item.summary ? 'DONE' : 'NONE',
  });
  return cardId;
}