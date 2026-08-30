// 삼각 메시 기하 계산 — 부피 / bbox / 투영면적
// occt-import-js 는 B-rep 이 아닌 삼각 메시를 반환하므로
// 부피는 폐쇄 메시의 부호 있는 사면체 부피 합으로 계산한다.
//   V = Σ (v0 · (v1 × v2)) / 6
// 곡면이 다각형으로 근사되어 0.5~2% 오차가 발생한다.

/**
 * 부호 있는 사면체 부피 합 (mm³)
 * @param {Float32Array|number[]} positions - [x,y,z, x,y,z, ...] (mm)
 * @param {Uint32Array|number[]} indices - 삼각형 인덱스
 */
export function computeSignedVolumeMm3(positions, indices) {
  let total = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;

    const x0 = positions[a], y0 = positions[a + 1], z0 = positions[a + 2];
    const x1 = positions[b], y1 = positions[b + 1], z1 = positions[b + 2];
    const x2 = positions[c], y2 = positions[c + 1], z2 = positions[c + 2];

    // v0 · (v1 × v2)
    const cx = y1 * z2 - z1 * y2;
    const cy = z1 * x2 - x1 * z2;
    const cz = x1 * y2 - y1 * x2;

    total += (x0 * cx + y0 * cy + z0 * cz) / 6;
  }
  return Math.abs(total);
}

/** 부피 (cm³) */
export function computeVolumeCm3(positions, indices) {
  return computeSignedVolumeMm3(positions, indices) / 1000;
}

/** 외곽 치수 (mm) */
export function computeBoundingBox(positions) {
  if (!positions || positions.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const v = positions[i + axis];
      if (v < min[axis]) min[axis] = v;
      if (v > max[axis]) max[axis] = v;
    }
  }

  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

/**
 * 축 평면별 투영면적 (cm²)
 * 삼각형을 각 평면에 투영해 면적을 합산한 뒤 절반(앞/뒤 중복 제거)한다.
 */
export function computeProjectedAreas(positions, indices) {
  let areaXY = 0;
  let areaYZ = 0;
  let areaXZ = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;

    const x0 = positions[a], y0 = positions[a + 1], z0 = positions[a + 2];
    const x1 = positions[b], y1 = positions[b + 1], z1 = positions[b + 2];
    const x2 = positions[c], y2 = positions[c + 1], z2 = positions[c + 2];

    areaXY += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
    areaYZ += Math.abs((y1 - y0) * (z2 - z0) - (y2 - y0) * (z1 - z0)) / 2;
    areaXZ += Math.abs((x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0)) / 2;
  }

  // mm² → cm², 앞뒤 중복 제거를 위해 1/2
  const toCm2 = (mm2) => mm2 / 2 / 100;

  const xy = toCm2(areaXY);
  const yz = toCm2(areaYZ);
  const xz = toCm2(areaXZ);

  return { xy, yz, xz, max: Math.max(xy, yz, xz) };
}

/** 메시 하나에 대한 전체 기하 지표 */
export function analyzeMesh(positions, indices) {
  const bbox = computeBoundingBox(positions);
  const projected = computeProjectedAreas(positions, indices);
  return {
    volume_cm3: computeVolumeCm3(positions, indices),
    bbox_x_mm: bbox.size[0],
    bbox_y_mm: bbox.size[1],
    bbox_z_mm: bbox.size[2],
    projected_area_cm2: projected.max,
    triangle_count: indices.length / 3,
  };
}