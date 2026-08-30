import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Boxes } from 'lucide-react';
import { parseStepFileFromFile } from '@/lib/stepParser';
import { guessMaterial, computeWeightG } from '@/lib/materialGuess';
import { estimateMoldParams } from '@/lib/moldEstimate';
import BomUploadZone from '@/components/bom/BomUploadZone';
import BomPartTable from '@/components/bom/BomPartTable';
import BomSaveBar from '@/components/bom/BomSaveBar';

const PHASE_LABEL = {
  parsing: 'STEP 형상 읽는 중...',
  analyzing: '부품별 부피 · 치수 계산 중...',
};

export default function BomExtractor() {
  const { user } = useAuth();
  const [parts, setParts] = useState([]);
  const [sourceFile, setSourceFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('parsing');
  const [elapsedMs, setElapsedMs] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFile = async (file) => {
    setIsParsing(true);
    setProgress(0);
    setParts([]);
    setElapsedMs(null);

    try {
      const { parts: rawParts, elapsed_ms } = await parseStepFileFromFile(file, {
        onProgress: ({ phase: p, percent }) => {
          setPhase(p);
          setProgress(percent);
        },
      });

      const enriched = rawParts.map((p) => {
        const guess = guessMaterial(p.part_name);
        const weight_g = computeWeightG(p.volume_cm3, guess.density);
        return {
          ...p,
          display_name: p.part_name,
          quantity: 1,
          material: guess.material,
          density: guess.density,
          material_confirmed: false,
          is_purchased: guess.is_purchased,
          insert_count: 0,
          finish: 'RAW',
          weight_g,
          ...estimateMoldParams({ ...p, weight_g }),
        };
      });

      setParts(enriched);
      setSourceFile(file);
      setElapsedMs(elapsed_ms);
      toast({ title: `${enriched.length}개 부품 추출 완료`, description: `파싱 소요 ${(elapsed_ms / 1000).toFixed(1)}초` });
    } catch (error) {
      toast({ title: 'STEP 파싱 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const handlePartChange = (index, next) => {
    setParts((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      const weight_g = computeWeightG(next.volume_cm3, next.density);
      return { ...next, weight_g, ...estimateMoldParams({ ...next, weight_g }), cavity_count: next.cavity_count };
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const bomSetId = `BOM-${Date.now()}`;
      const uploaded = await base44.integrations.Core.UploadFile({ file: sourceFile });

      await base44.entities.BomItem.bulkCreate(parts.map((p) => ({
        tenant_id: user?.tenant_id,
        bom_set_id: bomSetId,
        source_file_url: uploaded.file_url,
        source_file_name: sourceFile?.name,
        part_name: p.part_name,
        display_name: p.display_name,
        quantity: p.quantity || 1,
        volume_cm3: p.volume_cm3,
        bbox_x_mm: p.bbox_x_mm,
        bbox_y_mm: p.bbox_y_mm,
        bbox_z_mm: p.bbox_z_mm,
        projected_area_cm2: p.projected_area_cm2,
        material: p.material,
        material_confirmed: !!p.material_confirmed,
        density: p.density,
        weight_g: p.weight_g,
        finish: p.finish || 'RAW',
        insert_count: p.insert_count || 0,
        cavity_count: p.cavity_count,
        cycle_time_sec: p.cycle_time_sec,
        machine_class: p.machine_class,
        is_purchased: !!p.is_purchased,
      })));

      toast({ title: 'BOM 저장 완료', description: `${parts.length}개 부품 · ${bomSetId}` });
    } catch (error) {
      toast({ title: 'BOM 저장 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const unconfirmedCount = parts.filter((p) => !p.is_purchased && !p.material_confirmed).length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">STEP 도면 분석 · BOM 추출</h1>
          <p className="text-xs text-muted-foreground">
            STEP 파일에서 부품별 부피 · 외곽 치수를 추출하고 재질을 확정합니다
          </p>
        </div>
      </div>

      <BomUploadZone
        onFile={handleFile}
        isParsing={isParsing}
        progress={progress}
        phaseLabel={PHASE_LABEL[phase]}
      />

      {parts.length > 0 && (
        <>
          {elapsedMs != null && (
            <p className="text-xs text-muted-foreground">
              {sourceFile?.name} · {parts.length}개 부품 · 파싱 {(elapsedMs / 1000).toFixed(1)}초
            </p>
          )}
          <BomPartTable parts={parts} onPartChange={handlePartChange} />
          <BomSaveBar
            parts={parts}
            unconfirmedCount={unconfirmedCount}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </>
      )}
    </div>
  );
}