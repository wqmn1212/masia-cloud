import React, { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuotationHistoryPanel from '@/components/quotation/QuotationHistoryPanel';

export default function QuotationHistoryButton({ quotation }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}><History />수정 이력</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>견적 수정 이력 · {quotation.quote_title || quotation.factory_name}</DialogTitle></DialogHeader>
        {open && <QuotationHistoryPanel quotationId={quotation.id} />}
      </DialogContent>
    </Dialog>
  </>;
}