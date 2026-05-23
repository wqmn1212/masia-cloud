import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Building2, MapPin, Users, Phone, Mail, Loader2, Inbox, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import TaskCardSummaryItem from '@/components/taskcard/TaskCardSummaryItem';
import CardModal from '@/components/taskcard/CardModal';

const STATUS_FILTERS = [
  { key: 'ALL',         label: '전체' },
  { key: 'TODO',        label: '대기' },
  { key: 'IN_PROGRESS', label: '진행중' },
  { key: 'REVIEW',      label: '검토' },
  { key: 'PRODUCTION',  label: '생산' },
  { key: 'DONE',        label: '완료' },
];

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [selectedCard, setSelectedCard] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // 고객사 프로필
  const { data: clients = [], isLoading: loadingClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => base44.entities.Company.filter({ id: clientId }),
    enabled: !!clientId,
  });
  const client = clients[0];

  // 이 고객사에 연결된 태스크 카드
  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['client-taskcards', clientId],
    queryFn: () => base44.entities.TaskCard.filter({ client_id: clientId }, '-created_date'),
    enabled: !!clientId,
  });

  const cardIds = cards.map(c => c.id);
  const hasCards = cardIds.length > 0;

  // 카드별 통계 데이터 (한 번에 가져와 클라이언트 그룹핑)
  const { data: attachments = [] } = useQuery({
    queryKey: ['client-attachments', clientId],
    queryFn: () => base44.entities.CardAttachment.list('-created_date', 1000),
    enabled: hasCards,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['client-quotations', clientId],
    queryFn: () => base44.entities.Quotation.list('-created_date', 1000),
    enabled: hasCards,
  });

  const { data: taskItems = [] } = useQuery({
    queryKey: ['client-taskitems', clientId],
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

  // 통합 통계
  const totalFiles = attachments.filter(a => cardIds.includes(a.card_id)).length;
  const totalQuotations = quotations.filter(q => cardIds.includes(q.card_id)).length;
  const totalTasks = taskItems.filter(t => cardIds.includes(t.card_id)).length;

  const filteredCards = statusFilter === 'ALL'
    ? cards
    : cards.filter(c => c.status === statusFilter);

  if (loadingClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clients"><ArrowLeft className="w-4 h-4 mr-1" />고객사 목록</Link>
        </Button>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">고객사를 찾을 수 없습니다.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/clients"><ArrowLeft className="w-4 h-4 mr-1" />고객사 목록</Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{client.company_name}</h1>
                  <Badge variant="secondary" className="text-[10px]">고객사</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                  {client.address && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  )}
                  {client.contact_person && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{client.contact_person}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 통합 통계 */}
            {hasCards && (
              <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t">
                <StatBox label="태스크 카드" value={cards.length} />
                <StatBox label="견적" value={totalQuotations} />
                <StatBox label="첨부 파일" value={totalFiles} />
                <StatBox label="세부 업무" value={totalTasks} />
              </div>
            )}
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
            태스크 보드에서 이 고객사를 지정한 카드를 만들면 여기에 나타납니다
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map(card => (
            <TaskCardSummaryItem
              key={card.id}
              card={card}
              counts={counts[card.id]}
              onClick={() => setSelectedCard(card)}
              secondaryText={card.factory_name}
              secondaryIcon={Factory}
            />
          ))}
        </div>
      )}

      <CardModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}