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

export async function imageToJpeg(url, maxW = 900) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
}