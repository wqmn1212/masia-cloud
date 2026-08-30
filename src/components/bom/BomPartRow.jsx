import React from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BomPartThumbnail from '@/components/bom/BomPartThumbnail';
import { MATERIAL_OPTIONS } from '@/lib/materialGuess';

const num = (v, digits = 2) => (v == null ? '-' : Number(v).toFixed(digits));

export default function BomPartRow({ part, onChange }) {
  const set = (patch) => onChange({ ...part, ...patch });

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="p-2">
        <BomPartThumbnail mesh={part.mesh} />
      </td>
      <td className="p-2">
        <Input
          value={part.display_name || ''}
          onChange={(e) => set({ display_name: e.target.value })}
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[180px]">{part.part_name}</p>
      </td>
      <td className="p-2 text-right text-xs tabular-nums">{num(part.volume_cm3, 3)}</td>
      <td className="p-2 text-right text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {num(part.bbox_x_mm, 1)} × {num(part.bbox_y_mm, 1)} × {num(part.bbox_z_mm, 1)}
      </td>
      <td className="p-2">
        <Select
          value={part.material || ''}
          onValueChange={(material) => {
            const found = MATERIAL_OPTIONS.find((m) => m.material === material);
            set({ material, density: found?.density ?? part.density, material_confirmed: true });
          }}
        >
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue placeholder="재질" /></SelectTrigger>
          <SelectContent>
            {MATERIAL_OPTIONS.map((m) => (
              <SelectItem key={m.material} value={m.material}>{m.material}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!part.material_confirmed && (
          <Badge variant="destructive" className="mt-1 text-[9px] px-1.5 py-0">미확정</Badge>
        )}
      </td>
      <td className="p-2 text-right text-xs tabular-nums">{num(part.weight_g, 2)}</td>
      <td className="p-2">
        <Input
          type="number"
          min={1}
          value={part.cavity_count ?? ''}
          onChange={(e) => set({ cavity_count: Number(e.target.value) })}
          className="h-8 text-xs w-[60px] text-right"
        />
      </td>
      <td className="p-2 text-right text-xs tabular-nums">{num(part.cycle_time_sec, 1)}</td>
      <td className="p-2 text-[11px] text-muted-foreground">{part.machine_class}</td>
      <td className="p-2">
        <Input
          type="number"
          min={1}
          value={part.quantity ?? 1}
          onChange={(e) => set({ quantity: Number(e.target.value) })}
          className="h-8 text-xs w-[60px] text-right"
        />
      </td>
      <td className="p-2 text-center">
        <Checkbox
          checked={!!part.is_purchased}
          onCheckedChange={(v) => set({ is_purchased: !!v })}
        />
      </td>
    </tr>
  );
}