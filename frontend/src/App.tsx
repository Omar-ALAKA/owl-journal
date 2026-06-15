// App.tsx - Root Component with React Router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, Component, type ReactNode } from 'react';
import { Sidebar } from './components/layout/sidebar';
import { DashboardPage } from './routes/index';
import { TradesPage } from './routes/trades';
import { ChallengePage } from './routes/challenge';
import { JournalPage } from './routes/journal';
import { HistoryPage } from './routes/history';
import { CalendarPage } from './routes/calendar';
import { StrategiesPage } from './routes/strategies';
import { AnalyticsPage } from './routes/analytics';
import { AccountsPage } from './routes/accounts';
import { ImportPage } from './routes/import';
import { SettingsPage } from './routes/settings';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ color: '#7B8498', marginBottom: '20px', maxWidth: '400px' }}>
            An unexpected error occurred. Please refresh the page or contact the administrator.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
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
                <Route path="/import" element={<ImportPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
