import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useFactoryDocuments(factory) {
  const qc = useQueryClient();
  const key = ['factory-documents', factory.id];
  const { data: user } = useQuery({ queryKey: ['document-user'], queryFn: () => base44.auth.me() });
  const query = useQuery({ queryKey: key, queryFn: () => base44.entities.FactoryDocument.filter({ company_id: factory.id, tenant_id: factory.tenant_id }, 'sort_order', 1000) });
  useEffect(() => base44.entities.FactoryDocument.subscribe(() => qc.invalidateQueries({ queryKey: ['factory-documents'] })), [qc]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['factory-documents'] }); qc.invalidateQueries({ queryKey: ['card-factory-documents'] }); qc.invalidateQueries({ queryKey: ['client-shared-files'] }); };
  const mutation = useMutation({
    mutationFn: async ({ action, doc, files, direction }) => {
      if (action === 'upload' || action === 'replace') {
        let order = Math.max(0, ...(query.data || []).map(d => Number(d.sort_order) || 0)) + 1;
        for (const file of files) {
          const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
          const values = { file_name: file.name, file_type: file.name.split('.').pop().toLowerCase(), file_url: file_uri, uploader_name: user.full_name || '' };
          if (action === 'replace') await base44.entities.FactoryDocument.update(doc.id, values);
          else await base44.entities.FactoryDocument.create({ ...values, tenant_id: factory.tenant_id, company_id: factory.id, sort_order: order++, client_visible: false, created_by_name: user.full_name || '' });
        }
      } else if (action === 'visibility') await base44.entities.FactoryDocument.update(doc.id, { client_visible: !doc.client_visible });
      else if (action === 'delete') await base44.entities.FactoryDocument.delete(doc.id);
      else if (action === 'move') {
        const ordered = [...(query.data || [])];
        const index = ordered.findIndex(d => d.id === doc.id), target = index + direction;
        if (target < 0 || target >= ordered.length) return;
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        await base44.entities.FactoryDocument.bulkUpdate(ordered.map((d, i) => ({ id: d.id, sort_order: i })));
      }
    },
    onSettled: refresh,
  });
  const sameTenant = !!factory.tenant_id && user?.tenant_id === factory.tenant_id;
  return { ...query, documents: query.data || [], mutation, canUpload: sameTenant && ['master', 'service', 'sub'].includes(user?.account_tier), canManage: user?.account_tier === 'master' || (sameTenant && user?.account_tier === 'service') };
}