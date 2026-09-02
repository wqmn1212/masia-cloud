import React from 'react';

const inputCls =
  'border border-landing-line3 rounded-[9px] px-[13px] py-[11px] text-[14.5px] outline-none bg-landing-input text-landing-ink placeholder:text-landing-muted3 focus:border-landing-brand focus:bg-white transition-colors w-full';

export default function InquiryField({ label, textarea = false, ...props }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-landing-ink2">{label}</span>
      {textarea ? (
        <textarea rows={4} className={`${inputCls} resize-y leading-[1.6]`} {...props} />
      ) : (
        <input className={inputCls} {...props} />
      )}
    </label>
  );
}