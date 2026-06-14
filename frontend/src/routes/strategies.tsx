// routes/strategies.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStrategies, createStrategy, updateStrategy, deleteStrategy } from '../lib/api';
import type { Strategy } from '../types';
import { Plus, Edit2, Trash2, X, Target } from 'lucide-react';

export function StrategiesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => fetchStrategies().catch(() => ({ strategies: [] })),
  });
  const strategies: Strategy[] = data?.strategies || [];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [form, setForm] = useState({ name: '', description: '', rules: '{}' });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', rules: '{}' });
    setShowModal(true);
  };

  const openEdit = (s: Strategy) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', rules: JSON.stringify(s.rules || {}, null, 2) });
    setShowModal(true);
  };

  const handleSave = async () => {
    let parsedRules = {};
    try { parsedRules = JSON.parse(form.rules); } catch { alert('Invalid JSON in rules'); return; }
    if (editing) {
      await updateStrategy(editing.id, { ...form, rules: parsedRules });
    } else {
      await createStrategy({ ...form, rules: parsedRules });
    }
    qc.invalidateQueries({ queryKey: ['strategies'] });
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this strategy?')) return;
    await deleteStrategy(id);
    qc.invalidateQueries({ queryKey: ['strategies'] });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Strategies</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New Strategy</button>
      </div>

      {isLoading ? <p className="text-muted">Loading...</p> : strategies.length === 0 ? (
        <div className="empty-state">
          <Target size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p>No strategies yet. Define your trading setups!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {strategies.map(s => (
            <div key={s.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{s.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{s.description || 'No description'}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}><Edit2 size={12} /></button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}><Trash2 size={12} /></button>
                </div>
              </div>
              {s.rules && Object.keys(s.rules).length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Rules: {Object.keys(s.rules).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Strategy' : 'New Strategy'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. London Breakout" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
            </div>
            <div className="form-group">
              <label className="form-label">Rules (JSON)</label>
              <textarea className="form-input" rows={6} value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
