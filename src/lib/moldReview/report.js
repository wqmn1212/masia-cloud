// 금형 사전 검토 판정 · 금형 설계 지시서 초안 (한국어 · 중국어)
// analyzeCore.js 의 형상 결과에 재질·사용자 조건을 얹어 판정한다. 재질을 바꿔도 형상 계산을 다시 할 필요가 없다.

import { getMaterial, MACHINE_TONNAGES, textureDraftDeg } from './materials.js';
import { estimateCavityCount } from '../moldEstimate.js';

export const DEFAULT_REPORT_SETTINGS = {
  materialKey: 'ABS',
  draftMin: 1, // 최소 구배 (°)
  textureDepth: 0, // 외관면 부식 깊이 (mm)
  cavities: null, // 비우면 자동
};

const fmt = (n, d = 1) => Number(n || 0).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const p3 = (p) => `(${p.map((v) => fmt(v, 1)).join(', ')})`;

// Pye 핀 게이트 공식의 살 두께 계수 C
const PIN_C = [[0.75, 0.178], [1.0, 0.206], [1.25, 0.23], [1.5, 0.242], [1.75, 0.272], [2.0, 0.294], [2.25, 0.309], [2.5, 0.326]];
function pinC(t) {
  if (t <= PIN_C[0][0]) return PIN_C[0][1];
  for (let i = 1; i < PIN_C.length; i++) {
    if (t <= PIN_C[i][0]) {
      const [t0, c0] = PIN_C[i - 1], [t1, c1] = PIN_C[i];
      return c0 + ((c1 - c0) * (t - t0)) / (t1 - t0);
    }
  }
  return PIN_C[PIN_C.length - 1][1];
}

/**
 * 게이트 치수 (Pye, Injection Mould Design)
 *  사이드 게이트: 깊이 h = n·t, 폭 W = n·√A / 30
 *  핀 포인트·서브마린: 지름 d = n·C·A^¼ (0.6~2.0mm 로 제한)
 *  A = 캐비티 표면적 ≈ 부품 겉넓이의 절반 (mm²)
 */
export function gateSize(gate, material, surfaceArea) {
  const n = material.gateN;
  const t = gate.localThickness;
  const A = Math.max(1, surfaceArea / 2);
  if (gate.kind === 'edge') {
    const depth = Math.max(0.3, n * t);
    const width = Math.max(depth * 1.5, (n * Math.sqrt(A)) / 30);
    return {
      depth, width,
      ko: `폭 ${fmt(width, 1)} × 깊이 ${fmt(depth, 1)}mm`,
      zh: `宽 ${fmt(width, 1)} × 深 ${fmt(depth, 1)}mm`,
    };
  }
  const d = Math.min(2, Math.max(0.6, n * pinC(t) * A ** 0.25));
  return { diameter: d, ko: `Ø${fmt(d, 1)}mm`, zh: `Ø${fmt(d, 1)}mm` };
}

const GATE_KIND = {
  pin: { ko: '핀 포인트 게이트 (3단 금형) · 2단이면 서브마린', zh: '点浇口 (三板模) · 两板模用潜伏式浇口' },
  edge: { ko: '사이드(에지) 게이트', zh: '侧浇口' },
};
const GATE_WHERE = {
  pin: { ko: '외관 반대쪽 평평한 면', zh: '非外观面的平面处' },
  edge: { ko: '파팅라인 위 제품 외곽', zh: '分型线上的产品外缘' },
};

