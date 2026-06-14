// App.tsx - Root Component with React Router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
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
  );
}
