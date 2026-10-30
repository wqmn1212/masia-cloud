// 사전 QC 점검: 견적 품목에서 구성품을 찾고(1) 구성품별 필수 사양의 빈칸과(2) 사양이 부르는 연쇄 위험을 짚는다.
// AI 없이 같은 입력이면 항상 같은 결과가 나온다. AI 보강(runQCPrecheckAI)은 이 결과 위에 항목만 더한다.
// 검산 스크립트(node scripts/check-qc-precheck.mjs)에서도 읽으므로 import 없이 순수 JS로 둔다.

export const STAGES = {
  SPEC: { ko: '사양 확정', zh: '规格确认' },
  MATERIAL: { ko: '자재 입고', zh: '来料' },
  SAMPLE: { ko: '샘플', zh: '样品' },
  PRODUCTION: { ko: '양산 중', zh: '量产中' },
  PRESHIP: { ko: '출고 전', zh: '出货前' },
  PACKING: { ko: '포장·운송', zh: '包装运输' },
};
export const STAGE_ORDER = Object.keys(STAGES);

// 품질 기준서(QualitySpec) 결함 등급과 같은 값
export const SEVERITY = {
  CRITICAL: { ko: '치명', zh: '致命' },
  MAJOR: { ko: '중', zh: '严重' },
  MINOR: { ko: '경', zh: '轻微' },
};
const SEV_RANK = { CRITICAL: 0, MAJOR: 1, MINOR: 2 };

export const UNKNOWN = 'UNKNOWN'; // '모름·공장 확인' — 빈칸이 아니라 공장 질문으로 넘어간다

const opt = (v, ko, zh) => ({ v, ko, zh });
const PAPER_SURFACE = [opt('COATED', '코팅지 (아트·스노우)', '涂布纸（铜版·哑粉）'), opt('UNCOATED', '비코팅지 (모조·크라프트)', '非涂布纸（道林·牛皮）')];
const PRINT = [opt('NONE', '무인쇄', '不印刷'), opt('MONO', '1~2도', '1~2色'), opt('CMYK', '4도 (컬러)', '四色'), opt('CMYK_SPOT', '4도 + 별색', '四色+专色')];
const COLOR_REF = [opt('PANTONE', 'Pantone 지정', '指定潘通色'), opt('PROOF', '교정쇄 승인', '确认打样'), opt('NONE', '기준 없음', '无标准')];
const CONFIRMED = [opt('DONE', '확정', '已确定'), opt('TBD', '미정', '未定')];