/** 면별 배열로 재질·조건에 따른 면적 합계를 낸다 */
function faceStats(result, settings, material) {
  const { side, draft, S, area, wall } = result.face;
  const { nominal } = result.summary;
  const cosmetic = result.options.cosmetic;
  const cosmeticSide = cosmetic === 'core' ? -1 : 1;
  const gateSide = -cosmeticSide;
  const extra = textureDraftDeg(settings.textureDepth);
  const stats = { wallA: 0, draftReverseA: 0, draftNoneA: 0, draftLowA: 0, thinA: 0, ribThinA: 0, thinWall: Infinity };
  const ribLimit = Math.max(0.5, nominal * 0.35);
  for (let t = 0; t < side.length; t++) {
    const a = area[t];
    if (side[t] !== 0 && Math.abs(draft[t]) < 45) {
      const onCosmetic = cosmetic === 'both' || side[t] === cosmeticSide;
      const need = settings.draftMin + (onCosmetic ? extra : 0);
      stats.wallA += a;
      if (draft[t] < -0.25) stats.draftReverseA += a;
      else if (draft[t] < need * 0.5) stats.draftNoneA += a;
      else if (draft[t] < need) stats.draftLowA += a;
    }
    if (wall[t] < material.minWall) {
      // 가동측의 세운 면(리브)은 원래 기본 두께의 50~60% 로 얇게 만든다 → 따로, 더 낮은 기준으로 본다
      const ribLike = side[t] === gateSide && Math.abs(S[t]) < 0.25;
      if (ribLike) {
        if (wall[t] < ribLimit) stats.ribThinA += a;
      } else {
        stats.thinA += a;
        if (wall[t] < stats.thinWall) stats.thinWall = wall[t];
      }
    }
  }
  return stats;
}

/**
 * @param {object} result analyzeMold 결과
 * @param {object} settings DEFAULT_REPORT_SETTINGS + { partName, fileName }
 */
