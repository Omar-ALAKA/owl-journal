// App.tsx — Root avec QueryClient amélioré + Toast + ErrorBoundary
import { Suspense, lazy, Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { Sidebar } from './components/layout/sidebar';

// Lazy load all routes for code splitting
const DashboardPage = lazy(() => import('./routes/index').then(m => ({ default: m.DashboardPage })));
const TradesPage = lazy(() => import('./routes/trades').then(m => ({ default: m.TradesPage })));
const ChallengePage = lazy(() => import('./routes/challenge').then(m => ({ default: m.ChallengePage })));
const JournalPage = lazy(() => import('./routes/journal').then(m => ({ default: m.JournalPage })));
const HistoryPage = lazy(() => import('./routes/history').then(m => ({ default: m.HistoryPage })));
const CalendarPage = lazy(() => import('./routes/calendar').then(m => ({ default: m.CalendarPage })));
const StrategiesPage = lazy(() => import('./routes/strategies').then(m => ({ default: m.StrategiesPage })));
const AnalyticsPage = lazy(() => import('./routes/analytics').then(m => ({ default: m.AnalyticsPage })));
const AccountsPage = lazy(() => import('./routes/accounts').then(m => ({ default: m.AccountsPage })));
const ImportPage = lazy(() => import('./routes/import').then(m => ({ default: m.ImportPage })));
const SettingsPage = lazy(() => import('./routes/settings').then(m => ({ default: m.SettingsPage })));
const SessionsPage = lazy(() => import('./routes/sessions').then(m => ({ default: m.SessionsPage })));
const FundedPage = lazy(() => import('./routes/funded').then(m => ({ default: m.FundedPage })));

// Error Boundary
interface EBProps { children: ReactNode; }
interface EBState { hasError: boolean; error: Error | null; }
export class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: unknown) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#7B8498', marginBottom: 20, maxWidth: 400 }}>An unexpected error occurred. Please refresh the page.</p>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Page loader
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-acc)', borderRadius: '50%' }} />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#141828',
                color: '#F1F5F9',
                border: '1px solid #252840',
                borderRadius: '10px',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#22C55E', secondary: '#141828' }},
              error: { iconTheme: { primary: '#EF4444', secondary: '#141828' }},
            }}
          />
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/trades" element={<TradesPage />} />
                  <Route path="/challenge" element={<ChallengePage />} />
                  <Route path="/journal" element={<JournalPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/strategies" element={<StrategiesPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/funded" element={<FundedPage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
