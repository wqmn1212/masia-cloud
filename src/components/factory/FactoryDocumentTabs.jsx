import { useEffect, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FactoryDocumentsPanel from '@/components/factory/FactoryDocumentsPanel';

export default function FactoryDocumentTabs({ factory }) {
  const target = useRef(null);
  const selected = new URLSearchParams(window.location.search).get('factoryId') === factory.id;
  useEffect(() => { if (selected) target.current?.scrollIntoView({ block: 'center' }); }, [selected]);
  return <div id={`factory-${factory.id}`} ref={target} className="pt-3 mt-3 border-t">
    <Tabs defaultValue={selected ? 'documents' : ''}>
      <TabsList className="w-full"><TabsTrigger value="documents" className="w-full text-xs">소개 자료</TabsTrigger></TabsList>
      <TabsContent value="documents"><FactoryDocumentsPanel factory={factory} /></TabsContent>
    </Tabs>
  </div>;
}