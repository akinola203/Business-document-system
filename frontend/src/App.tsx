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
import { VendorsPage } from './pages/vendors/VendorsPage';
import { SuppliesPage } from './pages/supplies/SuppliesPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { AuditLogsPage } from './pages/settings/AuditLogsPage';
import { TemplatesPage } from './pages/settings/TemplatesPage';
import { CompanySettingsPage } from './pages/settings/CompanySettingsPage';
import { UsersPage } from './pages/settings/UsersPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { InvoiceBuilderPage } from './pages/documents/builders/InvoiceBuilderPage';
import { WaybillBuilderPage } from './pages/documents/builders/WaybillBuilderPage';
import { LetterBuilderPage } from './pages/documents/builders/LetterBuilderPage';

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
            <Route path="/documents/invoices/new" element={<InvoiceBuilderPage />} />
            <Route path="/documents/invoices/:id/edit" element={<InvoiceBuilderPage />} />
            <Route path="/documents/waybills" element={<WaybillsPage />} />
            <Route path="/documents/waybills/new" element={<WaybillBuilderPage />} />
            <Route path="/documents/waybills/:id/edit" element={<WaybillBuilderPage />} />
            <Route path="/documents/letters" element={<LettersPage />} />
            <Route path="/documents/letters/new" element={<LetterBuilderPage />} />
            <Route path="/documents/letters/:id/edit" element={<LetterBuilderPage />} />
            {/* Direct Route Aliases */}
            <Route path="/invoices" element={<Navigate to="/documents/invoices" replace />} />
            <Route path="/waybills" element={<Navigate to="/documents/waybills" replace />} />
            <Route path="/letters" element={<Navigate to="/documents/letters" replace />} />
            <Route path="/ledger" element={<Navigate to="/payments" replace />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/supplies" element={<SuppliesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute requiredPermission="audit:view">
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/templates"
              element={
                <ProtectedRoute requiredPermission="settings:manage">
                  <TemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/company"
              element={
                <ProtectedRoute requiredPermission="settings:manage">
                  <CompanySettingsPage />
                </ProtectedRoute>
              }
            />
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
