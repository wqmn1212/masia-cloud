import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import {
  LayoutDashboard, Factory, FileText, Shield, Users,
  Clock, Wrench, Package, ChevronLeft, ChevronRight, ChevronDown, Cloud, Calculator, ListChecks, Kanban,
  ShieldCheck, ClipboardCheck, UserCog, BarChart3, KeyRound, Bot, FolderOpen, FileSignature, BookMarked, Boxes, Inbox, Images, BookOpen, Megaphone, CalendarOff, ScanSearch, Palette, Handshake, Ship, ScanBarcode, Cpu, CircuitBoard, Layers, Archive, Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canAccessPath, CLIENT_MENU_OPTIONS } from '@/lib/menuPermissions';
import { getViewCompanyId, isDemoView } from '@/lib/clientView';

const CLIENT_ICONS = { '/client/dashboard': LayoutDashboard, '/client/board': Kanban, '/client/documents': FolderOpen, '/client/team': Users, '/client/mold-review': ScanSearch, '/client/costs': Calculator, '/client/landed-cost': Ship, '/client/molds': Boxes, '/client/guide': BookOpen };

// 직원 메뉴: 자주 쓰는 메뉴는 항상 펼치고, 나머지는 업무 단계별 묶음으로 접어 둔다 (메뉴 항목은 하나도 빼지 않는다)
const STAFF_GROUPS = [
  {
    key: 'daily', labelKey: 'nav.g.daily', pinned: true,
    items: [
      { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
      { path: '/my-work', icon: ListChecks, labelKey: 'nav.myWork' },
      { path: '/task-board', icon: Kanban, labelKey: 'nav.taskboard' },
      { path: '/admin-inbox', icon: ClipboardCheck, labelKey: 'nav.adminInbox', tiers: ['master', 'service'] },
      { path: '/assistant', icon: Bot, labelKey: 'nav.assistant' },
    ],
  },
  {
    key: 'sales', labelKey: 'nav.g.sales',
    items: [
      { path: '/leads', icon: Inbox, labelKey: 'nav.leads' },
      { path: '/sales', icon: Briefcase, labelKey: 'nav.sales' },
      { path: '/clients', icon: Users, labelKey: 'nav.clients' },
      { path: '/quotations', icon: FileText, labelKey: 'nav.quotations' },
      { path: '/agent-quotes', icon: Package, labelKey: 'nav.agentquotes' },
      { path: '/contracts', icon: FileSignature, labelKey: 'nav.contracts' },
      { path: '/agreements', icon: Handshake, labelKey: 'nav.agreements' },
      { path: '/portfolio-admin', icon: Images, labelKey: 'nav.portfolio' },
      { path: '/marketing', icon: Megaphone, labelKey: 'nav.marketing' },
    ],
  },
  {
    key: 'project', labelKey: 'nav.g.project',
    items: [
      { path: '/requirements', icon: ListChecks, labelKey: 'nav.requirements' },
      { path: '/timeline', icon: Clock, labelKey: 'nav.timeline' },
      { path: '/decisions', icon: BookMarked, labelKey: 'nav.decisions' },
      { path: '/file-center', icon: FolderOpen, labelKey: 'nav.files' },
      { path: '/knowledge', icon: Shield, labelKey: 'nav.knowledge' },
      { path: '/china-holidays', icon: CalendarOff, labelKey: 'nav.chinaHolidays' },
    ],
  },
  {
    key: 'dev', labelKey: 'nav.g.dev',
    items: [
      { path: '/prototypes', icon: Cpu, labelKey: 'nav.prototypes' },
      { path: '/circuit-lab', icon: CircuitBoard, labelKey: 'nav.circuitLab' },
      { path: '/pcb-studio', icon: Layers, labelKey: 'nav.pcbStudio' },
      { path: '/bom-extractor', icon: Boxes, labelKey: 'nav.bom' },
      { path: '/mold-review', icon: ScanSearch, labelKey: 'nav.moldReview' },
      { path: '/design-archive', icon: Archive, labelKey: 'nav.designArchive', tiers: ['master', 'service'] },
      { path: '/artcraft', icon: Palette, labelKey: 'nav.artcraft' },
    ],
  },
  {
    key: 'quality', labelKey: 'nav.g.quality',
    items: [
      { path: '/factories', icon: Factory, labelKey: 'nav.factories' },
      { path: '/serials', icon: ScanBarcode, labelKey: 'nav.serials' },
      { path: '/as-requests', icon: Wrench, labelKey: 'nav.asrequests' },
    ],
  },
  {
    key: 'finance', labelKey: 'nav.g.finance',
    items: [
      { path: '/settlement', icon: Calculator, labelKey: 'nav.settlement' },
      { path: '/financial-report', icon: BarChart3, labelKey: 'nav.financial' },
      { path: '/logistics-rates', icon: Ship, labelKey: 'nav.logisticsRates' },
    ],
  },
  {
    key: 'settings', labelKey: 'nav.g.settings',
    items: [
      { path: '/master-admin', icon: ShieldCheck, labelKey: 'nav.masterAdmin', tiers: ['master'] },
      { path: '/team', icon: UserCog, labelKey: 'nav.team', tiers: ['service'] },
      { path: '/user-permissions', icon: KeyRound, labelKey: 'nav.permissions', tiers: ['service'] },
      { path: '/user-guide', icon: BookOpen, labelKey: 'nav.userGuide' },
      { path: '/service-guide', icon: BookMarked, labelKey: 'nav.serviceGuide' },
    ],
  },
];

const OPEN_KEY = 'masia.nav.open';
const readOpen = () => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch { return {}; } };
const writeOpen = (v) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } };
const isActivePath = (path, pathname) => pathname === path || pathname.startsWith(`${path}/`);

