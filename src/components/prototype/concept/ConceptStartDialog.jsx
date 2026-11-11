import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ConceptStartForm from '@/components/prototype/concept/ConceptStartForm';

export default function ConceptStartDialog({ open, onOpenChange, onCreated }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-title">아이디어로 시제품 컨셉 만들기</DialogTitle>
          <DialogDescription className="text-caption">아이디어를 적으면 AI가 확인할 조건을 묻고, 확인 뒤 미팅용 3D 프리뷰를 만듭니다.</DialogDescription>
        </DialogHeader>
        <ConceptStartForm onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}