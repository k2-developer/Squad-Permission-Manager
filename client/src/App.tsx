import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { PendingCountProvider } from './context/PendingCountContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import RouteTitleSync from './components/RouteTitleSync';

// Public pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// Protected pages
import Dashboard from './pages/Dashboard';
import Whitelist from './pages/Whitelist';
import Approvals from './pages/Approvals';
import Clans from './pages/Clans';
import Groups from './pages/Groups';
import Servers from './pages/Servers';
import UsersPage from './pages/Users';
import Settings from './pages/Settings';
import ApiKeys from './pages/ApiKeys';

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
      <PendingCountProvider>
      <RouteTitleSync />
      <Routes>
        {/* Public routes */}
        <Route path="/welcome" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected routes with layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          {/* Whitelist + Approvals are open to all logged-in users; clan-managers
              see only entries in clans they manage (server-side scoping). */}
          <Route path="/whitelist" element={<Whitelist />} />
          <Route path="/approvals" element={<Approvals />} />
          {/* Clan/Group/Server/User/Setting management is admin-tier only. */}
          <Route
            path="/clans"
            element={
              <ProtectedRoute roles={['owner', 'admin']}>
                <Clans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute roles={['owner', 'admin']}>
                <Groups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/servers"
            element={
              <ProtectedRoute roles={['owner', 'admin']}>
                <Servers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['owner']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={['owner', 'admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-keys"
            element={
              <ProtectedRoute roles={['owner', 'admin']}>
                <ApiKeys />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
      </PendingCountProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
