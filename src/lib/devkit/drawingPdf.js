// 브라우저에서 도면 SVG 를 A3 PDF 로 (약 180 dpi 이미지, 압축). 한글은 브라우저 글꼴로 그려진다.
import { SHEET } from './drawing.js';

export function svgToCanvas(svg, pxPerMm = 7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = SHEET.w * pxPerMm; c.height = SHEET.h * pxPerMm;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('도면 이미지를 만들지 못했습니다.')); };
    img.src = url;
  });
}

export async function drawingPdfBlob(svg) {
  const { jsPDF } = await import('jspdf');
  const canvas = await svgToCanvas(svg);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  // 흰 바탕 선 도면이라 PNG 를 압축해서 넣는다 (압축하지 않으면 20 MB 넘음)
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, SHEET.w, SHEET.h, undefined, 'FAST');
  return pdf.output('blob');
}