export function buildMoldReport(result, settings = {}) {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  const material = getMaterial(st.materialKey);
  const s = result.summary;
  const stats = faceStats(result, st, material);
  const textureExtra = textureDraftDeg(st.textureDepth);

  // 성형 조건
  const maxEdge = Math.max(...s.size);
  const cavitiesAuto = estimateCavityCount(maxEdge);
  const cavities = Number(st.cavities) > 0 ? Math.round(Number(st.cavities)) : cavitiesAuto;
  const weight = (s.volume / 1000) * material.density;
  const projectedCm2 = s.projectedA / 100;
  const tonnage = ((projectedCm2 * cavities * material.pressure) / 1000) * 1.2;
  const machine = MACHINE_TONNAGES.find((m) => m >= tonnage) || Math.ceil(tonnage / 50) * 50;

  // 게이트 배치: 1점으로 재질 한계를 넘으면 2점 조합
  const single = result.plans.find((p) => p.id === 'single');
  const double = result.plans.find((p) => p.id === 'double');
  const overLimit = single ? single.lt > material.lt : false;
  const plan = overLimit && double ? double : single || null;
  const gates = result.gates.map((g, i) => ({
    ...g,
    label: `G${i + 1}`,
    size: gateSize(g, material, s.totalA),
    kindLabel: GATE_KIND[g.kind],
    whereLabel: GATE_WHERE[g.kind],
  }));
  const planGates = plan ? plan.gates.map((g) => ({ ...g, size: gateSize(g, material, s.totalA), kindLabel: GATE_KIND[g.kind], whereLabel: GATE_WHERE[g.kind] })) : [];

  const items = [];
  const add = (item) => items.push(item);
  const pctOf = (a) => `${fmt((a / s.totalA) * 100, 1)}%`;

  // 1. 빼기 방향
  add({
    id: 'pull', level: 'info', mode: 'under', view: 'side',
    title: { ko: `빼기 방향 ${result.pull.label}${result.pull.auto ? ' (자동)' : ''}`, zh: `脱模方向 ${result.pull.label}${result.pull.auto ? ' (自动)' : ''}` },
    text: {
      ko: result.pull.tilted
        ? '부품이 어셈블리 안에서 기울어져 있어, 언더컷이 가장 적은 기운 축으로 뺍니다. 금형은 이 축을 기준으로 놓습니다.'
        : '언더컷이 가장 적고, 같으면 투영 면적이 큰(얇게 열리는) 방향입니다. 화살표 쪽이 고정측(캐비티)입니다.',
      zh: result.pull.tilted
        ? '零件在装配中是倾斜的，按倒扣最少的倾斜轴脱模，模具以此轴为基准摆放。'
        : '倒扣最少、投影面积最大的方向。箭头一侧为定模（型腔）。',
    },
  });

  // 2. 구배
  const badDraft = stats.draftNoneA + stats.draftReverseA;
  const belowDraft = badDraft + stats.draftLowA;
  const draftLevel = badDraft > stats.wallA * 0.005 && badDraft > 1 ? 'hi' : belowDraft > 1 ? 'mid' : 'ok';
  const need = `${st.draftMin}°${textureExtra ? ` (부식면 ${st.draftMin + textureExtra}°)` : ''}`;
  const needZh = `${st.draftMin}°${textureExtra ? ` (蚀纹面 ${st.draftMin + textureExtra}°)` : ''}`;
  add({
    id: 'draft', level: draftLevel, mode: 'draft', view: 'front',
    title: { ko: '구배', zh: '拔模斜度' },
    text: draftLevel === 'ok'
      ? { ko: `기준 ${need} 미만의 벽면이 주의 판정 면적(1mm²)을 넘지 않습니다.`, zh: `低于标准 ${needZh} 的侧壁面积未超过注意判定阈值 (1mm²)。` }
      : {
        ko: `기준의 절반 미만 ${fmt(stats.draftNoneA, 0)}mm²${stats.draftReverseA > 1 ? ` · 역구배 ${fmt(stats.draftReverseA, 0)}mm²` : ''} · 기준 미만 ${fmt(stats.draftLowA, 0)}mm² (기준 ${need}). 제품이 금형에서 잘 빠지지 않거나 표면이 긁힐 수 있습니다.`,
        zh: `低于标准一半 ${fmt(stats.draftNoneA, 0)}mm²${stats.draftReverseA > 1 ? ` · 倒拔模 ${fmt(stats.draftReverseA, 0)}mm²` : ''} · 低于标准 ${fmt(stats.draftLowA, 0)}mm² (标准 ${needZh})。可能脱模困难或拉伤表面。`,
      },
  });

  // 3. 언더컷
  const uc = result.undercuts;
  const slides = uc.filter((u) => u.type === 'slide').length;
  const lifters = uc.length - slides;
  const ucList = (lang) => uc.map((u, i) => {
    const type = u.type === 'slide' ? (lang === 'ko' ? '슬라이드' : '滑块') : lang === 'ko' ? '리프터' : '斜顶';
    const complex = u.complex ? (lang === 'ko' ? ' (복합 · 형상 변경 검토)' : ' (复杂 · 建议改形状)') : '';
    return lang === 'ko'
      ? `${type} ${i + 1}: ${fmt(u.area, 0)}mm², 깊이 ${fmt(u.depth, 1)}mm → 이동 ${fmt(u.stroke, 1)}mm${complex}`
      : `${type} ${i + 1}: ${fmt(u.area, 0)}mm², 深 ${fmt(u.depth, 1)}mm → 行程 ${fmt(u.stroke, 1)}mm${complex}`;
  }).join(' / ');
  add({
    id: 'undercut', level: uc.length ? 'hi' : 'ok', mode: 'under',
    focus: uc[0] ? { position: uc[0].center } : null, view: uc.length ? null : 'side',
    title: { ko: uc.length ? `언더컷 ${uc.length}곳` : '언더컷 없음', zh: uc.length ? `倒扣 ${uc.length} 处` : '无倒扣' },
    text: uc.length
      ? {
        ko: `슬라이드 ${slides}개${lifters ? ` · 리프터 ${lifters}개` : ''} 필요 (추정). 금형비·납기가 늘어나는 가장 큰 요인이므로 형상을 바꿔 없앨 수 있는지 먼저 봅니다. ${ucList('ko')}`,
        zh: `需要滑块 ${slides} 个${lifters ? ` · 斜顶 ${lifters} 个` : ''} (估算)。这是模具费和交期增加的最大因素，请先确认能否通过改形状取消。${ucList('zh')}`,
      }
      : { ko: `${result.pull.label} 방향으로 모두 빠집니다.`, zh: `沿 ${result.pull.label} 方向均可脱模。` },
  });

  // 4. 수축 자국 (두꺼운 곳)
  const sinkLevel = s.thickCosmeticA > Math.max(20, s.totalA * 0.005) ? 'hi' : s.thickA > 2 ? 'mid' : 'ok';
  add({
    id: 'sink', level: sinkLevel, mode: 'thick', view: 'top',
    title: { ko: '수축 자국 위험 (두꺼운 부분)', zh: '缩水风险 (壁厚过厚)' },
    text: s.thickA > 2
      ? {
        ko: `기본 살 두께의 ${result.options.sinkRatio}배(${fmt(s.thickLimit, 2)}mm)를 넘는 곳 ${fmt(s.thickA, 0)}mm² (${pctOf(s.thickA)}), 그중 외관면 ${fmt(s.thickCosmeticA, 0)}mm². 리브·보스 뿌리 반대쪽 외관에 수축 자국이 생길 수 있습니다. ${material.name} 리브 두께는 기본 두께의 ${Math.round(material.ribRatio * 100)}% 이하, 보스는 속을 빼서 균일하게.`,
        zh: `超过基本壁厚 ${result.options.sinkRatio} 倍 (${fmt(s.thickLimit, 2)}mm) 的区域 ${fmt(s.thickA, 0)}mm² (${pctOf(s.thickA)})，其中外观面 ${fmt(s.thickCosmeticA, 0)}mm²。筋位·螺柱根部对面的外观可能缩水。${material.zh} 筋厚建议为基本壁厚的 ${Math.round(material.ribRatio * 100)}% 以下，螺柱掏空使壁厚均匀。`,
      }
      : { ko: '두꺼운 부분이 없습니다.', zh: '没有过厚的部位。' },
  });

  // 5. 미성형 (얇은 곳)
  const thinLevel = stats.thinA > 2 || stats.ribThinA > 2 ? 'mid' : 'ok';
  add({
    id: 'thin', level: thinLevel, mode: 'thick', view: 'bottom',
    title: { ko: '미성형 위험 (얇은 부분)', zh: '缺胶风险 (壁厚过薄)' },
    text: {
      ko: `${stats.thinA > 2 ? `${material.name} 권장 최소 ${material.minWall}mm보다 얇은 벽 ${fmt(stats.thinA, 0)}mm² (가장 얇은 곳 ${fmt(stats.thinWall, 2)}mm). 끝까지 차지 않을 수 있어 두께를 늘리거나 게이트를 가까이 둡니다.` : `벽은 모두 ${material.minWall}mm 이상입니다.`}${stats.ribThinA > 2 ? ` 기본 두께의 35%보다 얇은 리브 ${fmt(stats.ribThinA, 0)}mm²도 확인이 필요합니다.` : ''}`,
      zh: `${stats.thinA > 2 ? `比 ${material.zh} 建议最小壁厚 ${material.minWall}mm 更薄的区域 ${fmt(stats.thinA, 0)}mm² (最薄 ${fmt(stats.thinWall, 2)}mm)。可能充填不满，建议加厚或浇口靠近。` : `壁厚均在 ${material.minWall}mm 以上。`}${stats.ribThinA > 2 ? ` 另有薄于基本壁厚 35% 的筋位 ${fmt(stats.ribThinA, 0)}mm² 需确认。` : ''}`,
    },
  });

  // 6. 파팅라인
  const pl = result.parting;
  const visible = pl.smoothLength > Math.max(2, pl.length * 0.03);
  const stepped = pl.step > pl.stepLimit;
  add({
    id: 'parting', level: visible || stepped ? 'mid' : 'ok', mode: 'under', view: 'front',
    title: { ko: '파팅라인', zh: '分型线' },
    text: {
      ko: `주 파팅라인 ${fmt(pl.length, 0)}mm, ${stepped ? `높이 차 ${fmt(pl.step, 1)}mm (단차 파팅, 금형 가공 증가)` : '평면 파팅'}. ${visible ? `곡면 위를 지나는 ${fmt(pl.smoothLength, 0)}mm 구간은 파팅 자국이 외관에 보일 수 있습니다.` : '모서리를 따라가서 외관에 잘 드러나지 않습니다.'}${pl.shutoffs ? ` 관통부 막음면(shut-off) ${pl.shutoffs}곳.` : ''}`,
      zh: `主分型线 ${fmt(pl.length, 0)}mm，${stepped ? `高度差 ${fmt(pl.step, 1)}mm (阶梯分型，加工增加)` : '平面分型'}。${visible ? `经过曲面的 ${fmt(pl.smoothLength, 0)}mm 段可能在外观上留下夹线。` : '沿棱边走线，外观不明显。'}${pl.shutoffs ? ` 碰穿面 ${pl.shutoffs} 处。` : ''}`,
    },
  });

  // 7. 게이트
  if (plan && planGates.length) {
    const ltText = (lt) => `${fmt(lt, 0)} (${material.name} 한계 ${material.lt})`;
    const g1 = planGates[0];
    if (plan.id === 'double') {
      add({
        id: 'gate', level: 'mid', mode: 'flow', view: 'bottom',
        title: { ko: '게이트 2점 권장', zh: '建议两点进胶' },
        text: {
          ko: `1점(G1)으로는 유동 길이비 L/t ${ltText(single.lt)}를 넘어 끝까지 차기 어렵습니다. 2점으로 나누면 ${fmt(plan.lt, 0)}입니다. ${planGates.map((g, i) => `${i + 1}) ${g.kindLabel.ko} ${g.size.ko} ${p3(g.position)}`).join(' · ')}`,
          zh: `单点 (G1) 流长比 L/t ${fmt(single.lt, 0)} 超过 ${material.zh} 极限 ${material.lt}，难以充满。两点进胶为 ${fmt(plan.lt, 0)}。${planGates.map((g, i) => `${i + 1}) ${g.kindLabel.zh} ${g.size.zh} ${p3(g.position)}`).join(' · ')}`,
        },
      });
    } else {
      add({
        id: 'gate', level: overLimit ? 'hi' : 'ok', mode: 'flow', view: 'bottom',
        title: { ko: `게이트 추천 · ${g1.kind === 'pin' ? '핀 포인트' : '사이드'}`, zh: `浇口建议 · ${g1.kind === 'pin' ? '点浇口' : '侧浇口'}` },
        text: {
          ko: `1순위 G1: ${g1.kindLabel.ko} ${g1.size.ko}, 위치는 ${g1.whereLabel.ko} ${p3(g1.position)}. 최대 유동 거리 ${fmt(plan.maxFlow, 0)}mm, 유동 길이비 L/t ${ltText(plan.lt)}${overLimit ? ' 초과' : ' 이내'}. 후보 ${gates.length}곳.`,
          zh: `首选 G1：${g1.kindLabel.zh} ${g1.size.zh}，位置 ${g1.whereLabel.zh} ${p3(g1.position)}。最大流动距离 ${fmt(plan.maxFlow, 0)}mm，流长比 L/t ${fmt(plan.lt, 0)} (${material.zh} 极限 ${material.lt}${overLimit ? '，超出' : '，以内'})。候选 ${gates.length} 处。`,
        },
      });
    }
  } else {
    add({
      id: 'gate', level: 'info', mode: 'flow',
      title: { ko: '게이트 후보 없음', zh: '无浇口候选' },
      text: { ko: '외관 반대쪽에 넓고 평평한 면을 찾지 못했습니다. 외관면 설정을 바꿔 보세요.', zh: '非外观侧未找到足够大的平面，请调整外观面设置。' },
    });
  }

  // 8. 웰드라인
  const welds = plan ? plan.weldGroups : [];
  const cosmeticWelds = welds.filter((w) => w.cosmetic);
  const behind = welds.filter((w) => w.behindObstacle).length;
  add({
    id: 'weld', level: cosmeticWelds.length ? 'hi' : welds.length ? 'mid' : 'ok', mode: 'flow', view: 'top',
    focus: welds[0] ? { position: welds[0].center } : null,
    title: { ko: welds.length ? `웰드라인 ${welds.length}곳${cosmeticWelds.length ? ` (외관 ${cosmeticWelds.length})` : ''}` : '웰드라인 없음', zh: welds.length ? `熔接线 ${welds.length} 处${cosmeticWelds.length ? ` (外观 ${cosmeticWelds.length})` : ''}` : '无熔接线' },
    text: welds.length
      ? {
        ko: `흐름이 갈라졌다 만나는 곳입니다${behind ? ` (구멍·창 뒤 ${behind}곳)` : ''}. 선이 보이고 강도가 약해질 수 있어, 외관면이면 게이트 위치를 옮기거나 위치를 미리 합의합니다. 표면 거리로 근사한 결과이므로 모류분석으로 확인합니다. ${welds.slice(0, 4).map((w) => `${fmt(w.length, 0)}mm ${p3(w.center)}${w.cosmetic ? ' 외관' : ''}`).join(' / ')}`,
        zh: `料流分开后汇合处${behind ? ` (孔·窗后方 ${behind} 处)` : ''}。可能出现可见线并降低强度，若在外观面需调整浇口或事先确认位置。本结果为表面距离近似，请以模流分析确认。${welds.slice(0, 4).map((w) => `${fmt(w.length, 0)}mm ${p3(w.center)}${w.cosmetic ? ' 外观' : ''}`).join(' / ')}`,
      }
      : { ko: '이 게이트 배치에서는 흐름이 만나는 선이 없습니다.', zh: '此浇口布置下没有料流汇合线。' },
  });

  // 9. 가스 빼기
  const air = plan ? plan.air : [];
  const inner = air.filter((a) => !a.atParting).length;
  add({
    id: 'air', level: inner ? 'mid' : air.length ? 'info' : 'ok', mode: 'flow', view: 'top',
    focus: air[0] ? { position: air[0].position } : null,
    title: { ko: `가스 빼기 후보 ${air.length}곳`, zh: `排气候选 ${air.length} 处` },
    text: {
      ko: `가장 늦게 차는 곳입니다. 공기가 갇히면 탄 자국·미성형이 생깁니다.${inner ? ` 그중 ${inner}곳은 파팅면에서 떨어져 있어 벤트·이젝터 핀 배기가 필요합니다.` : ' 모두 파팅면 위라 파팅면 벤트로 뺄 수 있습니다.'}`,
      zh: `最后充填的位置，困气会造成烧焦·缺胶。${inner ? `其中 ${inner} 处远离分型面，需要排气槽或顶针排气。` : '均在分型面上，可通过分型面排气。'}`,
    },
  });

  // 10. 조립 · 인서트
  add({
    id: 'assembly', level: 'info', mode: null,
    title: { ko: '조립 · 인서트 사출', zh: '装配 · 嵌件注塑' },
    text: {
      ko: '부품 사이 간섭·틈새와 인서트 주변 살 두께는 이 화면에서 보지 않습니다. 조립 상태 STEP 과 인서트 부품 지정이 필요합니다.',
      zh: '零件间干涉·间隙及嵌件周边壁厚不在本页面检查，需要装配状态的 STEP 及嵌件指定。',
    },
  });

  const calc = { weight, cavities, cavitiesAuto, projectedCm2, tonnage, machine };
  const report = { material, settings: st, stats, calc, plan, planGates, gates, items };
  report.spec = { ko: specText(result, report, 'ko'), zh: specText(result, report, 'zh') };
  report.counts = { hi: items.filter((i) => i.level === 'hi').length, mid: items.filter((i) => i.level === 'mid').length };
  return report;
}

