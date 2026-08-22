import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 계약서 본문(텍스트)을 A4 다중 페이지 PDF 로 저장
export async function generateContractPDF(contract) {
  const PAGE_W = 794;
  const PAGE_H = Math.round((PAGE_W * 297) / 210);
  const PAD = 56;
  const USABLE = PAGE_H - PAD * 2;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;';
  document.body.appendChild(container);

  const measure = document.createElement('div');
  measure.style.cssText = `width:${PAGE_W - PAD * 2}px;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:12px;line-height:1.7;color:#0f172a;`;
  measure.innerHTML = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:20px;font-weight:800;letter-spacing:2px;">${esc(contract.contract_title)}</div>
      <div style="font-size:10px;color:#64748b;margin-top:6px;">
        ${esc(contract.client_name || '')}${contract.contract_date ? ` · ${esc(contract.contract_date)}` : ''}${contract.amount_usd ? ` · USD ${Number(contract.amount_usd).toLocaleString()}` : ''}
      </div>
    </div>
    ${String(contract.body || '').split('\n').map(line =>
      `<div style="min-height:14px;white-space:pre-wrap;">${esc(line)}</div>`
    ).join('')}
  `;
  container.appendChild(measure);

  try {
    await new Promise((r) => setTimeout(r, 60));
    const blocks = Array.from(measure.children);
    const pages = [[]];
    let used = 0;
    for (const block of blocks) {
      const h = block.offsetHeight;
      if (used + h > USABLE && pages[pages.length - 1].length > 0) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(block);
      used += h;
    }

    const pageDivs = pages.map((list) => {
      const page = document.createElement('div');
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px;box-sizing:border-box;background:#fff;overflow:hidden;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:12px;line-height:1.7;color:#0f172a;`;
      list.forEach((b) => page.appendChild(b));
      container.appendChild(page);
      return page;
    });
    measure.remove();

    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < pageDivs.length; i++) {
      const canvas = await html2canvas(pageDivs[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }

    const safe = (s) => String(s || '').replace(/[^\w\u3131-\uD79D一-龥]+/g, '_').slice(0, 40);
    pdf.save(`Contract_${safe(contract.contract_title || contract.client_name) || 'draft'}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}