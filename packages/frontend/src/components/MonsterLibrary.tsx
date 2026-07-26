import { useState, useEffect, useRef } from 'react';
import type { Monster } from '@gmassisstant/types';
import type { MonsterImport } from './Open5eSearch';
import { useMonsterImport } from '../hooks/useMonsterImport';

interface Props {
  // Omit when there's no combatant to populate (e.g. browsing/importing from the home page) — picking a result becomes a no-op.
  onSelect?: (m: MonsterImport) => void;
  style?: React.CSSProperties;
}

export function MonsterLibrary({ onSelect, style }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    setError(false);
    return fetch('/api/monsters')
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Monster[]) => setMonsters(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    refresh();
  }, [open]);

  const { importing, importResult, handleImportFile } = useMonsterImport(refresh);

  const results = monsters.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  function pick(m: Monster) {
    if (!onSelect) return;
    onSelect({
      name: m.name,
      maxHp: m.maxHp,
      initiativeModifier: m.initiativeModifier,
      type: 'enemy',
      statBlock: m.statBlock ?? undefined,
    });
    setOpen(false);
    setQuery('');
  }

  async function remove(id: number) {
    if (!window.confirm('Remove this monster from the library?')) return;
    await fetch(`/api/monsters/${id}`, { method: 'DELETE' });
    setMonsters((prev) => prev.filter((m) => m.id !== id));
  }

  if (!open) {
    return (
      <button type="button" style={{ ...btn, ...style }} onClick={() => setOpen(true)}>
        📚 Library
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={searchRow}>
        <input
          ref={inputRef}
          style={searchInput}
          placeholder="Filter saved monsters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          style={importBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          title="Import monsters from a Foundry export JSON file"
        >
          {importing ? '…' : '⬆ Import'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        <button type="button" style={closeBtn} onClick={() => { setOpen(false); setQuery(''); }}>✕</button>
      </div>

      {importResult && <p style={hint}>{importResult}</p>}
      {loading && <p style={hint}>Loading…</p>}
      {error && <p style={{ ...hint, color: '#ef5350' }}>Failed to load library</p>}
      {!loading && !error && monsters.length === 0 && <p style={hint}>Library is empty — save a monster to it first</p>}
      {!loading && !error && monsters.length > 0 && results.length === 0 && <p style={hint}>No matches</p>}

      {results.length > 0 && (
        <div style={list}>
          {results.map((m) => (
            <div key={m.id} style={resultRow}>
              <button
                type="button"
                style={{ ...resultMain, cursor: onSelect ? 'pointer' : 'default' }}
                onClick={() => pick(m)}
              >
                <span style={resultName}>{m.name}</span>
                <span style={resultMeta}>{m.maxHp} HP · init {m.initiativeModifier >= 0 ? '+' : ''}{m.initiativeModifier}</span>
              </button>
              <button type="button" style={removeBtn} onClick={() => remove(m.id)} title="Remove from library">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const btn: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: '#c9a84c',
  border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer',
  fontSize: '0.8rem', whiteSpace: 'nowrap',
};

const panel: React.CSSProperties = {
  background: '#0f0f1f', border: '1px solid #2a2a4a', borderRadius: 6,
  padding: '10px', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6,
};

const searchRow: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center',
};

const searchInput: React.CSSProperties = {
  flex: 1, background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
  color: '#e0e0e0', padding: '6px 10px', fontSize: '0.875rem',
};

const importBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #444', borderRadius: 4,
  color: '#c9a84c', cursor: 'pointer', fontSize: '0.75rem', padding: '4px 8px',
  whiteSpace: 'nowrap',
};

const closeBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #444', borderRadius: 4,
  color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 8px',
};

const hint: React.CSSProperties = {
  margin: 0, fontSize: '0.75rem', color: '#666', fontStyle: 'italic',
};

const list: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  maxHeight: 260, overflowY: 'auto',
};

const resultRow: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch', gap: 4,
  background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 4,
};

const resultMain: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  padding: '6px 10px', background: 'none', border: 'none',
  cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0,
};

const resultName: React.CSSProperties = {
  fontSize: '0.875rem', color: '#e0e0e0', fontWeight: 600,
};

const resultMeta: React.CSSProperties = {
  fontSize: '0.72rem', color: '#888', marginTop: 1,
};

const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#666',
  cursor: 'pointer', fontSize: '0.75rem', padding: '0 10px', flexShrink: 0,
};
