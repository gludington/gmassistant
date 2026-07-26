import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import type { Monster } from '@gmassisstant/types';
import { GmHeader } from '../components/GmHeader';
import { StatBlockEditor } from '../components/StatBlockEditor';
import { useMonsterImport } from '../hooks/useMonsterImport';

export const Route = createFileRoute('/monsters')({
  component: MonsterLibraryPage,
});

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function MonsterLibraryPage() {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Monster | null>(null);
  const [libraryImporting, setLibraryImporting] = useState(false);
  const [libraryImportResult, setLibraryImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    return fetch('/api/monsters')
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Monster[]) => setMonsters(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  const { importing, importResult, handleImportFile } = useMonsterImport(refresh);

  const results = monsters.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function remove(id: number) {
    if (!window.confirm('Delete this monster from the library? This cannot be undone.')) return;
    await fetch(`/api/monsters/${id}`, { method: 'DELETE' });
    setMonsters((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleExport() {
    const res = await fetch('/api/monsters/export');
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gmassisstant-monster-library.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleLibraryImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLibraryImporting(true);
    setLibraryImportResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/monsters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error();
      const { imported, updated } = await res.json();
      setLibraryImportResult(`Imported ${imported}, updated ${updated}`);
      await refresh();
    } catch {
      setLibraryImportResult('Import failed — check the file is a valid library export');
    } finally {
      setLibraryImporting(false);
    }
  }

  async function handleFormSubmit(data: { name: string; maxHp: number; initiativeModifier: number; statBlock?: string }, id?: number) {
    if (id) {
      const res = await fetch(`/api/monsters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      setMonsters((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } else {
      const res = await fetch('/api/monsters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, origin: 'manual' }),
      });
      const created = await res.json();
      setMonsters((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setShowForm(false);
    setEditTarget(null);
  }

  return (
    <div style={s.page}>
      <GmHeader>
        <h1 style={s.title}>Monster Library</h1>
      </GmHeader>

      <main style={s.main}>
        <div style={s.toolbar}>
          <input
            style={s.search}
            placeholder="Search monsters…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            style={s.btnSecondary}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Import monsters from a Foundry export JSON file"
          >
            {importing ? '…' : '⬆ Foundry Import'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            type="button"
            style={s.btnSecondary}
            onClick={handleExport}
            title="Download this whole library as a JSON file"
          >
            ⬇ Export
          </button>
          <button
            type="button"
            style={s.btnSecondary}
            onClick={() => libraryFileInputRef.current?.click()}
            disabled={libraryImporting}
            title="Import a library JSON file exported from another gmassisstant instance"
          >
            {libraryImporting ? '…' : '⬆ Import Library'}
          </button>
          <input
            ref={libraryFileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleLibraryImportFile}
          />
          <button
            type="button"
            style={s.btnPrimary}
            onClick={() => { setEditTarget(null); setShowForm(true); }}
          >
            + New Monster
          </button>
        </div>

        {importResult && <p style={s.hint}>{importResult}</p>}
        {libraryImportResult && <p style={s.hint}>{libraryImportResult}</p>}
        {loading && <p style={s.muted}>Loading…</p>}
        {!loading && results.length === 0 && (
          <p style={s.muted}>{monsters.length === 0 ? 'No monsters yet — create one or import from Foundry.' : 'No matches.'}</p>
        )}

        <div style={s.list}>
          {results.map((m) => (
            <div key={m.id} style={s.row}>
              <div style={s.rowMain}>
                <strong style={s.rowName}>{m.name}</strong>
                <div style={s.badges}>
                  <span style={s.badge}>{m.maxHp} HP</span>
                  <span style={s.badge}>init {fmtMod(m.initiativeModifier)}</span>
                  {m.cr != null && <span style={s.badge}>CR {m.cr}</span>}
                  {m.creatureType && <span style={s.badge}>{m.creatureType}</span>}
                  {m.origin && <span style={{ ...s.badge, ...s.originBadge }}>{m.origin}</span>}
                </div>
              </div>
              <div style={s.rowActions}>
                <button type="button" style={s.btnGhost} onClick={() => { setEditTarget(m); setShowForm(true); }}>Edit</button>
                <button type="button" style={{ ...s.btnGhost, color: '#ef5350' }} onClick={() => remove(m.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showForm && (
        <MonsterForm
          initial={editTarget}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}

// ── Create / edit form ───────────────────────────────────────────────────────

function MonsterForm({ initial, onSubmit, onCancel }: {
  initial: Monster | null;
  onSubmit: (data: { name: string; maxHp: number; initiativeModifier: number; statBlock?: string }, id?: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [maxHp, setMaxHp] = useState(initial?.maxHp ?? 10);
  const [initMod, setInitMod] = useState(initial?.initiativeModifier ?? 0);
  const [statBlock, setStatBlock] = useState<string | undefined>(initial?.statBlock ?? undefined);
  const [showSbEditor, setShowSbEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), maxHp, initiativeModifier: initMod, statBlock }, initial?.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.modalTitle}>{initial ? 'Edit Monster' : 'New Monster'}</h2>
        <form onSubmit={handleSubmit} style={s.formCol}>
          <input style={s.input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={s.fieldLabel}>
              HP
              <input style={s.input} type="number" min={0} value={maxHp} onChange={(e) => setMaxHp(Number(e.target.value))} />
            </label>
            <label style={s.fieldLabel}>
              Init mod
              <input style={s.input} type="number" value={initMod} onChange={(e) => setInitMod(Number(e.target.value))} />
            </label>
          </div>
          <button
            type="button"
            style={{ ...s.btnSecondary, color: statBlock ? '#c9a84c' : '#666', alignSelf: 'flex-start' }}
            onClick={() => setShowSbEditor(true)}
          >
            📖 {statBlock ? 'Edit Stat Block' : 'Add Stat Block'}
          </button>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" style={s.btnSecondary} onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" style={s.btnPrimary} disabled={!name.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>

        {showSbEditor && (
          <StatBlockEditor
            initialData={statBlock}
            onSave={(json) => { setStatBlock(json); setShowSbEditor(false); }}
            onCancel={() => setShowSbEditor(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0' },
  title: { margin: 0, fontSize: '1.4rem', color: '#c9a84c' },
  main: { padding: '32px', maxWidth: 900, margin: '0 auto' },

  toolbar: { display: 'flex', gap: 8, marginBottom: 16 },
  search: {
    flex: 1, background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '8px 12px', fontSize: '0.925rem',
  },
  hint: { margin: '0 0 12px', fontSize: '0.8rem', color: '#888', fontStyle: 'italic' },
  muted: { color: '#666', fontStyle: 'italic' },

  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 14px', background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 6,
  },
  rowMain: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  rowName: { fontSize: '0.95rem', color: '#e0e0e0' },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  badge: {
    fontSize: '0.7rem', color: '#888', background: '#0f0f1f', border: '1px solid #2a2a4a',
    borderRadius: 4, padding: '2px 6px',
  },
  originBadge: { color: '#c9a84c', borderColor: '#3a3a1a' },
  rowActions: { display: 'flex', gap: 6, flexShrink: 0 },

  btnPrimary: {
    padding: '8px 16px', background: '#c9a84c', color: '#1a1a2e',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
  },
  btnSecondary: {
    padding: '8px 16px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnGhost: {
    padding: '5px 10px', background: 'transparent', color: '#888',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#16213e', border: '1px solid #3a3a5a', borderRadius: 10,
    padding: '24px 28px', maxWidth: 440, width: '90%',
  },
  modalTitle: { margin: '0 0 16px', fontSize: '1.1rem', color: '#c9a84c' },
  formCol: { display: 'flex', flexDirection: 'column', gap: 10 },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.7rem', color: '#888', flex: 1 },
  input: {
    background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '8px 12px', fontSize: '0.925rem', width: '100%', boxSizing: 'border-box',
  },
};
