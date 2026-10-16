import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { appParams } from '@/lib/app-params';
import { getHomePath } from '@/lib/menuPermissions';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthRedirect from '@/components/auth/AuthRedirect';

import Landing from '@/pages/Landing';
import PortfolioDetail from '@/pages/PortfolioDetail';
import PortfolioList from '@/pages/PortfolioList';
import About from '@/pages/About';
import Pricing from '@/pages/Pricing';
import Cloud from '@/pages/Cloud';
import JoinSetPassword from '@/pages/JoinSetPassword';

// 공개 페이지(랜딩·소개·요금·포트폴리오)만 첫 파일에 넣고, 로그인 후 화면은 열 때 따로 불러온다.
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Factories = lazy(() => import('@/pages/Factories'));
const Clients = lazy(() => import('@/pages/Clients'));
const Quotations = lazy(() => import('@/pages/Quotations'));
const AgentQuotes = lazy(() => import('@/pages/AgentQuotes'));
const Knowledge = lazy(() => import('@/pages/Knowledge'));
const Timeline = lazy(() => import('@/pages/Timeline'));
const ASRequests = lazy(() => import('@/pages/ASRequests'));
const Settlement = lazy(() => import('@/pages/Settlement'));
const Requirements = lazy(() => import('@/pages/Requirements'));
const TaskBoard = lazy(() => import('@/pages/TaskBoard'));
const FactoryDashboard = lazy(() => import('@/pages/FactoryDashboard'));
const ClientDashboard = lazy(() => import('@/pages/ClientDashboard'));
const MasterAdminDashboard = lazy(() => import('@/pages/MasterAdminDashboard'));
const TeamManagement = lazy(() => import('@/pages/TeamManagement'));
const UserPermissions = lazy(() => import('@/pages/UserPermissions'));
const FinancialReport = lazy(() => import('@/pages/FinancialReport'));
const MasterTeamDashboard = lazy(() => import('@/pages/MasterTeamDashboard'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const FileCenter = lazy(() => import('@/pages/FileCenter'));
const Contracts = lazy(() => import('@/pages/Contracts'));
const Decisions = lazy(() => import('@/pages/Decisions'));
const BomExtractor = lazy(() => import('@/pages/BomExtractor'));
const MoldReview = lazy(() => import('@/pages/MoldReview'));
const ArtCraft = lazy(() => import('@/pages/ArtCraft'));
const Leads = lazy(() => import('@/pages/Leads'));
const ClientPortalDashboard = lazy(() => import('@/pages/ClientPortalDashboard'));
const ClientBoard = lazy(() => import('@/pages/ClientBoard'));
const PortfolioAdmin = lazy(() => import('@/pages/PortfolioAdmin'));
const JoinInvite = lazy(() => import('@/pages/JoinInvite'));
const ServiceGuide = lazy(() => import('@/pages/ServiceGuide'));
const ClientGuide = lazy(() => import('@/pages/ClientGuide'));
const Marketing = lazy(() => import('@/pages/Marketing'));
const ChinaHolidays = lazy(() => import('@/pages/ChinaHolidays'));
const MyWork = lazy(() => import('@/pages/MyWork'));
const UserGuide = lazy(() => import('@/pages/UserGuide'));

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, onboardingPath, completeOnboarding, retryInvitation } = useAuth();
  const location = useLocation();
  const isRoot = location.pathname === '/';

  // 공개 포트폴리오 상세 — 비로그인 접근 허용
  if (location.pathname === '/about') return <About />;
  if (location.pathname === '/pricing') return <Pricing />;
  if (location.pathname === '/cloud') return <Cloud />;
  if (location.pathname === '/cloud-guide') return <Navigate to="/cloud" replace />;
  if (location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/')) {
    return (
      <Routes>
        <Route path="/portfolio" element={<PortfolioList />} />
        <Route path="/portfolio/:slug" element={<PortfolioDetail />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Spinner />;
  }

  // 초대 참여 링크 — 로그인 전이면 비밀번호 설정 화면을 바로 띄운다.
  if (location.pathname === '/join' && !isAuthenticated) return <JoinSetPassword />;

  if (authError) {
    if (authError.type === 'auth_required') return <AuthRedirect />;
    return <UserNotRegisteredError message={authError.message} onRetry={retryInvitation} />;
  }

  // Do not mount protected pages before auth and invitation assignment finish.
  // 초대 참여 링크(?join=1)로 들어오면 랜딩 대신 로그인/가입 화면을 먼저 띄운다.
  const joinEntry = new URLSearchParams(location.search).has('join');
  // 초대 메일 버튼으로 들어오면 홈 대신 비밀번호 설정 화면을 띄운다.
  if (!isAuthenticated && appParams.invitationEntry) return <JoinSetPassword />;
  if (!isAuthenticated && (appParams.invitationEntry || joinEntry || !isRoot)) return <AuthRedirect />;
  if (onboardingPath) return <AuthRedirect to={onboardingPath} onComplete={completeOnboarding} />;
  if (isAuthenticated && !user?.account_tier) return <UserNotRegisteredError />;

  // 로그인 상태에서도 메인(랜딩) 페이지 열람
  if (location.pathname === '/main') return <Landing />;

  if (isRoot) {
    if (isAuthenticated && user) return <Navigate to={getHomePath(user)} replace />;
    return <Landing />;
  }

  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/join" element={<JoinInvite />} />
      <Route element={<AppLayout />}>
        {/* 고객 포털 — 내부 관리 화면과 라우트 단위로 분리 */}
        <Route path="/client/dashboard" element={<ClientPortalDashboard />} />
        <Route path="/client/board" element={<ClientBoard />} />
        <Route path="/client/guide" element={<ClientGuide />} />
        <Route path="/client/mold-review" element={<MoldReview />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/service-guide" element={<ServiceGuide />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/user-guide" element={<UserGuide />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/china-holidays" element={<ChinaHolidays />} />
        <Route path="/portfolio-admin" element={<PortfolioAdmin />} />
        <Route path="/factories" element={<Factories />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/agent-quotes" element={<AgentQuotes />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/as-requests" element={<ASRequests />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/requirements" element={<Requirements />} />
        <Route path="/task-board" element={<TaskBoard />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/file-center" element={<FileCenter />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/decisions" element={<Decisions />} />
        <Route path="/bom-extractor" element={<BomExtractor />} />
        <Route path="/mold-review" element={<MoldReview />} />
        <Route path="/artcraft" element={<ArtCraft />} />
        <Route path="/factories/:factoryId/dashboard" element={<FactoryDashboard />} />
        <Route path="/clients/:clientId/dashboard" element={<ClientDashboard />} />
        <Route path="/master-admin" element={<MasterAdminDashboard />} />
        <Route path="/master-admin/teams/:tenantId" element={<MasterTeamDashboard />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/user-permissions" element={<UserPermissions />} />
        <Route path="/financial-report" element={<FinancialReport />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App