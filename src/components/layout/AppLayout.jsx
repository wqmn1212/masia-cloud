import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { cn } from '@/lib/utils';
import { LanguageProvider } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import AccountInactive from '@/components/AccountInactive';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [claimChecked, setClaimChecked] = useState(false);

  const { data: user, refetch } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
    retry: false,
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

  // 비활성 계정 차단
  if (user && user.account_tier && user.is_active === false) {
    return <AccountInactive />;
  }

  return (
    <LanguageProvider>
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
          <TopBar onMenuClick={() => setMobileOpen(true)} />
          <main className="p-3 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </LanguageProvider>
  );
}