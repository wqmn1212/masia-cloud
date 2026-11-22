// 3D 작업대 무대: 스튜디오 조명(반사 환경) + 커팅 매트 바닥 + 부드러운 실제 그림자
// 이 파일은 아무것도 import 하지 않는다 (작동 원리 엔진·오프라인 HTML 에서도 그대로 쓰려고). three 는 인자로 받는다.
//
// setupStage(THREE, { scene, renderer, center, radius, minY, RoomEnvironment, accent, mat = true })
//  → { update(), dispose(), shadowCasters(objects) }

/** 부품 목록에서 제품 강조색: 가장 큰 외장(SHELL)의 색이 충분히 진하면 그 색, 아니면 기본 파랑 */
export function accentOf(parts, fallback = '#0066FF') {
  const hex = /^#[0-9a-fA-F]{6}$/;
  const vol = (p) => (Number(p?.size?.x) || 1) * (Number(p?.size?.y) || 1) * (Number(p?.size?.z) || 1);
  const pick = (list) => list.filter((p) => hex.test(p?.color || '')).sort((a, b) => vol(b) - vol(a));
  const cands = [...pick((parts || []).filter((p) => p.layer === 'UI')), ...pick((parts || []).filter((p) => p.layer === 'SHELL'))];
  for (const p of cands) {
    const n = parseInt(p.color.slice(1), 16);
    const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (sat > 0.35 && lum > 0.12 && lum < 0.75) return p.color.toUpperCase();
  }
  return fallback;
}

/** 강조색 위에 올릴 글자색 */
export const onAccent = (hex) => {
  const n = parseInt(String(hex || '#0066FF').slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.62 ? '#171719' : '#FFFFFF';
};

// 커팅 매트 무늬 (청회색 바탕 + 1cm·5cm 격자 + 가장자리 눈금)
function matTexture(THREE, cell) {
  const N = 1024;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#9aa7b6'; g.fillRect(0, 0, N, N);
  const n = 40; const s = N / n;
  for (let i = 0; i <= n; i += 1) {
    const major = i % 5 === 0;
    g.strokeStyle = major ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.18)';
    g.lineWidth = major ? 2 : 1;
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, N); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(N, i * s); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { cell: cell * n };
  return t;
}

export function setupStage(THREE, { scene, renderer, center, radius, minY, RoomEnvironment, mat = true } = {}) {
  const disposers = [];
  // 색·밝기: 사진처럼 (ACES) — 렌더러에서 한 번만
  if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

  // 스튜디오 반사 환경 (금속·유광 재질이 살아난다)
  if (RoomEnvironment && THREE.PMREMGenerator) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      disposers.push(() => { env.dispose(); pmrem.dispose(); });
    } catch { /* 환경이 없어도 보인다 */ }
  }

  // 실제 그림자: 위에서 비추는 주광 하나만 그림자를 만든다
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.copy(center).add(new THREE.Vector3(radius * 1.2, radius * 3, radius * 1.6));
  sun.target.position.copy(center);
  sun.castShadow = true;
  const sm = sun.shadow;
  sm.mapSize.set(1024, 1024);
  const span = radius * 3;
  Object.assign(sm.camera, { left: -span, right: span, top: span, bottom: -span, near: radius * 0.2, far: radius * 8 });
  sm.camera.updateProjectionMatrix();
  sm.bias = -0.0004;
  sm.normalBias = radius * 0.004;
  sm.radius = 6;
  scene.add(sun, sun.target);
  disposers.push(() => { scene.remove(sun, sun.target); sm.map?.dispose(); });

  let floor = null;
  if (mat) {
    // 1 cm 격자 = 10 mm (부품 단위가 mm). 제품이 아주 크거나 작으면 격자를 맞춘다
    const cell = radius > 400 ? 50 : radius < 25 ? 2 : 10;
    const tex = matTexture(THREE, cell);
    const size = radius * 10;
    tex.repeat.set(size / tex.userData.cell, size / tex.userData.cell);
    const geo = new THREE.PlaneGeometry(size, size);
    // 가장자리로 갈수록 투명하게 (배경과 자연스럽게 이어지도록) — 투명도 지도는 반복하지 않는다
    const fade = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#fff'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })();
    const matl = new THREE.MeshStandardMaterial({ map: tex, alphaMap: fade, transparent: true, depthWrite: false, roughness: 0.92, metalness: 0 });
    floor = new THREE.Mesh(geo, matl);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, minY - radius * 0.004, center.z);
    floor.receiveShadow = true;
    floor.renderOrder = -1;
    scene.add(floor);
    disposers.push(() => { scene.remove(floor); geo.dispose(); matl.dispose(); tex.dispose(); fade.dispose(); });
  }

  return {
    floor,
    /** 그림자를 만들 물체 (메시) */
    shadowCasters(objects) { (objects || []).forEach((o) => o?.traverse?.((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } })); },
    /** 바닥 높이 다시 맞추기 (분해로 아래로 내려간 부품이 바닥에 묻히지 않게) */
    setFloorY(y) { if (floor) floor.position.y = y - radius * 0.004; },
    dispose() { disposers.reverse().forEach((d) => d()); },
  };
}

/** 배경 (캔버스 뒤 CSS) — 위는 따뜻한 빛, 아래는 매트와 이어지는 회청색 */
export const STAGE_BG = 'radial-gradient(120% 80% at 50% 0%, #fbf7f0 0%, #eef0f3 45%, #dde3ea 100%)';
