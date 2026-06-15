// routes/import.tsx
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { previewImport, confirmImport, fetchAccounts } from '../lib/api';
import type { ImportPreview, Account } from '../types';
import { Upload, FileText, Check, AlertTriangle, X } from 'lucide-react';

export function ImportPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; inserted: number; errors: unknown[] } | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<Set<number>>(new Set());

  const { data: accountsData, isLoading: accountsLoading, error: accountsError } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });
  const accounts: Account[] = accountsData?.accounts || [];

  if (accountsLoading) {
    return (
      <div className="page">
        <div className="page-header"><h1>Import Trades</h1></div>
        <div className="empty-state"><p>Loading accounts...</p></div>
      </div>
    );
  }

  if (accountsError) {
    return (
      <div className="page">
        <div className="page-header"><h1>Import Trades</h1></div>
        <div className="empty-state">
          <AlertTriangle size={40} color="var(--color-red)" style={{ marginBottom: '12px' }} />
          <p>Error loading accounts. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><h1>Import Trades</h1></div>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <AlertTriangle size={40} color="var(--color-accent)" style={{ marginBottom: '12px' }} />
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>No accounts available</p>
          <p className="text-muted" style={{ fontSize: '14px' }}>You need to create an account first before importing trades.</p>
        </div>
      </div>
    );
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await previewImport(file, selectedAccountId);
      setPreview(result);
      setSelectedTrades(new Set(result.trades.map((_, i) => i)));
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      alert(msg);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const tradesToImport = preview.trades.filter((_, i) => selectedTrades.has(i));
      const result = await confirmImport(tradesToImport, selectedAccountId!);
      setImportResult(result);
      setStep('result');
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['equity-curve'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      alert(msg);
    } finally {
      setImporting(false);
    }
  };

  const toggleTrade = (idx: number) => {
    const next = new Set(selectedTrades);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelectedTrades(next);
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selectedTrades.size === preview.trades.length) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(preview.trades.map((_, i) => i)));
    }
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Import Trades</h1></div>

      {step === 'upload' && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Target Account</label>
            <select className="form-select" value={selectedAccountId || ''} onChange={e => setSelectedAccountId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Select account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.broker})</option>)}
            </select>
          </div>

          <div className="upload-zone" onClick={() => fileRef.current?.click()}>
            <Upload size={40} style={{ marginBottom: '12px', color: 'var(--color-accent)' }} />
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>Drop your file here or click to browse</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Supports CSV, XLSX from FTMO, MyFundedFX, Equity Edge, and more</div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">File</div>
              <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> {preview.filename}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Format</div>
              <div className="kpi-value" style={{ fontSize: '16px' }}>{preview.detected_format}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Trades Found</div>
              <div className="kpi-value">{preview.total_trades}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Est. P&L</div>
              <div className={`kpi-value ${preview.stats.total_profit >= 0 ? 'green' : 'red'}`}>
                {preview.stats.total_profit >= 0 ? '+' : ''}${preview.stats.total_profit.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
              {selectedTrades.size === preview.trades.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-muted" style={{ fontSize: '13px', alignSelf: 'center' }}>
              {selectedTrades.size} of {preview.trades.length} selected
            </span>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="trade-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selectedTrades.size === preview.trades.length} onChange={toggleAll} /></th>
                  <th>Symbol</th>
                  <th>Dir</th>
                  <th>Volume</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P&L</th>
                  <th>Session</th>
                  <th>Setup</th>
                </tr>
              </thead>
              <tbody>
                {preview.trades.map((t, i) => (
                  <tr key={i} style={{ opacity: selectedTrades.has(i) ? 1 : 0.4 }}>
                    <td><input type="checkbox" checked={selectedTrades.has(i)} onChange={() => toggleTrade(i)} /></td>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td className={t.direction === 'long' ? 'text-green' : 'text-red'}>{t.direction === 'long' ? '▲' : '▼'}</td>
                    <td>{t.volume}</td>
                    <td>{t.entry_price}</td>
                    <td>{t.exit_price || '-'}</td>
                    <td className={(t.profit || 0) >= 0 ? 'text-green' : 'text-red'}>
                      {(t.profit || 0) >= 0 ? '+' : ''}${(t.profit || 0).toFixed(2)}
                    </td>
                    <td>{t.session || '-'}</td>
                    <td className="text-muted">{t.setup || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button className="btn btn-secondary" onClick={() => { setStep('upload'); setPreview(null); }}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={importing || selectedTrades.size === 0 || !selectedAccountId}
            >
              {importing ? 'Importing...' : `Import ${selectedTrades.size} Trades`}
            </button>
          </div>
        </>
      )}

      {step === 'result' && importResult && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          {importResult.inserted > 0 ? (
            <>
              <Check size={48} color="var(--color-green)" style={{ marginBottom: '16px' }} />
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>{importResult.message}</div>
              <div className="text-muted">{importResult.errors.length} errors</div>
            </>
          ) : (
            <>
              <AlertTriangle size={48} color="var(--color-red)" style={{ marginBottom: '16px' }} />
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>Import failed</div>
            </>
          )}
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => { setStep('upload'); setPreview(null); setImportResult(null); }}>
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
