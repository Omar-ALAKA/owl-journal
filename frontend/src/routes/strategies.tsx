// routes/strategies.tsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStrategies, createStrategy, updateStrategy, deleteStrategy } from '../lib/api';
import type { Strategy } from '../types';
import { Plus, Edit2, Trash2, X, Target, CheckSquare, Square } from 'lucide-react';

const PRESET_RULES = [
  'Trade uniquement en direction du trend',
  'Stop loss obligatoire sur chaque trade',
  'Risk max 1% par trade',
  'Pas de trading pendant les news',
  'Max 3 trades par jour',
  'Respecter le ratio risk/reward minimum 1:2',
];

export function StrategiesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => fetchStrategies().catch(() => ({ strategies: [] })),
  });
  const strategies: Strategy[] = data?.strategies || [];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRules, setFormRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');

  const openNew = () => {
    setEditing(null);
    setFormName('');
    setFormDesc('');
    setFormRules([...PRESET_RULES]);
    setNewRule('');
    setShowModal(true);
  };

  const openEdit = (s: Strategy) => {
    setEditing(s);
    setFormName(s.name);
    setFormDesc(s.description || '');
    // rules stored as array of strings
    const existingRules: string[] = Array.isArray(s.rules)
      ? (s.rules as unknown as string[])
      : typeof s.rules === 'object' && s.rules !== null
        ? Object.values(s.rules as Record<string, unknown>).map(String)
        : [];
    setFormRules(existingRules.length > 0 ? existingRules : [...PRESET_RULES]);
    setNewRule('');
    setShowModal(true);
  };

  const toggleRule = (rule: string) => {
    setFormRules(prev =>
      prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]
    );
  };

  const addCustomRule = () => {
    const trimmed = newRule.trim();
    if (trimmed && !formRules.includes(trimmed)) {
      setFormRules(prev => [...prev, trimmed]);
      setNewRule('');
    }
  };

  const removeRule = (rule: string) => {
    setFormRules(prev => prev.filter(r => r !== rule));
  };

  const handleSave = async () => {
    const payload = { name: formName, description: formDesc, rules: formRules };
    if (editing) {
      await updateStrategy(editing.id, payload);
    } else {
      await createStrategy(payload);
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
          {strategies.map(s => {
            const rulesList: string[] = Array.isArray(s.rules)
              ? (s.rules as unknown as string[])
              : typeof s.rules === 'object' && s.rules !== null
                ? Object.values(s.rules as Record<string, unknown>).map(String)
                : [];
            return (
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
                {rulesList.length > 0 && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Rules: {rulesList.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Strategy' : 'New Strategy'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. London Breakout" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description..." />
            </div>
            <div className="form-group">
              <label className="form-label">Rules Checklist</label>
              <div style={{
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '12px',
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                {formRules.map((rule, i) => (
                  <div
                    key={i}
                    onClick={() => toggleRule(rule)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  >
                    {formRules.includes(rule) ? (
                      <CheckSquare size={16} color="var(--color-green)" />
                    ) : (
                      <Square size={16} color="var(--color-text-muted)" />
                    )}
                    <span style={{ fontSize: '13px', flex: 1 }}>{rule}</span>
                    {!PRESET_RULES.includes(rule) && (
                      <button
                        onClick={e => { e.stopPropagation(); removeRule(rule); }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer',
                          padding: '2px', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  className="form-input"
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  placeholder="Add a custom rule..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomRule(); } }}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={addCustomRule} type="button">+ Add rule</button>
              </div>
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
