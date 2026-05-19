import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

export default function RiskAlertPopup({ alerts, open, onClose }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            ⚠️ 나리지 베이스 리스크 경고
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-3">
              {alerts.map((alert, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-semibold text-destructive">{alert.issue_case}</p>
                  <p className="text-xs text-foreground mt-1.5 leading-relaxed">{alert.root_cause}</p>
                  {alert.solution_parameter && (
                    <p className="text-xs text-primary mt-1.5 font-medium">💡 {alert.solution_parameter}</p>
                  )}
                </div>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>확인 및 진행</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}