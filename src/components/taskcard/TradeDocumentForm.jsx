import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DOCUMENT_TYPES } from '@/components/files/documentTypes';
import CompanyBankDocuments from '@/components/files/CompanyBankDocuments';
export default function TradeDocumentForm({ card, user }) {
  const qc = useQueryClient(), [type, setType] = React.useState('INVOICE_CI'), [folder, setFolder] = React.useState(''), [visible, setVisible] = React.useState(false), [file, setFile] = React.useState(null), fileInput = React.useRef(null);
  const folders = useQuery({ queryKey: ['card_folders', card.id], queryFn: () => base44.entities.CardFolder.filter({ card_id: card.id }) });
  const save = useMutation({ mutationFn: async bank => {
    if (!bank && !file) throw new Error('파일을 선택하세요.');
    const { file_uri } = bank ? { file_uri: bank.file_uri } : await base44.integrations.Core.UploadPrivateFile({ file });
    await base44.entities.CardAttachment.create({ tenant_id: card.tenant_id, card_id: card.id, folder_id: folder, file_name: bank?.file_name || file.name, file_type: bank?.file_type || file.name.split('.').pop().toLowerCase(), file_url: file_uri, document_type: bank ? 'REMITTANCE_ACCOUNT' : type, source_bank_document_id: bank?.id || '', client_visible: visible, uploader_name: user?.full_name || user?.email || '', uploader_role: 'HQ' });
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['card_attachments', card.id] }); qc.invalidateQueries({ queryKey: ['company-files'] }); qc.invalidateQueries({ queryKey: ['client-attachments'] }); qc.invalidateQueries({ queryKey: ['client-shared-files', card.id] }); setFile(null); if (fileInput.current) fileInput.current.value = ''; } });
  const allowed = ['master', 'service', 'sub'].includes(user?.account_tier);
  return <div className="space-y-4"><form className="rounded-xl border bg-muted/20 p-3 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(null); }}><h3 className="text-sm font-semibold">무역서류 업로드</h3>
    <fieldset disabled={!allowed || save.isPending} className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs">문서 유형<select className="w-full h-9 rounded-md border bg-background px-2 mt-1" value={type} onChange={e => setType(e.target.value)}>{Object.entries(DOCUMENT_TYPES).filter(([key]) => key !== 'GENERAL').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs">보관 폴더<select className="w-full h-9 rounded-md border bg-background px-2 mt-1" value={folder} onChange={e => setFolder(e.target.value)}><option value="">루트</option>{(folders.data || []).map(f => <option key={f.id} value={f.id}>{f.folder_name}</option>)}</select></label></div>
    <Input ref={fileInput} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />고객에게 공개 (카드도 공개되어야 함)</label>
    <div className="flex justify-end"><Button type="submit" disabled={!file || !allowed || save.isPending}>{save.isPending ? '저장 중...' : '서류 업로드'}</Button></div></fieldset>
    {save.isError && <p role="alert" className="text-xs text-destructive">{save.error?.response?.data?.error || save.error.message}</p>}{save.isSuccess && <p className="text-xs text-primary">카드 파일 보관함에 저장했습니다.</p>}
    <p className="text-xs text-muted-foreground">무역서류는 일반 파일과 같은 보관함에 저장됩니다. 새 폴더는 파일 탭에서 만들 수 있습니다.</p>
  </form>{allowed && <CompanyBankDocuments companyId={card.client_id} onUse={bank => save.mutate(bank)} busy={save.isPending} />}</div>;
}