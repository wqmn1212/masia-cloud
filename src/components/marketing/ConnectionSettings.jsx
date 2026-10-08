import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { PLATFORMS } from './marketingMeta';

export default function ConnectionSettings({ user }) {
  const qc = useQueryClient();
  const isCeo = user?.account_tier === 'master';
  const { data: conns = [] } = useQuery({ queryKey: ['socialConnections'], queryFn: () => base44.entities.SocialConnection.list() });

  const saveField = async (platform, field, value) => {
    const existing = conns.find((c) => c.platform === platform);
    if (existing) await base44.entities.SocialConnection.update(existing.id, { [field]: value });
    else await base44.entities.SocialConnection.create({ platform, tenant_id: user?.tenant_id, status: 'manual', [field]: value });
    qc.invalidateQueries({ queryKey: ['socialConnections'] });
  };

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {Object.entries(PLATFORMS).map(([pl, label]) => {
        const c = conns.find((x) => x.platform === pl) || {};
        return (
          <div key={pl} className="rounded-2xl border bg-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{label}</h3>
              <span className="text-xs rounded px-2 py-1 bg-muted text-muted-foreground">수동 게시 모드</span>
            </div>
            <Input placeholder="계정명 / 핸들" defaultValue={c.account_name} disabled={!isCeo} onBlur={(e) => e.target.value !== (c.account_name || '') && saveField(pl, 'account_name', e.target.value)} />
            <Input placeholder="계정 URL" defaultValue={c.account_url} disabled={!isCeo} onBlur={(e) => e.target.value !== (c.account_url || '') && saveField(pl, 'account_url', e.target.value)} />
            <p className="text-xs text-muted-foreground">{isCeo ? '자동 연결(OAuth)과 자동 게시는 다음 단계에서 제공됩니다.' : '계정 연결 관리는 대표님만 가능합니다.'}</p>
          </div>
        );
      })}
    </div>
  );
}