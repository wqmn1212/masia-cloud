import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Factory, FileText, Shield, Users,
  Clock, Wrench, Package, ChevronLeft, ChevronRight, Cloud, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navSections = [
  {
    label: '본사 관리',
    items: [
      { path: '/', icon: LayoutDashboard, label: '대시보드' },
      { path: '/quotations', icon: FileText, label: '견적 관리' },
      { path: '/settlement', icon: Calculator, label: '정산 대시보드' },
      { path: '/knowledge', icon: Shield, label: '나리지 베이스' },
    ]
  },
  {
    label: '에이전트',
    items: [
      { path: '/factories', icon: Factory, label: '공장 관리' },
      { path: '/agent-quotes', icon: Package, label: '견적 업로드' },
    ]
  },
  {
    label: '고객사',
    items: [
      { path: '/clients', icon: Users, label: '고객사 관리' },
      { path: '/timeline', icon: Clock, label: '생산 타임라인' },
      { path: '/as-requests', icon: Wrench, label: 'AS 접수' },
    ]
  }
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <Cloud className="w-7 h-7 text-sidebar-primary flex-shrink-0" />
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground">마시아 클라우드</h1>
            <p className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase">Masir Cloud</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-2">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && <span className="font-medium truncate">{item.label}</span>}
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
        className="h-12 flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}