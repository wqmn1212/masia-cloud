import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Factory, MapPin, Users, Phone, Mail, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import FactoryTaskCardItem from '@/components/factory/FactoryTaskCardItem';
import CardModal from '@/components/taskcard/CardModal';

const STATUS_FILTERS = [
  { key: 'ALL',         label: '전체' },
  { key: 'TODO',        label: '대기' },
  { key: 'IN_PROGRESS', label: '진행중' },
  { key: 'REVIEW',      label: '검토' },
  { key: 'PRODUCTION',  label: '생산' },
  { key: 'DONE',        label: '완료' },
];

export default function FactoryDashboard() {
  const { factoryId } = useParams();
  const [selectedCard, setSelectedCard] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // 공장 프로필
  const { data: factories = [], isLoading: loadingFactory } = useQuery({
    queryKey: ['factory', factoryId],
    queryFn: () => base44.entities.Company.filter({ id: factoryId }),
    enabled: !!factoryId,
  });
  const factory = factories[0];

  // 이 공장에 연결된 태스크 카드
  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['factory-taskcards', factoryId],
    queryFn: () => base44.entities.TaskCard.filter({ factory_id: factoryId }, '-created_date'),
    enabled: !!factoryId,
  });

  const cardIds = cards.map(c => c.id);
  const hasCards = cardIds.length > 0;

  // 카드별 요약 통계용 데이터 (한번에 가져와서 클라이언트 그룹핑)
  const { data: attachments = [] } = useQuery({
    queryKey: ['factory-attachments', factoryId],
    queryFn: () => base44.entities.CardAttachment.list('-created_date', 1000),
    enabled: hasCards,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['factory-quotations', factoryId],
    queryFn: () => base44.entities.Quotation.list('-created_date', 1000),
    enabled: hasCards,
  });

  const { data: taskItems = [] } = useQuery({
    queryKey: ['factory-taskitems', factoryId],
    queryFn: () => base44.entities.TaskItem.list('-created_date', 1000),
    enabled: hasCards,
  });

  const counts = useMemo(() => {
    const map = {};
    cardIds.forEach(id => { map[id] = { files: 0, quotations: 0, tasks: 0, doneTasks: 0 }; });
    attachments.forEach(a => { if (map[a.card_id]) map[a.card_id].files++; });
    quotations.forEach(q => { if (map[q.card_id]) map[q.card_id].quotations++; });
    taskItems.forEach(t => {
      if (map[t.card_id]) {
        map[t.card_id].tasks++;
        if (t.status === 'DONE') map[t.card_id].doneTasks++;
      }
    });
    return map;
  }, [cardIds, attachments, quotations, taskItems]);

  const statusCounts = useMemo(() => {
    const c = { ALL: cards.length, TODO: 0, IN_PROGRESS: 0, REVIEW: 0, PRODUCTION: 0, DONE: 0 };
    cards.forEach(card => {
      if (c[card.status] !== undefined) c[card.status]++;
    });
    return c;
  }, [cards]);

  const filteredCards = statusFilter === 'ALL'
    ? cards
    : cards.filter(c => c.status === statusFilter);

  if (loadingFactory) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!factory) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/factories"><ArrowLeft className="w-4 h-4 mr-1" />공장 목록</Link>
        </Button>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">공장을 찾을 수 없습니다.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/factories"><ArrowLeft className="w-4 h-4 mr-1" />공장 목록</Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Factory className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{factory.company_name}</h1>
                  <Badge variant="secondary" className="text-[10px]">공장</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                  {factory.factory_address && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{factory.factory_address}</span>
                    </div>
                  )}
                  {factory.contact_person && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {factory.contact_person}
                        {factory.wechat_id && ` · WeChat ${factory.wechat_id}`}
                      </span>
                    </div>
                  )}
                  {factory.phone && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{factory.phone}</span>
                    </div>
                  )}
                  {factory.email && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{factory.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card hover:bg-accent text-muted-foreground border-border'
            }`}
          >
            {f.label}
            <span className="ml-1 opacity-70">({statusCounts[f.key] || 0})</span>
          </button>
        ))}
      </div>

      {/* Task cards grid */}
      {loadingCards ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
        </div>
      ) : filteredCards.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">
            {statusFilter === 'ALL' ? '연결된 태스크가 없습니다' : '해당 상태의 태스크가 없습니다'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            태스크 보드에서 이 공장을 지정한 카드를 만들면 여기에 나타납니다
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map(card => (
            <FactoryTaskCardItem
              key={card.id}
              card={card}
              counts={counts[card.id]}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      {/* Card detail modal */}
      <CardModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}