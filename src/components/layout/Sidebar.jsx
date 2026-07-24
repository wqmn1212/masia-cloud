import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import {
  LayoutDashboard, Factory, FileText, Shield, Users,
  Clock, Wrench, Package, ChevronLeft, ChevronRight, Cloud, Calculator, ListChecks, Kanban,
  ShieldCheck, UserCog, BarChart3, KeyRound
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canAccessPath } from '@/lib/menuPermissions';

const navSectionDefs = [
  {
    labelKey: 'nav.hq',
    items: [
      { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
      { path: '/quotations', icon: FileText, labelKey: 'nav.quotations' },
      { path: '/financial-report', icon: BarChart3, label: '재무 리포트' },
      { path: '/task-board', icon: Kanban, labelKey: 'nav.taskboard' },
      { path: '/settlement', icon: Calculator, labelKey: 'nav.settlement' },
      { path: '/knowledge', icon: Shield, labelKey: 'nav.knowledge' },
    ]
  },
  {
    labelKey: 'nav.agent',
    items: [
      { path: '/factories', icon: Factory, labelKey: 'nav.factories' },
      { path: '/agent-quotes', icon: Package, labelKey: 'nav.agentquotes' },
      { path: '/requirements', icon: ListChecks, labelKey: 'nav.requirements' },
    ]
  },
  {
    labelKey: 'nav.client',
    items: [
      { path: '/clients', icon: Users, labelKey: 'nav.clients' },
      { path: '/timeline', icon: Clock, labelKey: 'nav.timeline' },
      { path: '/as-requests', icon: Wrench, labelKey: 'nav.asrequests' },
    ]
  }
];

export default function Sidebar({ collapsed, onToggle, user, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { t } = useLanguage();

  // 계정 등급별 후보 메뉴를 만든 뒤 동일한 권한 함수로 최종 필터링
  let navSections = [];
  if (user?.account_tier === 'master') {
    navSections = [{
      label: '관리',
      items: [{ path: '/master-admin', icon: ShieldCheck, label: '마스터 관리자' }],
    }];
  } else if (user?.account_tier === 'service') {
    navSections = navSectionDefs.map((section, index) => index === 0
      ? { ...section, items: [...section.items, { path: '/team', icon: UserCog, label: '팀 관리' }, { path: '/user-permissions', icon: KeyRound, label: '사용자 권한' }] }
      : section);
  } else if (user?.account_tier === 'sub') {
    navSections = navSectionDefs;
  }

  navSections = navSections
    .map(section => ({ ...section, items: section.items.filter(item => canAccessPath(user, item.path)) }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-transform duration-300 flex flex-col",
        collapsed ? "w-[68px]" : "w-[240px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <Cloud className="w-7 h-7 text-sidebar-primary flex-shrink-0" />
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground">{t('brand.name')}</h1>
            <p className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase">Masia Cloud</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-2">
                {section.labelKey ? t(section.labelKey) : section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && (
                      <span className="font-medium truncate">
                        {item.labelKey ? t(item.labelKey) : item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Button */}
      <button
        onClick={onToggle}
        className="h-12 hidden md:flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
    </>
  );
}