// 구성품 유형별 필수 사양. optional 칸은 비어 있어도 '빈 사양'으로 세지 않는다.
export const COMPONENT_TYPES = {
  PAPER_BOX: {
    ko: '종이 박스', zh: '纸盒',
    fields: [
      { key: 'structure', ko: '구조', zh: '结构', options: [opt('TUCK', '단상자', '折叠盒'), opt('RIGID', '사바리(합지 박스)', '精装盒（裱糊）'), opt('MAGNET', '자석 박스', '磁铁盒'), opt('LID_BASE', '천지 박스(2피스)', '天地盖'), opt('OTHER', '기타', '其他')] },
      { key: 'paper', ko: '용지 종류', zh: '纸张种类', text: true },
      { key: 'paper_surface', ko: '용지 표면', zh: '纸张表面', options: PAPER_SURFACE },
      { key: 'gsm', ko: '평량', zh: '克重', number: true, unit: 'g' },
      { key: 'print', ko: '인쇄', zh: '印刷', options: PRINT },
      { key: 'color_ref', ko: '색 기준', zh: '颜色标准', options: COLOR_REF },
      { key: 'lamination', ko: '후코팅', zh: '覆膜', options: [opt('GLOSS', '유광', '光膜'), opt('MATTE', '무광', '哑膜'), opt('NONE', '없음', '无')] },
      { key: 'thickness', ko: '최종 두께·합지', zh: '成品厚度（裱后）', number: true, unit: 'mm' },
      { key: 'crease', ko: '괘선·V커팅', zh: '压线·V槽', options: [opt('NORMAL', '일반 괘선', '普通压线'), opt('VCUT', 'V커팅', 'V槽'), opt('NA', '해당 없음', '不适用')] },
      { key: 'finishing', ko: '후가공', zh: '后工艺', text: true, optional: true },
    ],
  },
  PRINTED: {
    ko: '설명서·인쇄물', zh: '说明书·印刷品',
    fields: [
      { key: 'size', ko: '크기', zh: '尺寸', text: true },
      { key: 'pages', ko: '페이지', zh: '页数', number: true, unit: 'P' },
      { key: 'paper', ko: '용지 종류', zh: '纸张种类', text: true },
      { key: 'paper_surface', ko: '용지 표면', zh: '纸张表面', options: PAPER_SURFACE },
      { key: 'gsm', ko: '평량', zh: '克重', number: true, unit: 'g' },
      { key: 'print', ko: '인쇄', zh: '印刷', options: PRINT },
      { key: 'binding', ko: '제본·접지', zh: '装订·折页', options: [opt('SADDLE', '중철', '骑马钉'), opt('PERFECT', '무선', '胶装'), opt('FOLD', '접지', '折页'), opt('SHEET', '낱장', '单张')] },
      { key: 'legal_text', ko: '법정 표시 문구', zh: '法定标识文字', options: CONFIRMED },
    ],
  },
  PLASTIC_PACK: {
    ko: '플라스틱 포장', zh: '塑料包装',
    fields: [
      { key: 'material', ko: '재질', zh: '材质', options: [opt('PET', 'PET', 'PET'), opt('PVC', 'PVC', 'PVC'), opt('PS', 'PS', 'PS'), opt('PP', 'PP', 'PP'), opt('OTHER', '기타', '其他')] },
      { key: 'thickness', ko: '두께', zh: '厚度', number: true, unit: 'mm' },
      { key: 'clarity', ko: '투명도', zh: '透明度', options: [opt('CLEAR', '투명', '透明'), opt('FROST', '반투명', '半透明'), opt('OPAQUE', '불투명', '不透明')] },
      { key: 'fixing', ko: '제품 고정 방식', zh: '产品固定方式', text: true },
      { key: 'mold_cost', ko: '성형 금형 비용', zh: '吸塑模具费', options: [opt('INCLUDED', '견적 포함', '已含'), opt('SEPARATE', '별도', '另计')] },
    ],
  },
  CARTON: {
    ko: '외장 카톤', zh: '外箱',
    fields: [
      { key: 'flute', ko: '골 종류', zh: '楞型', options: [opt('B', 'B골', 'B楞'), opt('E', 'E골', 'E楞'), opt('AB', 'AB골(이중)', 'AB楞（双瓦）'), opt('OTHER', '기타', '其他')] },
      { key: 'strength', ko: '강도', zh: '强度', text: true },
      { key: 'qty_per_carton', ko: '입수', zh: '装箱数', number: true, unit: '개' },
      { key: 'carton_weight', ko: '박스 중량', zh: '整箱重量', number: true, unit: 'kg' },
      { key: 'drop_test', ko: '낙하 시험', zh: '跌落测试', options: [opt('YES', '시행', '进行'), opt('NO', '안 함', '不进行')] },
      { key: 'shipping_mark', ko: '쉬핑 마크', zh: '唛头', options: CONFIRMED },
    ],
  },
  INJECTION: {
    ko: '사출 외관 부품', zh: '注塑外观件',
    fields: [
      { key: 'material', ko: '재질·그레이드', zh: '材料·牌号', text: true },
      { key: 'color', ko: '색상 기준', zh: '颜色标准', options: [opt('PANTONE', 'Pantone 지정', '指定潘通色'), opt('SAMPLE', '색 견본', '色板'), opt('NONE', '기준 없음', '无标准')] },
      { key: 'texture', ko: '표면 질감·광택', zh: '表面纹理·光泽', text: true },
      { key: 'surface', ko: '표면처리', zh: '表面处理', options: [opt('PAINT', '도장', '喷涂'), opt('PLATING', '도금', '电镀'), opt('PRINT', '인쇄', '印刷'), opt('NONE', '없음', '无')] },
      { key: 'cosmetic_limit', ko: '외관 허용 기준', zh: '外观接受标准', options: [opt('LIMIT_SAMPLE', '한도 견본 있음', '有限度样'), opt('NONE', '기준 없음', '无标准')] },
      { key: 'tolerance', ko: '치수 공차', zh: '尺寸公差', text: true },
    ],
  },
  ELECTRONICS: {
    ko: '전자·전장', zh: '电子·电气',
    fields: [
      { key: 'rating', ko: '정격', zh: '额定参数', text: true },
      { key: 'connector', ko: '커넥터 규격', zh: '连接器规格', text: true, optional: true },
      { key: 'cable', ko: '케이블 길이·굵기', zh: '线长·线径', text: true, optional: true },
      { key: 'cert', ko: '한국 인증', zh: '韩国认证', options: [opt('KC', 'KC', 'KC'), opt('RADIO', '전파', '电波'), opt('BOTH', 'KC + 전파', 'KC+电波'), opt('NONE', '불필요', '不需要')] },
      { key: 'battery', ko: '배터리', zh: '电池', options: [opt('YES', '포함', '含电池'), opt('NO', '없음', '无')] },
      { key: 'burn_in', ko: '번인 시험', zh: '老化测试', options: [opt('YES', '시행', '进行'), opt('NO', '안 함', '不进行')] },
    ],
  },
  TEXTILE: {
    ko: '봉제·섬유', zh: '缝制·纺织',
    fields: [
      { key: 'fabric', ko: '원단 혼용률·중량', zh: '面料成分·克重', text: true },
      { key: 'colorfastness', ko: '색 견뢰도 기준', zh: '色牢度标准', options: [opt('YES', '있음', '有'), opt('NO', '없음', '无')] },
      { key: 'stitch', ko: '봉제 땀수', zh: '针距', text: true },
      { key: 'shrinkage', ko: '수축률', zh: '缩水率', text: true },
      { key: 'label', ko: '표시 라벨', zh: '标签', options: CONFIRMED },
    ],
  },
  EQUIPMENT: {
    ko: '설비', zh: '设备',
    fields: [
      { key: 'voltage', ko: '전압·상', zh: '电压·相数', options: [opt('220_1P', '220V 단상', '220V单相'), opt('380_3P', '380V 3상', '380V三相'), opt('OTHER', '기타', '其他')] },
      { key: 'frequency', ko: '주파수', zh: '频率', options: [opt('50HZ', '50Hz (중국 기본)', '50Hz（中国标准）'), opt('60HZ', '60Hz 확정', '确认60Hz'), opt('CUSTOM_60', '60Hz 맞춤 필요 (미확정)', '需定制60Hz（未确认）')] },
      { key: 'safety', ko: '안전 인증·비상정지', zh: '安全认证·急停', options: [opt('CE', 'CE', 'CE'), opt('KC', 'KC', 'KC'), opt('ESTOP', '비상정지만', '仅急停'), opt('NONE', '없음', '无')] },
      { key: 'key_parts', ko: '핵심 부품 브랜드', zh: '核心部件品牌', text: true },
      { key: 'capacity_test', ko: '생산 능력 확인', zh: '产能验证', options: [opt('OUR_SAMPLE', '우리 시료로 시운전', '用我方样品试机'), opt('FACTORY_SAMPLE', '공장 시료로 시운전', '用工厂样品试机'), opt('NONE', '안 함', '不试机')] },
      { key: 'manual_lang', ko: '매뉴얼 언어', zh: '说明书语言', options: [opt('KO', '한국어', '韩语'), opt('EN', '영어', '英语'), opt('ZH', '중국어만', '仅中文')] },
      { key: 'spare_parts', ko: '예비 부품·소모품', zh: '备件·易损件', options: [opt('INCLUDED', '포함', '包含'), opt('NONE', '없음', '不含')] },
      { key: 'packing', ko: '포장', zh: '包装', options: [opt('WOOD', '목재 케이스', '木箱'), opt('NORMAL', '일반 포장', '普通包装')] },
      { key: 'warranty', ko: '보증·A/S', zh: '保修·售后', text: true },
    ],
  },
};
export const COMPONENT_TYPE_KEYS = Object.keys(COMPONENT_TYPES);

