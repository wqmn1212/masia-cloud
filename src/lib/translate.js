import { base44 } from '@/api/base44Client';

/**
 * 한국어(또는 자유 입력 텍스트)를 간체 중국어로 번역하여 동일한 키 구조로 반환합니다.
 * 빈 값은 자동으로 제외되며, 실패 시 빈 객체를 반환합니다 (저장 자체는 막지 않음).
 *
 * @param {Record<string, string | undefined | null>} fields
 * @returns {Promise<Record<string, string>>}
 */
export async function translateFieldsToCN(fields) {
  const entries = Object.entries(fields || {}).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim().length > 0
  );
  if (entries.length === 0) return {};

  const input = Object.fromEntries(entries);
  const properties = {};
  entries.forEach(([k]) => { properties[k] = { type: 'string' }; });

  const prompt = `Translate the following Korean text fields into natural, professional Simplified Chinese (简体中文). Preserve industry/technical terminology accurately (packaging machinery, sourcing, manufacturing context). Keep the same JSON keys, return only translated string values.

Input JSON:
${JSON.stringify(input, null, 2)}`;

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: { type: 'object', properties },
    });
    return result && typeof result === 'object' ? result : {};
  } catch {
    return {};
  }
}