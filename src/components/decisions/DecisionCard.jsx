import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Pencil, Trash2, CornerDownRight } from 'lucide-react';
import { CATEGORY_LABELS, STATUS_META } from './decisionMeta';

export default function DecisionCard({ decision, cardTitle, canEdit, onEdit, onDelete }) {
  const [showAlts, setShowAlts] = useState(false);
  const st = STATUS_META[decision.status] || STATUS_META.CONFIRMED;
  const alts = decision.alternatives || [];

  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{decision.topic}</h3>
            <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[decision.category] || decision.category}</Badge>
            <Badge className={`${st.color} border-0 text-[10px]`}>{st.label}</Badge>
          </div>
          {cardTitle && <p className="text-[11px] text-muted-foreground mt-0.5">📋 {cardTitle}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(decision)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(decision)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        )}
      </div>

      <p className="text-sm mt-2 whitespace-pre-wrap">{decision.decision}</p>
      {decision.rationale && (
        <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">근거: {decision.rationale}</p>
      )}

      {(decision.status === 'REVERSED' || decision.status === 'SUPERSEDED') && decision.reverse_reason && (
        <div className="mt-2 text-xs bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 text-destructive">
          번복 사유: {decision.reverse_reason}
        </div>
      )}

      {alts.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAlts(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {showAlts ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            기각된 대안 {alts.length}건
          </button>
          {showAlts && (
            <div className="mt-2 space-y-2">
              {alts.map((alt, i) => (
                <div key={i} className="text-xs bg-muted/50 rounded-md px-3 py-2">
                  <div className="flex items-start gap-1.5">
                    <CornerDownRight className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium">{alt.option}</p>
                      {alt.reject_reason && <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">기각 사유: {alt.reject_reason}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-2 border-t flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
        {decision.decided_by && <span>결정자 {decision.decided_by}</span>}
        {decision.decided_at && <span>{decision.decided_at}</span>}
        {decision.source_ref && <span>근거 {decision.source_ref}</span>}
        {decision.impact_note && <span>영향 {decision.impact_note}</span>}
      </div>
    </div>
  );
}