export const fieldDef = (type, key) => COMPONENT_TYPES[type]?.fields.find((f) => f.key === key);
export const optionLabel = (type, key, v, lang = 'ko') => {
  const f = fieldDef(type, key);
  if (v === UNKNOWN) return lang === 'zh' ? '待工厂确认' : '모름·공장 확인';
  const o = f?.options?.find((x) => x.v === v);
  if (o) return o[lang] || o.ko;
  return f?.unit && v !== '' && v != null ? `${v}${f.unit}` : String(v ?? '');
};
const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

// ── 1. 구성품 찾기 ─────────────────────────────────────────────
// 순서가 중요하다: 외장 카톤을 종이 박스보다 먼저, 설비를 전자보다 먼저 본다.
const TYPE_KEYWORDS = [
  ['CARTON', /外箱|master\s*carton|shipping\s*carton|export\s*carton|외박스|외장\s*박스|카톤|carton/i],
  ['EQUIPMENT', /포장기|라벨기|라벨러|부착기|충진기|실링기|캡핑기|계수기|선별기|타정기|증류기|교반솥|테닝기|machine|设备|机$|机器/i],
  ['PAPER_BOX', /color\s*box|gift\s*box|paper\s*(frame|box|card|tray)|彩盒|礼盒|纸盒|天地盖|纸卡|纸托|내지|사바리|컬러\s*박스|상자|박스|\bbox\b/i],
  ['PRINTED', /manual|leaflet|instruction|insert\s*card|warranty\s*card|sticker|说明书|卡片|贴纸|설명서|매뉴얼|인쇄물|스티커|보증서/i],
  ['PLASTIC_PACK', /blister|吸塑|tray|트레이|블리스터|PET\s*盒|PVC\s*盒/i],
  ['ELECTRONICS', /cable|usb|pcb|battery|charger|adapter|lcd|speaker|motor|connector|molex|inductor|transformer|sound\s*chip|电池|线材|充电|电源|喇叭|马达|케이블|배터리|충전|어댑터|스피커|모터|커넥터|인덕터|트랜스포머|사운드칩|모니터/i],
  ['INJECTION', /사출|injection|注塑|housing|外壳|shell|외관\s*부품/i],
  ['TEXTILE', /원단|봉제|fabric|sewing|plush|面料|缝制|毛绒|인형/i],
];
const SKIP_LINE = /배송|운임|운송비|물류|shipping|freight|运费|파레트|pallet|托盘|수수료|커미션|조립비?$/i;
// 카드 장비 분류(사용자 분류 이름) → 구성품 유형. 품목명이 모델명뿐일 때만 쓴다.
const CATEGORY_TYPE = [
  [/산업기계|웰니스기계|포장기|라벨러|실링기|설비/, 'EQUIPMENT'],
  [/부품|전자기기|케이블|미용기기/, 'ELECTRONICS'],
  [/포장재|부자재/, 'PAPER_BOX'],
  [/봉제/, 'TEXTILE'],
  [/화장품용기/, 'INJECTION'],
];

