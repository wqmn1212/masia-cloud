import React from 'react';
import { X } from 'lucide-react';
import { tx } from '@/lib/landingContent';
import InquiryField from './InquiryField';

const L = {
  chip: ['관심 플랜: 엔터프라이즈', 'Plan of interest: Enterprise', '意向方案：企业版'],
  volume: ['예상 월 발주 규모', 'Expected monthly order volume', '预计月订单规模'],
  volumePh: ['예) 월 2억원 / 컨테이너 3대', 'e.g. KRW 200M / 3 containers a month', '例：每月 2 亿韩元 / 3 个集装箱'],
  lines: ['관리할 제품 수', 'Number of products', '管理产品数量'],
  linesPh: ['선택 입력', 'Optional', '可不填'],
};

export default function InquiryInterest({ interest, onClear, values, set, lang }) {
  if (interest !== 'ENTERPRISE') return null;
  return (
    <div className="mb-4">
      <span className="inline-flex items-center gap-1.5 bg-landing-ink text-white text-[12.5px] font-bold pl-3 pr-1.5 py-1.5 rounded-full">
        {tx(L.chip, lang)}
        <button type="button" onClick={onClear} aria-label="remove" className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
        <InquiryField label={tx(L.volume, lang)} placeholder={tx(L.volumePh, lang)} value={values.expected_volume} onChange={set('expected_volume')} />
        <InquiryField label={tx(L.lines, lang)} placeholder={tx(L.linesPh, lang)} value={values.product_lines} onChange={set('product_lines')} type="number" />
      </div>
    </div>
  );
}