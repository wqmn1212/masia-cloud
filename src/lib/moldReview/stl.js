// STL(바이너리·ASCII) 읽기. STL 에는 단위 정보가 없으므로 사용자가 고른 단위를 mm 로 바꿔 준다.

export const STL_UNITS = [
  { value: 'mm', label: 'mm', scale: 1 },
  { value: 'cm', label: 'cm', scale: 10 },
  { value: 'm', label: 'm', scale: 1000 },
  { value: 'inch', label: 'inch', scale: 25.4 },
];

/**
 * @param {ArrayBuffer} buffer
 * @param {number} [scale] mm 로 바꾸는 배율
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function parseStl(buffer, scale = 1) {
  const dv = new DataView(buffer);
  const count = buffer.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  let positions;
  if (count && 84 + count * 50 === buffer.byteLength) {
    positions = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 9; k++) positions[i * 9 + k] = dv.getFloat32(84 + i * 50 + 12 + k * 4, true) * scale;
    }
  } else {
    const text = new TextDecoder().decode(buffer);
    const values = [];
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    let m;
    while ((m = re.exec(text))) values.push(+m[1] * scale, +m[2] * scale, +m[3] * scale);
    if (!values.length) throw new Error('STL 파일을 읽지 못했습니다');
    positions = new Float32Array(values);
  }
  const indices = new Uint32Array(positions.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions, indices };
}
