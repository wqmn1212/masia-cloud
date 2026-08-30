import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Save, Loader2 } from 'lucide-react';

export default function BomSaveBar({ parts, unconfirmedCount, onSave, isSaving }) {
  const injectionParts = parts.filter((p) => !p.is_purchased);
  const totalWeight = injectionParts.reduce((sum, p) => sum + (p.weight_g || 0) * (p.quantity || 1), 0);

  return (
    <div className="border rounded-xl p-4 bg-card flex flex-col md:flex-row md:items-center gap-4 justify-between">
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          총 <strong className="text-foreground">{parts.length}</strong>개 부품 ·
          사출 대상 <strong className="text-foreground">{injectionParts.length}</strong>개 ·
          구매품 {parts.length - injectionParts.length}개
        </p>
        <p>사출 대상 총 중량 <strong className="text-foreground">{totalWeight.toFixed(1)}g</strong></p>
      </div>

      <div className="flex items-center gap-3">
        {unconfirmedCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4" />
            재질 미확정 {unconfirmedCount}개 — 견적 생성 불가
          </div>
        )}
        <Button onClick={onSave} disabled={isSaving || parts.length === 0}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          BOM 저장
        </Button>
      </div>
    </div>
  );
}