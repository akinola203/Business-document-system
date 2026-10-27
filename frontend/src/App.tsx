import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { OverviewDashboard } from './pages/dashboard/OverviewDashboard';
import { InvoicesPage } from './pages/documents/InvoicesPage';
import { WaybillsPage } from './pages/documents/WaybillsPage';
import { LettersPage } from './pages/documents/LettersPage';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { ClientsPage } from './pages/clients/ClientsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { AuditLogsPage } from './pages/settings/AuditLogsPage';
import { TemplatesPage } from './pages/settings/TemplatesPage';
import { CompanySettingsPage } from './pages/settings/CompanySettingsPage';
import { UsersPage } from './pages/settings/UsersPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000, // 30 seconds cache
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes wrapped in Finnova AppShell */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewDashboard />} />
            <Route path="/documents/invoices" element={<InvoicesPage />} />
            <Route path="/documents/waybills" element={<WaybillsPage />} />
            <Route path="/documents/letters" element={<LettersPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/settings/templates" element={<TemplatesPage />} />
            <Route path="/settings/company" element={<CompanySettingsPage />} />
            <Route
              path="/settings/users"
              element={
                <ProtectedRoute requiredPermission="users:view">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