export function detectType(text) {
  const hit = TYPE_KEYWORDS.find(([, re]) => re.test(text || ''));
  return hit ? hit[0] : null;
}

// 견적서의 품목 줄 (line_items 우선, 없으면 quote_options)
export function quoteLines(quotation) {
  if (!quotation) return [];
  const li = (quotation.line_items || []).map((l) => ({ name: l.item_name_ko || l.item_name_cn || '', name_cn: l.item_name_cn || '', spec: l.specification || '' }));
  const qo = (quotation.quote_options || []).map((o) => ({ name: o.option_name || '', name_cn: '', spec: o.specification || '' }));
  return (li.length ? li : qo).filter((l) => (l.name || l.spec).trim());
}

// 견적 문구에서 사양 값을 미리 채운다 (못 찾으면 비워 둠 = 빈 사양)
export function parseSpecs(type, text) {
  const t = text || '';
  const s = {};
  const gsm = t.match(/(\d{2,3})\s*(g\b|gsm|克)/i);
  const paper = [[/스노우|snow/i, '스노우지'], [/铜版|아트지|art\s*paper/i, '아트지'], [/白卡|아이보리|ivory/i, '아이보리지'], [/牛皮|크라프트|kraft/i, '크라프트지'], [/道林|모조|offset/i, '모조지'], [/灰板|합지|greyboard/i, '합지(회판)']].find(([re]) => re.test(t));
  const surface = /非涂布|无涂布|uncoated|비코팅|道林|牛皮|모조|크라프트|kraft/i.test(t) ? 'UNCOATED' : /铜版|哑粉|coated|아트지|스노우|snow/i.test(t) ? 'COATED' : '';
  const print = /专色|별색|spot|pantone/i.test(t) && /4\s*色|4\s*도|cmyk|four\s*colou?r/i.test(t) ? 'CMYK_SPOT' : /4\s*色|4\s*도|cmyk|four\s*colou?r|四色/i.test(t) ? 'CMYK' : '';
  const lam = /光膜|유광|gloss/i.test(t) ? 'GLOSS' : /哑膜|무광|matte?\b/i.test(t) ? 'MATTE' : '';
  if (type === 'PAPER_BOX' || type === 'PRINTED') {
    if (gsm) s.gsm = Number(gsm[1]);
    if (paper) s.paper = paper[1];
    if (surface) s.paper_surface = surface;
    if (print) s.print = print;
  }
  if (type === 'PAPER_BOX') {
    if (lam) s.lamination = lam;
    const thick = t.match(/(\d(?:\.\d+)?)\s*[tT](?![a-z])/) || t.match(/(?:두께|厚)\s*(\d(?:\.\d+)?)\s*mm/);
    if (thick) s.thickness = Number(thick[1]);
    if (/v\s*컷|v\s*커팅|v槽|v-?cut/i.test(t)) s.crease = 'VCUT';
    if (/사바리|精装|裱|rigid/i.test(t)) s.structure = 'RIGID';
    else if (/two-?piece|2피스|천지|天地盖/i.test(t)) s.structure = 'LID_BASE';
    else if (/자석|磁铁|magnet/i.test(t)) s.structure = 'MAGNET';
  }
  if (type === 'PRINTED') {
    const pages = t.match(/(\d{1,3})\s*[pP](?![a-zA-Z])/) || t.match(/(\d{1,3})\s*(?:페이지|页)/);
    if (pages) s.pages = Number(pages[1]);
    const size = t.match(/\d{2,4}\s*[*x×]\s*\d{2,4}\s*(mm|MM)?/);
    if (size) s.size = size[0].replace(/\s+/g, '');
    if (/骑马钉|중철|saddle/i.test(t)) s.binding = 'SADDLE';
    else if (/胶装|무선|perfect/i.test(t)) s.binding = 'PERFECT';
    else if (/折页|접지|fold/i.test(t)) s.binding = 'FOLD';
  }
  if (type === 'PLASTIC_PACK') {
    const m = t.match(/\b(PET|PVC|PS|PP)\b/i);
    if (m) s.material = m[1].toUpperCase();
    const th = t.match(/(\d(?:\.\d+)?)\s*mm/);
    if (th && Number(th[1]) < 3) s.thickness = Number(th[1]);
  }
  if (type === 'ELECTRONICS') {
    const len = t.match(/\(?L\)?\s*=\s*(\d+\s*mm)|(\d+\s*(?:mm|cm|m))\s*(?:케이블|cable|线)/i);
    if (len) s.cable = (len[1] || len[2]).replace(/\s+/g, '');
    if (/battery|电池|배터리|리튬/i.test(t)) s.battery = 'YES';
  }
  if (type === 'EQUIPMENT') {
    if (/380\s*V/i.test(t)) s.voltage = '380_3P'; else if (/220\s*V/i.test(t)) s.voltage = '220_1P';
    if (/60\s*Hz/i.test(t)) s.frequency = /맞춤|필요|定制|需要|별도/.test(t) ? 'CUSTOM_60' : '60HZ';
    else if (/50\s*Hz/i.test(t)) s.frequency = '50HZ';
    if (/목재|木箱|wooden/i.test(t)) s.packing = 'WOOD';
    if (/\bCE\b/.test(t)) s.safety = 'CE';
    const warranty = t.match(/(\d)\s*년간?\s*(?:무상\s*)?보증|保修\s*(\d)\s*年|(\d)\s*year\s*warranty/i);
    if (warranty) s.warranty = `${warranty[1] || warranty[2] || warranty[3]}년`;
  }
  return s;
}

