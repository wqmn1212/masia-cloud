import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ClauseLibraryPanel from '@/components/contract/ClauseLibraryPanel';
import ContractEditor from '@/components/contract/ContractEditor';
import ContractList from '@/components/contract/ContractList';
import { buildStandardContract } from '@/lib/contractTemplate';
import { generateContractPDF } from '@/lib/generateContractPDF';

const EMPTY_FORM = {
  id: null,
  quotation_id: '',
  contract_title: '',
  client_name: '',
  factory_name: '',
  contract_date: new Date().toISOString().slice(0, 10),
  amount_usd: '',
  body: '',
  status: 'DRAFT',
};

export default function Contracts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const bodyRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 100),
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['contract-quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 100),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contracts'] });

  const saveMutation = useMutation({
    mutationFn: ({ id, ...data }) => id
      ? base44.entities.Contract.update(id, data)
      : base44.entities.Contract.create(data),
    onSuccess: (saved) => {
      invalidate();
      setForm(prev => ({ ...prev, id: prev.id || saved?.id || null }));
      toast({ title: '계약서를 저장했습니다.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => { invalidate(); setForm(EMPTY_FORM); },
  });

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const applyQuotation = (quotationId) => {
    const q = quotations.find(x => x.id === quotationId);
    if (!q) return;
    setForm(prev => ({
      ...prev,
      quotation_id: q.id,
      contract_title: prev.contract_title || `${q.client_name || ''} ${q.quote_title || q.product_name || ''} 공급계약서`.trim(),
      client_name: q.client_name || prev.client_name,
      factory_name: q.factory_name || prev.factory_name,
      amount_usd: q.final_price_usd ?? prev.amount_usd,
    }));
  };

  // 선택한 견적서 정보로 표준 계약서 초안 본문을 생성
  const generateDraft = () => {
    const q = quotations.find(x => x.id === form.quotation_id);
    if (!q) return;
    setForm(prev => ({
      ...prev,
      contract_title: prev.contract_title || `${q.client_name || ''} ${q.quote_title || q.product_name || ''} 공급계약서`.trim(),
      client_name: q.client_name || prev.client_name,
      factory_name: q.factory_name || prev.factory_name,
      amount_usd: q.final_price_usd ?? prev.amount_usd,
      body: buildStandardContract(q, { contractDate: prev.contract_date }),
    }));
    toast({ title: '견적서 정보로 계약서 초안을 생성했습니다.' });
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      await generateContractPDF(form);
    } finally {
      setExporting(false);
    }
  };

  // 커서 위치에 조항을 삽입 (없으면 본문 끝에 추가)
  const insertClauses = (clauses) => {
    const text = clauses.map(c => `[${c.title}]\n${c.body}`).join('\n\n');
    const el = bodyRef.current;
    setForm(prev => {
      const body = prev.body || '';
      const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : body.length;
      const before = body.slice(0, pos);
      const after = body.slice(pos);
      const sep = before && !before.endsWith('\n') ? '\n\n' : '';
      return { ...prev, body: `${before}${sep}${text}\n\n${after}` };
    });
  };

  const selectContract = (c) => setForm({
    id: c.id,
    quotation_id: c.quotation_id || '',
    contract_title: c.contract_title || '',
    client_name: c.client_name || '',
    factory_name: c.factory_name || '',
    contract_date: c.contract_date || '',
    amount_usd: c.amount_usd ?? '',
    body: c.body || '',
    status: c.status || 'DRAFT',
  });

  const save = () => saveMutation.mutate({
    id: form.id,
    quotation_id: form.quotation_id || undefined,
    contract_title: form.contract_title,
    client_name: form.client_name,
    factory_name: form.factory_name,
    contract_date: form.contract_date || undefined,
    amount_usd: form.amount_usd === '' ? undefined : Number(form.amount_usd),
    body: form.body,
    status: form.status,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">계약서 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">견적서를 기반으로 계약서를 작성하고, 자주 쓰는 특약 조항을 선택해 바로 삽입합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ContractEditor
            form={form}
            onChange={change}
            quotations={quotations}
            onApplyQuotation={applyQuotation}
            onSave={save}
            onReset={() => setForm(EMPTY_FORM)}
            onGenerate={generateDraft}
            onExportPDF={exportPDF}
            isExporting={exporting}
            isPending={saveMutation.isPending}
            bodyRef={bodyRef}
          />
          <ContractList
            contracts={contracts}
            onSelect={selectContract}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </div>
        <ClauseLibraryPanel onInsert={insertClauses} />
      </div>
    </div>
  );
}