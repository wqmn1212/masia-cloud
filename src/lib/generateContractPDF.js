import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ARTICLE = /^제\s?\d+조/;
const ANNEX = /^\[별첨/;
const CLAUSE_NO = /^[①②③④⑤⑥⑦⑧⑨⑩]/;
const SUB_ITEM = /^\s+\d+\./;
const SIGN = /\(서명\/인\)/;

// 계약서 본문 한 줄을 문서 스타일 HTML 블록으로 변환
function renderLine(line) {
  const text = esc(line.trim());
  if (!line.trim()) return '<div style="height:9px;"></div>';
  if (ARTICLE.test(line)) {
    return `<div style="margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;font-size:12.5px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">${text}</div>`;
  }
  if (ANNEX.test(line) || line.trim() === '특약 사항') {
    return `<div style="margin:18px 0 6px;font-size:12px;font-weight:700;color:#2563eb;">${text}</div>`;
  }
  if (CLAUSE_NO.test(line)) {
    return `<div style="margin:3px 0;padding-left:2px;text-indent:-2px;font-size:11px;line-height:1.75;color:#1e2a3b;">${text}</div>`;
  }
  if (SUB_ITEM.test(line)) {
    return `<div style="margin:2px 0 2px 18px;font-size:10.5px;line-height:1.7;color:#475569;">${text}</div>`;
  }
  if (SIGN.test(line)) {
    return `<div style="margin:8px 0;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#0f172a;">${text}</div>`;
  }
  return `<div style="margin:3px 0;font-size:11px;line-height:1.75;color:#1e2a3b;">${text}</div>`;
}

export async function generateContractPDF(contract) {
  const PAGE_W = 794;
  const PAGE_H = Math.round((PAGE_W * 297) / 210);
  const PAD = 56;
  const USABLE = PAGE_H - PAD * 2;

  const lines = String(contract.body || '').split('\n');
  const [titleLine, ...rest] = lines;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;';
  document.body.appendChild(container);

  const measure = document.createElement('div');
  measure.style.cssText = `width:${PAGE_W - PAD * 2}px;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#0f172a;`;
  measure.innerHTML = `
    <div style="margin-bottom:22px;padding-bottom:14px;border-bottom:2px solid #2563eb;text-align:center;">
      <div style="font-size:19px;font-weight:800;letter-spacing:4px;color:#0f172a;">${esc(titleLine || contract.contract_title)}</div>
      <div style="margin-top:8px;font-size:10px;color:#64748b;letter-spacing:0.5px;">
        ${esc(contract.client_name || '')}${contract.contract_date ? ` · ${esc(contract.contract_date)}` : ''}${contract.amount_usd ? ` · USD ${Number(contract.amount_usd).toLocaleString()}` : ''}
      </div>
    </div>
    ${rest.map(renderLine).join('')}
  `;
  container.appendChild(measure);

  try {
    await new Promise((r) => setTimeout(r, 60));
    const blocks = Array.from(measure.children);
    const pages = [[]];
    let used = 0;
    for (const block of blocks) {
      const style = window.getComputedStyle(block);
      const h = block.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      if (used + h > USABLE && pages[pages.length - 1].length > 0) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(block);
      used += h;
    }

    const pageDivs = pages.map((list, idx) => {
      const page = document.createElement('div');
      page.style.cssText = `position:relative;width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px;box-sizing:border-box;background:#fff;overflow:hidden;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;`;
      list.forEach((b) => page.appendChild(b));
      const footer = document.createElement('div');
      footer.style.cssText = 'position:absolute;left:56px;right:56px;bottom:24px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;';
      footer.innerHTML = `<span>${esc(contract.contract_title || '')}</span><span>${idx + 1} / ${pages.length}</span>`;
      page.appendChild(footer);
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