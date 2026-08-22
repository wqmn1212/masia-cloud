import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Factories from '@/pages/Factories';
import Clients from '@/pages/Clients';
import Quotations from '@/pages/Quotations';
import AgentQuotes from '@/pages/AgentQuotes';
import Knowledge from '@/pages/Knowledge';
import Timeline from '@/pages/Timeline';
import ASRequests from '@/pages/ASRequests';
import Settlement from '@/pages/Settlement';
import Requirements from '@/pages/Requirements';
import TaskBoard from '@/pages/TaskBoard';
import FactoryDashboard from '@/pages/FactoryDashboard';
import ClientDashboard from '@/pages/ClientDashboard';
import MasterAdminDashboard from '@/pages/MasterAdminDashboard';
import TeamManagement from '@/pages/TeamManagement';
import UserPermissions from '@/pages/UserPermissions';
import FinancialReport from '@/pages/FinancialReport';
import MasterTeamDashboard from '@/pages/MasterTeamDashboard';
import Assistant from '@/pages/Assistant';
import FileCenter from '@/pages/FileCenter';
import Contracts from '@/pages/Contracts';
import Decisions from '@/pages/Decisions';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
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