// 견적서·카드에서 구성품 목록을 만든다. 같은 품목명이 이전 점검에 있으면 그때 입력한 사양을 이어받는다.
export function detectComponents({ quotation, card, categoryLabel = '', previous = [] } = {}) {
  const lines = quoteLines(quotation);
  const out = [];
  const unmatched = [];
  for (const line of lines) {
    const text = `${line.name} ${line.name_cn} ${line.spec}`;
    if (SKIP_LINE.test(line.name.trim())) continue;
    const type = detectType(text);
    if (!type) { unmatched.push(line.name || line.spec); continue; }
    out.push({ key: `c${out.length + 1}`, type, name: line.name || line.spec, source_line: line.name, specs: parseSpecs(type, type === 'EQUIPMENT' ? `${text} ${quotation?.remarks || ''}` : text) });
  }
  if (!out.length) {
    const byTitle = detectType(card?.title || '') || CATEGORY_TYPE.find(([re]) => re.test(categoryLabel))?.[1];
    if (byTitle) out.push({ key: 'c1', type: byTitle, name: card?.title || COMPONENT_TYPES[byTitle].ko, source_line: '', specs: parseSpecs(byTitle, `${card?.title || ''} ${quotation?.remarks || ''} ${lines.map((l) => `${l.name} ${l.spec}`).join(' ')}`) });
  }
  // 이전 점검에서 담당자가 넣은 값이 견적에서 읽은 값보다 우선
  for (const c of out) {
    const prev = previous.find((p) => p.type === c.type && (p.source_line || p.name) === (c.source_line || c.name));
    if (prev) c.specs = { ...c.specs, ...Object.fromEntries(Object.entries(prev.specs || {}).filter(([, v]) => filled(v))) };
  }
  return { components: out.slice(0, 10), unmatched };
}

