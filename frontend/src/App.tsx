import React, { Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';

// Lazy-loaded route chunks to minimize initial bundle size and optimize native performance
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const OverviewDashboard = React.lazy(() => import('./pages/dashboard/OverviewDashboard').then(m => ({ default: m.OverviewDashboard })));
const InvoicesPage = React.lazy(() => import('./pages/documents/InvoicesPage').then(m => ({ default: m.InvoicesPage })));
const WaybillsPage = React.lazy(() => import('./pages/documents/WaybillsPage').then(m => ({ default: m.WaybillsPage })));
const LettersPage = React.lazy(() => import('./pages/documents/LettersPage').then(m => ({ default: m.LettersPage })));
const PaymentsPage = React.lazy(() => import('./pages/payments/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const ClientsPage = React.lazy(() => import('./pages/clients/ClientsPage').then(m => ({ default: m.ClientsPage })));
const VendorsPage = React.lazy(() => import('./pages/vendors/VendorsPage').then(m => ({ default: m.VendorsPage })));
const SuppliesPage = React.lazy(() => import('./pages/supplies/SuppliesPage').then(m => ({ default: m.SuppliesPage })));
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditLogsPage = React.lazy(() => import('./pages/settings/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const TemplatesPage = React.lazy(() => import('./pages/settings/TemplatesPage').then(m => ({ default: m.TemplatesPage })));
const CompanySettingsPage = React.lazy(() => import('./pages/settings/CompanySettingsPage').then(m => ({ default: m.CompanySettingsPage })));
const UsersPage = React.lazy(() => import('./pages/settings/UsersPage').then(m => ({ default: m.UsersPage })));
const NotificationsPage = React.lazy(() => import('./pages/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const InvoiceBuilderPage = React.lazy(() => import('./pages/documents/builders/InvoiceBuilderPage').then(m => ({ default: m.InvoiceBuilderPage })));
const WaybillBuilderPage = React.lazy(() => import('./pages/documents/builders/WaybillBuilderPage').then(m => ({ default: m.WaybillBuilderPage })));
const LetterBuilderPage = React.lazy(() => import('./pages/documents/builders/LetterBuilderPage').then(m => ({ default: m.LetterBuilderPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-12 space-y-4">
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-800" />
      <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider animate-pulse">
      Loading Workspace...
    </span>
  </div>
);

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
  const RouterComponent = typeof window !== 'undefined' && window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterComponent>
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Authentication Routes - Redirect directly to Executive Dashboard in Portfolio Demo */}
            <Route path="/login" element={<Navigate to="/overview" replace />} />
            <Route path="/auth/reset-password" element={<Navigate to="/overview" replace />} />
            <Route path="/reset-password" element={<Navigate to="/overview" replace />} />

            {/* Protected Application Routes wrapped in Finnova AppShell */}
            <Route
              element={
                <ProtectedRoute>
                  <ErrorBoundary fallbackTitle="Application Interface Error">
                    <AppShell />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewDashboard />} />
              <Route
                path="/documents/invoices"
                element={
                  <ProtectedRoute requiredPermission="invoice:view">
                    <InvoicesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/invoices/new"
                element={
                  <ProtectedRoute requiredPermission="invoice:create">
                    <InvoiceBuilderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/invoices/:id/edit"
                element={
                  <ProtectedRoute requiredPermission="invoice:update">
                    <InvoiceBuilderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/waybills"
                element={
                  <ProtectedRoute requiredPermission="waybill:view">
                    <WaybillsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/waybills/new"
                element={
                  <ProtectedRoute requiredPermission="waybill:create">
                    <WaybillBuilderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/waybills/:id/edit"
                element={
                  <ProtectedRoute requiredPermission="waybill:update">
                    <WaybillBuilderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/letters"
                element={
                  <ProtectedRoute requiredPermission="letter:view">
                    <LettersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/letters/new"
                element={
                  <ProtectedRoute requiredPermission="letter:create">
                    <LetterBuilderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/letters/:id/edit"
                element={
                  <ProtectedRoute requiredPermission="letter:update">
                    <LetterBuilderPage />
                  </ProtectedRoute>
                }
              />
              {/* Direct Route Aliases */}
              <Route path="/documents" element={<Navigate to="/documents/invoices" replace />} />
              <Route path="/invoices" element={<Navigate to="/documents/invoices" replace />} />
              <Route path="/waybills" element={<Navigate to="/documents/waybills" replace />} />
              <Route path="/letters" element={<Navigate to="/documents/letters" replace />} />
              <Route path="/ledger" element={<Navigate to="/payments" replace />} />
              <Route path="/settings" element={<Navigate to="/settings/company" replace />} />
              <Route path="/settings/audit-logs" element={<Navigate to="/audit-logs" replace />} />
              <Route path="/audit" element={<Navigate to="/audit-logs" replace />} />
              <Route
                path="/payments"
                element={
                  <ProtectedRoute requiredPermission="payment:view">
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute requiredPermission="clients:view">
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendors"
                element={
                  <ProtectedRoute requiredPermission="vendors:view">
                    <VendorsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/supplies"
                element={
                  <ProtectedRoute requiredPermission="supplies:view">
                    <SuppliesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute requiredPermission="reports:view">
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
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
                  <ProtectedRoute>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Suspense>
      </RouterComponent>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
