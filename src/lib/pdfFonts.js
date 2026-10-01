// 한글 텍스트 PDF용 폰트 (jsPDF가 사용된 글자만 서브셋으로 포함)
const FONTS = {
  normal: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf',
  bold: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Bold.ttf',
};
const cache = {};

async function toBinary(url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function loadPdfFonts(pdf) {
  for (const [style, url] of Object.entries(FONTS)) {
    cache[style] = cache[style] || await toBinary(url);
    const file = `NanumGothic-${style}.ttf`;
    pdf.addFileToVFS(file, cache[style]);
    pdf.addFont(file, 'Nanum', style);
  }
  pdf.setFont('Nanum', 'normal');
}

export async function imageToJpeg(url, maxW = 900, crop = null) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
  // crop: 원본 대비 비율 {x,y,w,h} — 여백 제거용
  const sx = crop ? img.width * crop.x : 0, sy = crop ? img.height * crop.y : 0;
  const sw = crop ? img.width * crop.w : img.width, sh = crop ? img.height * crop.h : img.height;
  const scale = Math.min(1, maxW / sw);
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
}