function specText(result, report, lang) {
  const s = result.summary, m = report.material, c = report.calc, st = report.settings, pl = result.parting;
  const ko = lang === 'ko';
  const L = (k, z) => (ko ? k : z);
  const cosmetic = result.options.cosmetic;
  const cosmeticName = cosmetic === 'core' ? L('가동측(코어)', '动模侧 (型芯)') : cosmetic === 'both' ? L('양면', '两面') : L('고정측(캐비티)', '定模侧 (型腔)');
  const extra = textureDraftDeg(st.textureDepth);
  const fix = [];
  const stats = report.stats;
  const belowDraft = stats.draftNoneA + stats.draftReverseA + stats.draftLowA;
  if (belowDraft > 1) {
    fix.push(L(
      `- 구배 부족 벽면 ${fmt(belowDraft, 0)}mm² → ${st.draftMin}° 이상${extra ? ` (부식면 ${st.draftMin + extra}°)` : ''}`,
      `- 拔模不足侧壁 ${fmt(belowDraft, 0)}mm² → ${st.draftMin}° 以上${extra ? ` (蚀纹面 ${st.draftMin + extra}°)` : ''}`, 
    ));
  }
  if (s.thickA > 2) fix.push(L(`- 두꺼운 부분 ${fmt(s.thickA, 0)}mm² → 리브 두께 기본 두께의 ${Math.round(m.ribRatio * 100)}% 이하, 보스는 속 빼기`, `- 过厚部位 ${fmt(s.thickA, 0)}mm² → 筋厚为基本壁厚的 ${Math.round(m.ribRatio * 100)}% 以下，螺柱掏空`));
  if (stats.thinA > 2) fix.push(L(`- ${m.minWall}mm 미만 부분 ${fmt(stats.thinA, 0)}mm² → 두께 보강 또는 게이트 근접`, `- 小于 ${m.minWall}mm 的部位 ${fmt(stats.thinA, 0)}mm² → 加厚或浇口靠近`));
  if (result.undercuts.length) fix.push(L(`- 언더컷 ${result.undercuts.length}곳 → 형상 변경으로 없앨 수 있는지 먼저 검토 (불가 시 슬라이드·리프터)`, `- 倒扣 ${result.undercuts.length} 处 → 先评估能否改形状取消 (否则用滑块·斜顶)`));
  const welds = report.plan ? report.plan.weldGroups : [];
  if (welds.some((w) => w.cosmetic)) fix.push(L('- 외관면 웰드라인 → 게이트 위치 조정 또는 위치 사전 합의', '- 外观面熔接线 → 调整浇口位置或事先确认位置'));
  const uc = result.undercuts.map((u, i) => `${u.type === 'slide' ? L('슬라이드', '滑块') : L('리프터', '斜顶')} ${i + 1} ${p3(u.center)} ${L('깊이', '深')} ${fmt(u.depth, 1)} / ${L('이동', '行程')} ${fmt(u.stroke, 1)}mm`);
  const gates = report.planGates.length ? report.planGates : [];
  const air = report.plan ? report.plan.air : [];
  const lines = [
    L('[금형 설계 지시서 초안 · AEGIS]', '[模具设计指示书 (草案) · AEGIS]'),
    `${L('제품', '产品')}: ${st.partName || '-'}${st.fileName ? ` (${st.fileName})` : ''}`,
    `${L('재질', '材料')}: ${ko ? m.name : m.zh} · ${L('수축률', '收缩率')} ${m.shrink[0]}~${m.shrink[1]}% ${L('(금형 치수 보정)', '(模具尺寸补偿)')}`,
    `${L('크기', '尺寸')}: ${s.size.map((v) => fmt(v, 1)).join(' × ')} mm · ${L('중량 약', '重量约')} ${fmt(c.weight, 1)} g · ${L('기본 살 두께', '基本壁厚')} ${fmt(s.nominal, 2)} mm`,
    '',
    `1. ${L('빼기 방향', '脱模方向')}: ${result.pull.label}${result.pull.tilted ? L(' (기운 축)', ' (倾斜轴)') : ''} · ${L('외관면', '外观面')} = ${cosmeticName}`,
    `2. ${L('파팅라인', '分型线')}: ${L('주 파팅라인', '主分型线')} ${fmt(pl.length, 0)}mm, ${pl.step > pl.stepLimit ? `${L('단차', '高度差')} ${fmt(pl.step, 1)}mm` : L('평면 파팅', '平面分型')}${pl.smoothLength > 2 ? `, ${L('곡면 통과', '经过曲面')} ${fmt(pl.smoothLength, 0)}mm ${L('(외관 확인)', '(确认外观)')}` : ''}${pl.shutoffs ? `, ${L('관통부 막음면', '碰穿面')} ${pl.shutoffs}${L('곳', '处')}` : ''}`,
    `3. ${L('언더컷', '倒扣')}: ${uc.length ? uc.join(' / ') : L('없음', '无')}`,
    `4. ${L('캐비티', '型腔数')}: ${c.cavities}${L('개', '')} · ${L('형체력 약', '锁模力约')} ${fmt(c.tonnage, 0)}${L('톤', '吨')} → ${c.machine}${L('톤급 이상 사출기', '吨以上注塑机')}`,
    `5. ${L('게이트', '浇口')}: ${gates.length ? gates.map((g, i) => `${gates.length > 1 ? `${i + 1}) ` : ''}${ko ? g.kindLabel.ko : g.kindLabel.zh} ${ko ? g.size.ko : g.size.zh} ${p3(g.position)}`).join(' / ') : L('협의', '待定')}`,
    `   ${L('유동 길이비', '流长比')} L/t ≈ ${report.plan ? fmt(report.plan.lt, 0) : '-'} (${ko ? m.name : m.zh} ${L('참고 한계', '参考极限')} ${m.lt})`,
    `6. ${L('웰드라인', '熔接线')}: ${welds.length ? welds.slice(0, 4).map((w) => `${p3(w.center)}${w.cosmetic ? L(' 외관', ' 外观') : ''}`).join(' ') : L('없음', '无')}`,
    `7. ${L('가스 벤트', '排气')}: ${L('마지막 충전 후보', '最后充填候选')} ${air.length}${L('곳', '处')} ${air.slice(0, 3).map((a) => p3(a.position)).join(' ')}`,
    '',
    L('[금형 설계 전 수정 권고]', '[模具设计前修改建议]'),
    ...(fix.length ? fix : [L('- 없음', '- 无')]),
    '',
    L('[공장 요청 사항]', '[工厂需提供]'),
    L('- 금형 DFM 보고서 (模具DFM报告)', '- 模具DFM报告'),
    L('- 모류분석 보고서 (模流分析): 충전·보압·휨·웰드라인 위치', '- 模流分析报告: 充填·保压·翘曲·熔接线位置'),
    L('- 금형 3D · 2D 도면 → AEGIS 검수와 고객 승인 후 가공 시작', '- 模具 3D · 2D 图纸 → AEGIS 审核及客户批准后开始加工'),
    '',
    L('※ 형상 자동 검토 결과입니다. 최종 판단은 금형 설계자와 모류분석으로 확정합니다.', '※ 本结果为形状自动检查，最终以模具设计及模流分析确认。'),
  ];
  return lines.join('\n');
}