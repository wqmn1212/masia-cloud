// 외형 3D 장면: 고른 시안(정면)과 측면 이미지로 만든 외형 + 윗면 작은 부품 + 내부 부품(내부 보기용)
// 부품 3D(기본 도형 조립)는 내부 배치·금형 검토용으로 그대로 두고, 고객에게 보여 주는 겉모양은 이 장면을 쓴다.
import * as THREE from 'three';
import { silhouette, buildHullGeometry, hullMaterial, topColor, sideLooksLikeFront, rescaleSide, topDetailParts, fitPartsToHull } from '@/lib/conceptHull';
import { buildConceptGroup } from '@/lib/conceptScene';

const INNER = ['INTERNAL', 'PCB'];

/** 시안 정면·측면 주소 (스케치 정리를 끝낸 컨셉만) */
export function hullSources(sketch) {
  if (sketch?.status !== 'READY') return null;
  const front = sketch.variants?.[sketch.chosen]?.url;
  if (!front || !sketch.side_url) return null;
  return { front, side: sketch.side_url };
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('시안 이미지를 불러오지 못했습니다.'));
  img.src = src;
});

function pixels(img, max = 1024) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { canvas: c, data: ctx.getImageData(0, 0, c.width, c.height) };
}

/**
 * 윤곽을 읽어 외형을 만든다. 실패하면 이유와 함께 예외를 던진다 (화면은 부품 3D 로 돌아간다).
 * overall: 컨셉 전체 치수(mm) — 높이는 이 값을 쓰고, 폭·깊이는 이미지 비율로 계산한다.
 */
export async function measureHull(src, overall) {
  const [fi, si] = await Promise.all([loadImage(src.front), loadImage(src.side)]);
  const fp = pixels(fi), sp = pixels(si);
  const front = silhouette(fp.data);
  let side = silhouette(sp.data);
  if (!front || !side || front.height < fp.data.height * 0.15 || side.height < sp.data.height * 0.15) throw new Error('시안 이미지에서 제품 윤곽을 찾지 못했습니다.');
  let sideWarn = '';
  if (sideLooksLikeFront(front, side)) {
    // 측면 대신 정면·뒷면이 그려진 경우: 깊이는 부품 3D 의 비율을 쓰고, 옆면 색은 정면 가장자리를 이어 쓴다
    const d = (Number(overall?.z) || 0) / (Number(overall?.y) || 1);
    side = rescaleSide(side, d > 0.05 ? d : 0.8 * (front.width / front.height));
    sideWarn = '측면 이미지가 정면과 거의 같아(뒷면일 수 있습니다) 깊이는 부품 3D 기준으로 맞췄습니다. 스케치 정리에서 측면을 다시 만들면 정확해집니다.';
  }
  return { fi, si, fp, front, side, sideWarn, heightMm: Math.max(Number(overall?.y) || 100, 1) };
}

export function buildHullScene(m, parts, overall) {
  const group = new THREE.Group();
  const hull = buildHullGeometry(m.front, m.side, { heightMm: m.heightMm });
  const tF = new THREE.Texture(m.fi), tS = new THREE.Texture(m.si);
  [tF, tS].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; });
  const top = topColor(m.fp.data, m.front);
  const material = hullMaterial(tF, tS, {
    top, capFrom: m.heightMm * 0.82, capTo: m.heightMm * 0.9,
    useSide: !m.side.unreliable, frontCx: m.front.cx / m.front.imgW,
  });
  material.transparent = true;
  const shell = new THREE.Mesh(hull.geometry, material);
  shell.renderOrder = 2;
  group.add(shell);

  // 윗면 작은 부품(분무구 테두리 등)은 외형 위에, 내부 부품은 외형 안에 크기를 맞춰 넣는다
  // 외형 윗면은 높이 끝에서 닫히므로 작은 부품은 그 면 위에 살짝 걸치게 올린다 (아래 30% 만 묻힘)
  const details = fitPartsToHull(topDetailParts(parts, overall), overall, hull.size).map((p) => ({
    ...p, layer: 'UI', position: { ...p.position, y: hull.size.y + p.size.y * 0.2 },
  }));
  const inner = fitPartsToHull((parts || []).filter((p) => INNER.includes(p.layer)), overall, hull.size, 0.95);
  const built = buildConceptGroup([...details, ...inner]);
  group.add(built.group);

  const box = new THREE.Box3().setFromObject(shell);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1);
  const textures = [tF, tS];
  return {
    group, items: built.items, center, radius, explodedCenter: center, explodedRadius: radius,
    size: { x: Math.round(hull.size.x), y: Math.round(hull.size.y), z: Math.round(hull.size.z) },
    /** 매 프레임: 내부 보기·강조 때 외형을 반투명하게 */
    step(state, k = 0.14) {
      const target = state.xray ? 0.18 : state.highlightId ? 0.35 : 1;
      const u = material.uniforms.opacity;
      u.value += (target - u.value) * k;
      material.depthWrite = u.value > 0.95;
      built.items.forEach((it) => { it.mesh.visible = !INNER.includes(it.layer) || u.value < 0.98; });
    },
    dispose() { textures.forEach((t) => t.dispose()); },
  };
}
