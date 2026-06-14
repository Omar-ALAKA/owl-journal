// routes/trades.tsx
import { get } from '../lib/api';
import type { Trade } from '../types';
import { useQuery } from '@tanstack/react-query';

export function TradesPage() {
  const { data } = useQuery({
    queryKey: ['trades'],
    queryFn: () => get<{ trades: Trade[] }>('/trades', { limit: 100 }).catch(() => ({ trades: [] })),
  });

  const trades = data?.trades || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Trades</h1>
        <button className="btn btn-primary">+ Add Trade</button>
      </div>
      {trades.length === 0 ? (
        <div className="empty-state">
          <p>No trades yet. Import your first CSV/XLSX file!</p>
        </div>
      ) : (
        <table className="trade-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Symbol</th>
              <th>Dir</th>
              <th>P/L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td>#{t.id}</td>
                <td>{t.open_time?.split(' ')[0]}</td>
                <td>{t.symbol}</td>
                <td className={t.direction === 'long' ? 'text-green' : 'text-red'}>
                  {t.direction === 'long' ? '▲' : '▼'} {t.direction}
                </td>
                <td className={t.profit >= 0 ? 'text-green' : 'text-red'}>
                  {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
