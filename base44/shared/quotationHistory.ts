export const editableFields = 'factory_name incoterms settlement_route quote_issuer quote_title product_name model_name quote_options line_items final_currency factory_total_cost factory_cost_currency logistics_cost logistics_cost_currency masir_fee_type masir_fee_value exchange_rate_date exchange_rate_usd exchange_rate_usd_cny exchange_rate_krw remarks advance_payment_percent balance_payment_percent shipping_days product_image_url status raw_file_url cargo_length_cm cargo_width_cm cargo_height_cm cargo_weight_kg cargo_quantity cargo_cbm shipping_mode shipping_term logistics_estimated_usd logistics_estimate_lines options_total_usd final_price_usd masir_fee_amount_cny final_client_price'.split(' ');
export const restrictedFields = new Set('quote_options options_total_usd final_price_usd factory_total_cost logistics_cost masir_fee_type masir_fee_value masir_fee_amount_cny final_client_price exchange_rate_usd exchange_rate_usd_cny exchange_rate_krw exchange_rate_date factory_cost_currency logistics_cost_currency quote_issuer'.split(' '));
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  if (typeof value === 'number') return Number(value.toFixed(8));
  return value ?? '';
}
export function changedFields(before, patch) {
  return Object.keys(patch).filter(k => JSON.stringify(canonical(before[k])) !== JSON.stringify(canonical(patch[k])));
}
export function historyVersion(current, latest) {
  return latest ? latest.revision_no + (latest.source_updated_date === current.updated_date ? 0 : 1) : 1;
}