// ── 2. 연쇄 규칙 ───────────────────────────────────────────────
// caseTags: 같은 구성품 유형의 QC 사례에 이 태그가 있으면 근거를 '우리 사례'로 표시한다.
const num = (v) => (filled(v) && v !== UNKNOWN ? Number(v) : NaN);
const COLOR_PRINT = (s) => s.print === 'CMYK' || s.print === 'CMYK_SPOT';
export const RULES = [
  {
    id: 'R01', types: ['PAPER_BOX', 'PRINTED'], severity: 'MAJOR', stage: 'SPEC', caseTags: ['비코팅지'],
    when: (s) => s.paper_surface === 'UNCOATED' && COLOR_PRINT(s),
    title: { ko: '비코팅지에 컬러 인쇄 → 잉크를 먹어 인쇄가 연하고 탁하게 나올 수 있음', zh: '非涂布纸彩印 → 吸墨导致印刷偏淡、发灰' },
    how: { ko: '실제 용지로 교정쇄를 뽑아 승인. 코팅지로 바꾸거나 잉크 농도·별색을 지정', zh: '用实际纸张打样确认；改用涂布纸，或指定墨量浓度·专色' },
    criteria: { ko: '승인한 교정쇄와 비교해 농도·색 차이가 없을 것', zh: '与确认打样对比，浓度和颜色无差异' },
  },
  {
    id: 'R02', types: ['PAPER_BOX'], severity: 'MAJOR', stage: 'SPEC', caseTags: ['합지', '괘선'],
    when: (s) => (num(s.gsm) >= 170 || num(s.thickness) >= 2.0) && s.crease !== 'VCUT' && s.crease !== 'NA',
    title: { ko: '평량·두께를 올리면 접는 부분에 주름·터짐이 생길 수 있음', zh: '克重·厚度加大后，折叠处易起皱·爆线' },
    how: { ko: '괘선 폭·깊이 또는 V커팅을 지정하고 종이 결 방향 확인. 바뀐 종이로 접힘 더미를 먼저 승인', zh: '指定压线宽度·深度或开V槽，确认纸张纹路方向；先用新纸做折叠白样确认' },
    criteria: { ko: '접힘부에 주름·터짐·들뜸이 없을 것', zh: '折叠处无起皱、爆线、起翘' },
  },
  {
    id: 'R03', types: ['PAPER_BOX', 'PRINTED'], severity: 'MAJOR', stage: 'SAMPLE',
    when: (s) => s.print !== 'NONE' && filled(s.print) && s.color_ref === 'NONE',
    title: { ko: '색 기준이 없으면 양산품 색이 샘플과 달라도 다투기 어려움', zh: '没有颜色标准，量产颜色与样品不同时难以判定' },
    how: { ko: 'Pantone 번호를 지정하거나 승인 교정쇄를 기준으로 삼기', zh: '指定潘通色号，或以确认的打样为标准' },
    criteria: { ko: '기준 색과 육안 비교 시 차이가 없을 것', zh: '与标准色目视对比无差异' },
  },
  {
    id: 'R04', types: ['PAPER_BOX'], severity: 'MINOR', stage: 'PACKING',
    when: (s) => s.lamination === 'MATTE',
    title: { ko: '무광 후코팅은 긁힘·손자국이 잘 보임', zh: '哑膜容易显划痕和指纹' },
    how: { ko: '내스크래치 무광 필름을 지정하거나 포장 시 간지를 넣기', zh: '指定耐刮哑膜，或包装时加隔纸' },
    criteria: { ko: '30cm 거리 육안으로 긁힘이 보이지 않을 것', zh: '30cm距离目视无明显划痕' },
  },
  {
    id: 'R05', types: ['PRINTED'], severity: 'MINOR', stage: 'SAMPLE',
    when: (s) => num(s.pages) >= 32 && s.binding === 'SADDLE',
    title: { ko: '페이지가 많은데 중철이면 제본이 벌어지거나 배부름', zh: '页数多却骑马钉，容易散开或鼓起' },
    how: { ko: '무선 제본을 검토하고 샘플로 확인', zh: '考虑改为胶装，用样品确认' },
    criteria: { ko: '책이 평평하게 닫히고 철심이 빠지지 않을 것', zh: '合上平整，钉子不脱落' },
  },
  {
    id: 'R06', types: ['INJECTION'], severity: 'MAJOR', stage: 'SAMPLE',
    when: (s) => s.cosmetic_limit === 'NONE',
    title: { ko: '외관 허용 기준이 없으면 웰드라인·흐름 자국으로 다툼이 생김', zh: '没有外观接受标准，熔接线·流痕容易产生争议' },
    how: { ko: '허용·불허 한도 견본 사진을 품질 기준서에 넣기', zh: '把可接受/不可接受的限度样照片加入品质标准书' },
    criteria: { ko: '한도 견본보다 나쁘지 않을 것', zh: '不差于限度样' },
  },
  {
    id: 'R07', types: ['EQUIPMENT'], severity: 'CRITICAL', stage: 'SPEC',
    when: (s) => s.frequency === '50HZ' || s.frequency === 'CUSTOM_60',
    title: { ko: '한국 전원은 60Hz — 50Hz 설비는 모터 속도·타이밍이 달라질 수 있음', zh: '韩国电网为60Hz，50Hz设备的电机转速·时序可能变化' },
    how: { ko: '60Hz 맞춤 제작 여부와 추가 비용을 서면으로 받고, 시운전을 60Hz 조건으로 진행', zh: '书面确认是否定制60Hz及费用，并在60Hz条件下试机' },
    criteria: { ko: '60Hz에서 견적 속도·정밀도를 낼 것', zh: '60Hz下达到报价速度和精度' },
    question: { ko: '60Hz 맞춤 제작이 가능한가요? 추가 비용과 제작 기간을 알려 주세요.', zh: '可以定制60Hz吗？请告知追加费用和制作周期。' },
  },
  {
    id: 'R08', types: ['EQUIPMENT'], severity: 'MAJOR', stage: 'SAMPLE',
    when: (s) => s.capacity_test === 'FACTORY_SAMPLE' || s.capacity_test === 'NONE',
    title: { ko: '공장 시료로만 시운전하면 우리 제품에서는 속도·정밀도가 안 나올 수 있음', zh: '只用工厂样品试机，换成我方产品时速度·精度可能达不到' },
    how: { ko: '고객 시료를 보내 시운전 영상을 받고, 그 결과를 출고 조건으로', zh: '寄送客户样品，拍摄试机视频，并以此作为出货条件' },
    criteria: { ko: '고객 시료로 견적 속도 이상, 불량 없이 연속 운전', zh: '用客户样品达到报价速度，连续运行无不良' },
    question: { ko: '저희 시료로 시운전 영상을 찍어 줄 수 있나요?', zh: '可以用我方样品试机并拍视频吗？' },
  },
  {
    id: 'R09', types: ['ELECTRONICS'], severity: 'MAJOR', stage: 'PACKING',
    when: (s) => s.battery === 'YES',
    title: { ko: '배터리 포함 — 서류가 없으면 운송·통관이 보류됨', zh: '含电池 — 缺少文件会被暂停运输·清关' },
    how: { ko: 'UN38.3 시험 성적서·MSDS·위험물 신고 준비 (선적 서류·수입 요건과 함께 관리)', zh: '准备UN38.3测试报告、MSDS和危险品申报' },
    criteria: { ko: '선적 전 서류 3종 확보', zh: '出货前备齐三份文件' },
  },
  {
    id: 'R10', types: ['CARTON'], severity: 'MINOR', stage: 'PACKING',
    when: (s) => num(s.carton_weight) >= 15,
    title: { ko: '박스가 무거우면 아래쪽 박스가 눌리거나 찢어짐', zh: '整箱太重，下层纸箱容易压坏·破损' },
    how: { ko: '골·강도를 올리고 낙하 시험', zh: '提高楞型和强度，并做跌落测试' },
    criteria: { ko: '낙하 시험 후 박스·제품 파손 없음', zh: '跌落测试后箱体和产品无破损' },
  },
];

