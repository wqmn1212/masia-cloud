import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const REQUIREMENT_FIELDS = [
  { key: 'goal', label: '제품 목표·기능', placeholder: '무엇을 하는 기기인지, 핵심 기능과 성능 목표' },
  { key: 'use_conditions', label: '사용 조건', placeholder: '사용 환경 온도·습도, 실내/실외, 사용자, 사용 시간' },
  { key: 'power_requirements', label: '전원 요구사항', placeholder: '예: AC 220V 입력, 내부 12V/5V/3.3V, 최대 소비 전력 30W' },
  { key: 'io_requirements', label: '입출력', placeholder: '센서·모터·히터·디스플레이·버튼·통신(Wi-Fi, RS485 등)' },
  { key: 'constraints', label: '제약조건', placeholder: '외형 크기, 목표 원가, 인증(KC·CE), 재질, 생산 수량' },
];

export default function RequirementFields({ value, onChange, disabled }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {REQUIREMENT_FIELDS.map((f) => (
        <div key={f.key} className={`space-y-1.5 ${f.key === 'goal' ? 'md:col-span-2' : ''}`}>
          <Label>{f.label}</Label>
          <Textarea
            rows={3}
            disabled={disabled}
            value={value[f.key] || ''}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}