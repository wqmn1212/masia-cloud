import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { cn } from '@/lib/utils';
import { LanguageProvider } from '@/lib/LanguageContext';
import { SearchProvider } from '@/lib/SearchContext';
import { base44 } from '@/api/base44Client';
import AccountInactive from '@/components/AccountInactive';
import AccessDenied from '@/components/AccessDenied';
import { canAccessPath } from '@/lib/menuPermissions';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [claimChecked, setClaimChecked] = useState(false);
  const location = useLocation();

  const { data: user, refetch, isLoading: isLoadingUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  // 가입 직후 PendingInvitation 자동 적용
  useEffect(() => {
    if (user && !user.account_tier && !claimChecked) {
      setClaimChecked(true);
      base44.functions
        .invoke('claimInvitation', {})
        .then((res) => {
          if (res?.data?.claimed) refetch();
        })
        .catch(() => {});
    }
  }, [user, claimChecked, refetch]);

  // 관리자 권한 변경을 현재 로그인한 팀원 화면에 즉시 반영
  useEffect(() => {
    if (!user?.id) return undefined;
    const unsubscribe = base44.entities.User.subscribe((event) => {
      if (event.id === user.id) refetch();
    });
    return unsubscribe;
  }, [user?.id, refetch]);

  if (isLoadingUser) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">계정 권한을 확인하는 중...</div>;
  }

  // 비활성 계정 차단
  if (user && user.account_tier && user.is_active === false) {
    return <AccountInactive />;
  }

  return (
    <LanguageProvider>
      <SearchProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          user={user}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className={cn(
          "transition-all duration-300",
          collapsed ? "md:ml-[68px]" : "md:ml-[240px]"
        )}>
          <TopBar onMenuClick={() => setMobileOpen(true)} user={user} />
          <main className="p-3 md:p-6">
            {canAccessPath(user, location.pathname) ? <Outlet /> : <AccessDenied />}
          </main>
        </div>
      </div>
      </SearchProvider>
    </LanguageProvider>
  );
}