// ── 3. 점검 실행 ───────────────────────────────────────────────
const BROAD_TYPES = ['EQUIPMENT', 'ELECTRONICS'];
const CASE_SEVERITY = { CRITICAL: 'CRITICAL', HIGH: 'MAJOR', MEDIUM: 'MAJOR', LOW: 'MINOR' };
const tagsOf = (c) => {
  const s = c.specs || {};
  const tags = [s.paper, s.paper_surface === 'UNCOATED' ? '비코팅지' : '', s.structure === 'RIGID' ? '합지' : '', num(s.thickness) >= 2 ? '합지' : '', s.crease ? '괘선' : '', s.material].filter(Boolean);
  return new Set(tags.map((x) => String(x).toLowerCase()));
};
// 예전 장비 4종 사례(component_type 없음)는 '설비'로 본다
export const caseType = (k) => k.component_type || (k.target_category ? 'EQUIPMENT' : '');
const caseMatches = (kase, comp, tags) => caseType(kase) === comp.type && (kase.tags || []).some((t) => tags.has(String(t).toLowerCase()));

const missingFields = (c) => (COMPONENT_TYPES[c.type]?.fields || []).filter((f) => !f.optional && !filled(c.specs?.[f.key]));
const unknownFields = (c) => (COMPONENT_TYPES[c.type]?.fields || []).filter((f) => c.specs?.[f.key] === UNKNOWN);

export function evaluatePrecheck({ components = [], cases = [] } = {}) {
  const items = [];
  const usedCases = new Set(); // 사례 하나는 한 번만 띄운다 (규칙 근거로 쓰였거나 다른 구성품에 이미 붙었으면 생략)
  for (const c of components) {
    const def = COMPONENT_TYPES[c.type];
    if (!def) continue;
    const s = c.specs || {};
    const miss = missingFields(c);
    if (miss.length) {
      items.push({
        key: `MISSING:${c.key}:${miss.map((f) => f.key).join(',')}`, source: 'RULE', kind: 'MISSING_SPEC', component_key: c.key, stage: 'SPEC', severity: 'MAJOR',
        title: `${c.name}: 정하지 않은 사양 ${miss.length}개 — ${miss.map((f) => f.ko).join(', ')}`,
        title_cn: `${c.name}：${miss.length}项规格未确定 — ${miss.map((f) => f.zh).join('、')}`,
        how: '사양을 정해 입력하거나, 모르면 \'모름·공장 확인\'으로 두고 공장에 물어보세요', how_cn: '请确定规格并填写；如不清楚，请标记"待工厂确认"并询问工厂',
        question_ko: `${c.name} — ${miss.map((f) => f.ko).join(', ')} 사양을 알려 주세요.`,
        question_cn: `请确认${c.name}的以下规格：${miss.map((f) => f.zh).join('、')}。`,
        fields: miss.map((f) => f.key),
      });
    }
    const unk = unknownFields(c);
    if (unk.length) {
      items.push({
        key: `QUESTION:${c.key}:${unk.map((f) => f.key).join(',')}`, source: 'RULE', kind: 'QUESTION', component_key: c.key, stage: 'SPEC', severity: 'MAJOR',
        title: `${c.name}: 공장 확인 필요 — ${unk.map((f) => f.ko).join(', ')}`, title_cn: `${c.name}：需工厂确认 — ${unk.map((f) => f.zh).join('、')}`,
        question_ko: `${c.name} — ${unk.map((f) => f.ko).join(', ')} 사양을 알려 주세요.`,
        question_cn: `请确认${c.name}的以下规格：${unk.map((f) => f.zh).join('、')}。`,
        fields: unk.map((f) => f.key),
      });
    }
    const tags = tagsOf(c);
    for (const r of RULES) {
      if (!r.types.includes(c.type) || !r.when(s)) continue;
      const kase = r.caseTags ? cases.find((k) => caseMatches(k, c, tags) && (k.tags || []).some((t) => r.caseTags.includes(t))) : null;
      if (kase) usedCases.add(kase.id);
      const sig = Object.entries(s).filter(([, v]) => filled(v)).map(([k, v]) => `${k}=${v}`).sort().join('|');
      items.push({
        key: `${r.id}:${c.key}:${sig}`, source: kase ? 'CASE' : 'RULE', rule_id: r.id, case_id: kase?.id || '', kind: 'RISK', component_key: c.key,
        stage: r.stage, severity: r.severity,
        title: `${c.name}: ${r.title.ko}`, title_cn: `${c.name}：${r.title.zh}`,
        how: r.how.ko, how_cn: r.how.zh, criteria: r.criteria.ko, criteria_cn: r.criteria.zh,
        question_ko: r.question?.ko || '', question_cn: r.question?.zh || '',
      });
    }
  }
  // 규칙에 걸리지 않은 우리 사례: 같은 유형의 구성품 중 태그가 겹치는 곳(없으면 첫 구성품)에 한 번씩, 구성품당 최대 3건
  for (const k of [...cases].sort((a, b) => (SEV_RANK[CASE_SEVERITY[a.severity]] ?? 2) - (SEV_RANK[CASE_SEVERITY[b.severity]] ?? 2))) {
    if (usedCases.has(k.id)) continue;
    const same = components.filter((c) => caseType(k) === c.type);
    // 설비·전자처럼 범위가 넓은 유형은 태그가 겹칠 때만 붙인다 (라벨기 사례가 포장기에 뜨지 않게)
    const c = same.find((x) => caseMatches(k, x, tagsOf(x))) || (BROAD_TYPES.includes(caseType(k)) ? null : same[0]);
    if (!c || items.filter((i) => i.source === 'CASE' && !i.rule_id && i.component_key === c.key).length >= 3) continue;
    usedCases.add(k.id);
    items.push({
      key: `CASE:${k.id}:${c.key}`, source: 'CASE', case_id: k.id, kind: 'RISK', component_key: c.key,
      stage: STAGES[k.preventable_stage] ? k.preventable_stage : 'SPEC', severity: CASE_SEVERITY[k.severity] || 'MAJOR',
      title: `${c.name}: ${k.issue_case}`, title_cn: '',
      how: k.prevention || k.solution_parameter || '', how_cn: '', criteria: '', criteria_cn: '',
    });
  }
  return sortItems(items);
}

