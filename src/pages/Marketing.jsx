import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingCalendar from '@/components/marketing/MarketingCalendar';
import PostEditor from '@/components/marketing/PostEditor';
import PerformancePanel from '@/components/marketing/PerformancePanel';
import AttributionPanel from '@/components/marketing/AttributionPanel';
import ConnectionSettings from '@/components/marketing/ConnectionSettings';

export default function Marketing() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('calendar');
  const [editing, setEditing] = useState(null);
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['marketingPosts'],
    queryFn: () => base44.entities.MarketingPost.list('-created_date', 500),
  });

  const open = (post) => { setEditing(post || {}); setTab('editor'); };
  const refresh = () => qc.invalidateQueries({ queryKey: ['marketingPosts'] });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header>
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Marketing</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">마케팅 관리</h1>
        <p className="text-sm text-muted-foreground mt-2">기본 게시 일정 월·수·금 10:00 KST · 게시 전 대표님 승인 필수</p>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
          <TabsTrigger value="editor">게시물 편집</TabsTrigger>
          <TabsTrigger value="performance">성과</TabsTrigger>
          <TabsTrigger value="attribution">유입 분석</TabsTrigger>
          <TabsTrigger value="connections">연결 설정</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-6">
          <MarketingCalendar posts={posts} loading={isLoading} onOpen={open} />
        </TabsContent>
        <TabsContent value="editor" className="mt-6">
          <PostEditor key={editing?.id || 'new'} post={editing || {}} user={user}
            onSaved={(p) => { setEditing(p); refresh(); }} onNew={() => setEditing({})} />
        </TabsContent>
        <TabsContent value="performance" className="mt-6"><PerformancePanel posts={posts} /></TabsContent>
        <TabsContent value="attribution" className="mt-6"><AttributionPanel /></TabsContent>
        <TabsContent value="connections" className="mt-6"><ConnectionSettings user={user} /></TabsContent>
      </Tabs>
    </div>
  );
}