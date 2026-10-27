import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import ClauseLibraryPanel from '@/components/contract/ClauseLibraryPanel';
import ContractEditor from '@/components/contract/ContractEditor';
import ContractList from '@/components/contract/ContractList';
import SendSignatureDialog from '@/components/contract/esign/SendSignatureDialog';
import SignaturePanel from '@/components/contract/esign/SignaturePanel';
import SignatureSettingsPanel from '@/components/contract/esign/SignatureSettingsPanel';
import { buildStandardContract } from '@/lib/contractTemplate';
import { addEsignClause, buildServiceContract, buildSupplyContract, defaultContractType } from '@/lib/esignContracts';
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
  contract_type: 'SUPPLY',
  client_id: '',
  card_id: '',
  service_agreement_id: '',
};
const TITLE_SUFFIX = { SUPPLY: '제품 공급 계약서', TRIPARTITE: '3자 제조위탁 및 생산관리 계약서', SERVICE: '서비스 이용 계약서', AMENDMENT: '변경 계약서' };

export default function Contracts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const bodyRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 100),
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['contract-quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 100),
  });
  const { data: companies = [] } = useQuery({ queryKey: ['contract-companies'], queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name', 300) });
  const { data: cards = [] } = useQuery({ queryKey: ['contract-cards'], queryFn: () => base44.entities.TaskCard.list('-created_date', 300) });
  const { data: agreements = [] } = useQuery({ queryKey: ['contract-agreements'], queryFn: () => base44.entities.ServiceAgreement.list('-start_date', 100) });

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

  const change = (field, value) => setForm(prev => {
    const next = { ...prev, [field]: value };
    if (field === 'client_id') next.client_name = companies.find((c) => c.id === value)?.company_name || prev.client_name;
    return next;
  });

  const companyOf = (q) => q?.client_id || cards.find((c) => c.id === q?.card_id)?.client_id || '';
  const applyQuotation = (quotationId) => {
    const q = quotations.find(x => x.id === quotationId);
    if (!q) return;
    setForm(prev => {
      const type = prev.body ? prev.contract_type : defaultContractType(q);
      return {
        ...prev,
        quotation_id: q.id,
        contract_type: type,
        client_id: prev.client_id || companyOf(q),
        card_id: prev.card_id || q.card_id || '',
        contract_title: prev.contract_title || `${q.client_name || ''} ${q.quote_title || q.product_name || ''} ${TITLE_SUFFIX[type]}`.trim(),
        client_name: q.client_name || prev.client_name,
        factory_name: q.factory_name || prev.factory_name,
        amount_usd: q.final_price_usd ?? prev.amount_usd,
      };
    });
  };

  // 계약 종류에 맞는 양식으로 초안 본문을 만든다 (공급·구독 양식에는 전자서명 조항이 들어 있다)
  const generateDraft = () => {
    if (form.contract_type === 'SERVICE') {
      const a = agreements.find((x) => x.id === form.service_agreement_id);
      if (!a) return;
      setForm(prev => ({
        ...prev,
        contract_title: prev.contract_title || `${a.company_name || ''} ${TITLE_SUFFIX.SERVICE}`.trim(),
        client_id: prev.client_id || a.company_id || '',
        client_name: prev.client_name || a.company_name || '',
        body: buildServiceContract(a, { clientName: prev.client_name || a.company_name, contractDate: prev.contract_date }),
      }));
      toast({ title: '구독 계약 정보로 계약서 초안을 생성했습니다.' });
      return;
    }
    const q = quotations.find(x => x.id === form.quotation_id);
    if (!q) return;
    setForm(prev => ({
      ...prev,
      contract_title: prev.contract_title || `${q.client_name || ''} ${q.quote_title || q.product_name || ''} ${TITLE_SUFFIX[prev.contract_type] || ''}`.trim(),
      client_name: q.client_name || prev.client_name,
      factory_name: q.factory_name || prev.factory_name,
      amount_usd: q.final_price_usd ?? prev.amount_usd,
      body: prev.contract_type === 'TRIPARTITE' ? buildStandardContract(q, { contractDate: prev.contract_date }) : buildSupplyContract(q, { clientName: q.client_name || prev.client_name, contractDate: prev.contract_date }),
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
    if (['SENT', 'SIGNED'].includes(form.status)) return;
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

  // AI 비서가 만든 초안처럼 본문이 빈 계약서는 열 때 계약 종류에 맞는 양식으로 채운다 (저장은 직원이)
  const templateFor = (c) => {
    if (c.body || !['DRAFT', 'REVIEW'].includes(c.status || 'DRAFT')) return c.body || '';
    if (c.contract_type === 'SERVICE') {
      const a = agreements.find((x) => x.id === c.service_agreement_id);
      return a ? buildServiceContract(a, { clientName: c.client_name || a.company_name, contractDate: c.contract_date }) : '';
    }
    const q = quotations.find((x) => x.id === c.quotation_id);
    if (!q) return '';
    return c.contract_type === 'TRIPARTITE' ? buildStandardContract(q, { contractDate: c.contract_date }) : buildSupplyContract(q, { clientName: c.client_name || q.client_name, contractDate: c.contract_date });
  };

  const selectContract = (c) => {
    const body = templateFor(c);
    if (body && !c.body) toast({ title: '양식으로 본문을 채웠습니다', description: '빈칸을 확인하고 저장하세요.' });
    selectForm({ ...c, body });
  };
  const selectForm = (c) => setForm({
    id: c.id,
    quotation_id: c.quotation_id || '',
    contract_title: c.contract_title || '',
    client_name: c.client_name || '',
    factory_name: c.factory_name || '',
    contract_date: c.contract_date || '',
    amount_usd: c.amount_usd ?? '',
    body: c.body || '',
    status: c.status || 'DRAFT',
    contract_type: c.contract_type || 'SUPPLY',
    client_id: c.client_id || '',
    card_id: c.card_id || '',
    service_agreement_id: c.service_agreement_id || '',
  });

  // 알림 링크(/contracts?contract=ID) 또는 비교표 확정(/contracts?quotation=ID)으로 들어온 경우
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    if (linked || !contracts.length && !quotations.length) return;
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('contract');
    const qid = params.get('quotation');
    if (cid) { const c = contracts.find((x) => x.id === cid); if (c) { selectContract(c); setLinked(true); } }
    else if (qid && quotations.some((q) => q.id === qid)) { applyQuotation(qid); setLinked(true); }
  }, [contracts, quotations, linked]);

  const payload = () => ({
    quotation_id: form.quotation_id || undefined,
    contract_title: form.contract_title,
    client_name: form.client_name,
    factory_name: form.factory_name,
    contract_date: form.contract_date || undefined,
    amount_usd: form.amount_usd === '' ? undefined : Number(form.amount_usd),
    body: form.body,
    status: form.status,
    contract_type: form.contract_type || 'SUPPLY',
    client_id: form.client_id || '',
    card_id: form.card_id || '',
    service_agreement_id: form.service_agreement_id || '',
  });
  const save = () => saveMutation.mutate({ id: form.id, ...payload() });

  // 서명 요청 전에 지금 화면의 본문을 저장해 서버가 같은 본문을 보게 한다
  const requestSign = async () => {
    try {
      await base44.entities.Contract.update(form.id, payload());
      invalidate();
      setSending(true);
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };

  const offlineSigned = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !window.confirm('종이로 서명받은 계약서로 표시할까요? 스캔본을 보관하고 상태를 "체결"로 바꿉니다. 전자서명 기록은 남지 않습니다.')) return;
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        await base44.entities.Contract.update(form.id, { ...payload(), status: 'SIGNED', signed_offline: true, offline_file_uri: file_uri, signed_at: new Date().toISOString() });
        setForm((p) => ({ ...p, status: 'SIGNED' }));
        invalidate();
        toast({ title: '종이 계약 체결로 표시했습니다' });
      } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    };
    input.click();
  };

  const current = contracts.find((c) => c.id === form.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">계약서 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">견적서로 계약서를 만들고, 고객이 포털에서 전자서명하도록 요청합니다. 자주 쓰는 특약은 오른쪽에서 골라 넣습니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ContractEditor
            form={form}
            onChange={change}
            quotations={quotations}
            companies={companies}
            cards={cards}
            agreements={agreements}
            onApplyQuotation={applyQuotation}
            onSave={save}
            onReset={() => setForm(EMPTY_FORM)}
            onGenerate={generateDraft}
            onExportPDF={exportPDF}
            onInsertEsign={() => setForm((p) => ({ ...p, body: addEsignClause(p.body) }))}
            onRequestSign={requestSign}
            onOfflineSigned={offlineSigned}
            isExporting={exporting}
            isPending={saveMutation.isPending}
            bodyRef={bodyRef}
          />
          {current && (current.current_request_id || ['SENT', 'SIGNED'].includes(current.status)) && !current.signed_offline && <SignaturePanel key={current.id} contract={current} />}
          <ContractList
            contracts={contracts}
            onSelect={selectContract}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </div>
        <div className="space-y-4">
          <SignatureSettingsPanel user={user} />
          <ClauseLibraryPanel onInsert={insertClauses} />
        </div>
      </div>
      {sending && current && (
        <SendSignatureDialog
          open={sending}
          onOpenChange={setSending}
          contract={{ ...current, ...payload(), id: form.id }}
          clientName={companies.find((c) => c.id === form.client_id)?.company_name || form.client_name}
          onSent={() => { setForm((p) => ({ ...p, status: 'SENT' })); invalidate(); queryClient.invalidateQueries({ queryKey: ['signature-requests', form.id] }); }}
        />
      )}
    </div>
  );
}