const KIND_RANK = { MISSING_SPEC: 0, QUESTION: 1, RISK: 2 };
export function sortItems(items) {
  return [...items].sort((a, b) => (KIND_RANK[a.kind] ?? 3) - (KIND_RANK[b.kind] ?? 3) || (SEV_RANK[a.severity] ?? 3) - (SEV_RANK[b.severity] ?? 3) || STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
}

// 다시 점검해도 같은 항목(key)은 이전 결정(업무 등록·제외 등)을 이어받는다. AI 항목은 그대로 남긴다.
// 공장 업로드 링크로 받은 답(factory_answer)도 새 판에 이어받는다
export function mergeDecisions(next, previous = []) {
  const byKey = new Map(previous.map((p) => [p.key, p]));
  const merged = next.map((n) => {
    const p = byKey.get(n.key);
    return p ? { ...n, decision: p.decision || 'PENDING', linked_id: p.linked_id || '', dismiss_reason: p.dismiss_reason || '', decided_by_name: p.decided_by_name || '', decided_at: p.decided_at || '', ...(p.factory_answer ? { factory_answer: p.factory_answer, factory_answered_at: p.factory_answered_at || '' } : {}) } : { ...n, decision: 'PENDING' };
  });
  const ai = previous.filter((p) => p.source === 'AI' && !merged.some((m) => m.key === p.key));
  return sortItems([...merged, ...ai]);
}

// 견적 내용이 바뀌었는지 비교하는 짧은 해시 (금액은 빼고 품목·사양·비고만)
export function quotationHash(quotation) {
  if (!quotation) return '';
  const str = JSON.stringify([quoteLines(quotation), quotation.remarks || '']);
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `${quotation.id || ''}:${(h >>> 0).toString(36)}`;
}

export function summarize(items = []) {
  const open = items.filter((i) => (i.decision || 'PENDING') === 'PENDING');
  return {
    missing: open.filter((i) => i.kind === 'MISSING_SPEC').length,
    questions: open.filter((i) => i.kind === 'QUESTION').length,
    risks: open.filter((i) => i.kind === 'RISK').length,
    critical: open.filter((i) => i.severity === 'CRITICAL').length,
  };
}

export const TASK_PRIORITY = { CRITICAL: 'URGENT', MAJOR: 'HIGH', MINOR: 'MEDIUM' };

// 공장에 보낼 질문 묶음 (중국어 원문 + 한국어)
export function factoryQuestions(items = []) {
  const qs = items.filter((i) => (i.decision || 'PENDING') !== 'DISMISSED' && (i.question_cn || i.kind === 'MISSING_SPEC'));
  const cn = qs.map((i, n) => `${n + 1}. ${i.question_cn || i.title_cn}`);
  const ko = qs.map((i, n) => `${n + 1}. ${i.question_ko || i.title}`);
  return { count: qs.length, text: qs.length ? `您好，以下规格请帮忙确认：\n${cn.join('\n')}\n\n(한국어)\n${ko.join('\n')}` : '' };
}