export default function Sidebar({ collapsed, onToggle, user, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { t } = useLanguage();

  const [open, setOpen] = React.useState(readOpen);
  const toggleGroup = (key) => setOpen(prev => { const next = { ...prev, [key]: !prev[key] }; writeOpen(next); return next; });

  // 계정 등급별 후보 메뉴를 만든 뒤 동일한 권한 함수로 최종 필터링
  const tier = user?.account_tier;
  let navSections = [];
  if (['master', 'service', 'sub'].includes(tier)) {
    navSections = STAFF_GROUPS.map(group => ({ ...group, items: group.items.filter(item => !item.tiers || item.tiers.includes(tier)) }));
  } else if (tier === 'client') {
    navSections = [{
      labelKey: 'nav.clientPortal', pinned: true,
      items: CLIENT_MENU_OPTIONS.map(item => ({ ...item, icon: CLIENT_ICONS[item.path] || LayoutDashboard })),
    }];
  }

  // 직원이 고객 포털을 열람하는 중이면 고객 메뉴를 보여 준다 (마스터: 모든 고객사, 팀 관리자·팀원: 데모 고객사만)
  const staff = ['master', 'service', 'sub'].includes(user?.account_tier);
  const viewing = staff && location.pathname.startsWith('/client/') && !!getViewCompanyId() && (user?.account_tier === 'master' || isDemoView());
  if (viewing) {
    navSections = [{
      label: isDemoView() ? '데모 고객 포털' : '고객 포털 미리보기', pinned: true,
      items: CLIENT_MENU_OPTIONS.map(item => ({ ...item, icon: CLIENT_ICONS[item.path] || LayoutDashboard })),
    }];
  } else {
    navSections = navSections
      .map(section => ({ ...section, items: section.items.filter(item => canAccessPath(user, item.path)) }))
      .filter(section => section.items.length > 0);
  }

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
            <h1 className="text-title font-bold tracking-tight text-sidebar-foreground">{t('brand.name')}</h1>
            <p className="text-micro text-sidebar-foreground/50 tracking-widest uppercase">AEGIS Cloud</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => {
          const sectionKey = section.key || section.labelKey || section.label;
          const title = section.labelKey ? t(section.labelKey) : section.label;
          const hasActive = section.items.some(item => isActivePath(item.path, location.pathname));
          // 접힌 사이드바(아이콘만)에서는 묶음 없이 모두 보여 준다
          const expanded = collapsed || section.pinned || hasActive || !!open[sectionKey];
          return (
            <div key={sectionKey} className={collapsed ? 'mb-3' : 'mb-2'}>
              {!collapsed && (section.pinned ? (
                <p className="text-micro font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-2">{title}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(sectionKey)}
                  aria-expanded={expanded}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-micro font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  <span className="truncate">{title}</span>
                  <span className="flex items-center gap-1.5 normal-case tracking-normal">
                    {!expanded && <span className="text-sidebar-foreground/40">{section.items.length}</span>}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded ? '' : '-rotate-90')} />
                  </span>
                </button>
              ))}
              {expanded && (
                <div className={cn('space-y-0.5', !collapsed && !section.pinned && 'mt-1')}>
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={onMobileClose}
                        title={collapsed ? (item.labelKey ? t(item.labelKey) : item.label) : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-label transition-all duration-200",
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
              )}
            </div>
          );
        })}
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