import React from 'react';
import TradeDocumentForm from '@/components/taskcard/TradeDocumentForm';
import FilesTab from '@/components/taskcard/FilesTab';
export default function TradeDocumentsTab({ card, user }) {
  return <div className="space-y-5"><TradeDocumentForm card={card} user={user} /><h3 className="text-sm font-semibold">무역서류 보관함</h3><FilesTab card={card} tradeOnly /></div>;
}