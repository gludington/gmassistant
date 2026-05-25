import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { GmHeader } from '../components/GmHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import type { Adventure } from '@gmassisstant/types';
import { useCurrentAdventure } from '../context/AdventureContext';
import { ImportModal } from '../components/ImportModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

export const Route = createFileRoute('/')({
  component: DmHome,
});

async function fetchAdventures(): Promise<Adventure[]> {
  const res = await fetch('/api/adventures');
  if (!res.ok) throw new Error('Failed to load adventures');
  return res.json();
}

async function createAdventure(data: { name: string; description: string }): Promise<Adventure> {
  const res = await fetch('/api/adventures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create adventure');
  return res.json();
}

function DmHome() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { setAdventureId } = useCurrentAdventure();
  const { data: adventures, isLoading } = useQuery({ queryKey: ['adventures'], queryFn: fetchAdventures });

  useEffect(() => { setAdventureId(null); }, []);

  const createMutation = useMutation({
    mutationFn: createAdventure,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adventures'] }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      fetch(`/api/adventures/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(r => { if (!r.ok) throw new Error('Rename failed'); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adventures'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/adventures/${id}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error('Delete failed'); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adventures'] }),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Adventure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Adventure | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), description: description.trim() }, {
      onSuccess: () => { setName(''); setDescription(''); setShowForm(false); },
    });
  }

  return (
    <div style={styles.page}>
      <GmHeader>
        <h1 style={styles.title}>GM Assistant</h1>
      </GmHeader>

      <main style={styles.main}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Adventures</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={styles.btnSecondary} onClick={() => setShowImport(true)}>↑ Import Adventure</button>
            <button style={styles.btnPrimary} onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ New Adventure'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Adventure name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <textarea
              style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button style={styles.btnPrimary} type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}

        {isLoading && <p style={styles.muted}>Loading...</p>}

        <div style={styles.list}>
          {adventures?.map((a) => (
            <div key={a.id} style={styles.cardWrap}>
              <Link to="/adventures/$adventureId" params={{ adventureId: String(a.id) }} style={styles.card}>
                <strong style={styles.cardTitle}>{a.name}</strong>
                {a.description && <p style={styles.cardDesc}>{a.description}</p>}
              </Link>
              <div style={styles.cardActions}>
                <button style={styles.btnIcon} onClick={() => setRenameTarget(a)} title="Rename adventure">✎</button>
                <button style={{ ...styles.btnIcon, color: '#ef5350' }} onClick={() => setDeleteTarget(a)} title="Delete adventure">🗑</button>
              </div>
            </div>
          ))}
          {adventures?.length === 0 && (
            <p style={styles.muted}>No adventures yet. Create one to get started.</p>
          )}
        </div>
      </main>

      {renameTarget && (
        <RenameModal
          adventure={renameTarget}
          isPending={renameMutation.isPending}
          onConfirm={(newName) => renameMutation.mutate(
            { id: renameTarget.id, name: newName },
            { onSuccess: () => setRenameTarget(null) },
          )}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete Adventure"
          name={deleteTarget.name}
          description="All its scenes, encounters, players, and playlists will also be deleted. This cannot be undone."
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={(result) => {
            setShowImport(false);
            qc.invalidateQueries({ queryKey: ['adventures'] });
            if (result.type === 'adventure') {
              navigate({ to: '/adventures/$adventureId', params: { adventureId: String(result.id) } });
            }
          }}
        />
      )}
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────

function RenameModal({ adventure, isPending, onConfirm, onCancel }: {
  adventure: Adventure;
  isPending: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(adventure.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() && value.trim() !== adventure.name) onConfirm(value.trim());
    else if (value.trim() === adventure.name) onCancel();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.modalTitle}>Rename Adventure</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            style={styles.input}
            value={value}
            onChange={e => setValue(e.target.value)}
            autoComplete="off"
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={styles.btnSecondary} onClick={onCancel} disabled={isPending}>Cancel</button>
            <button
              type="submit"
              style={{ ...styles.btnPrimary, opacity: value.trim() && value.trim() !== adventure.name ? 1 : 0.4, cursor: value.trim() && value.trim() !== adventure.name ? 'pointer' : 'not-allowed' }}
              disabled={!value.trim() || value.trim() === adventure.name || isPending}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0' },
  title: { margin: 0, fontSize: '1.5rem', color: '#c9a84c' },
  main: { padding: '32px', maxWidth: 800, margin: '0 auto' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { margin: 0, fontSize: '1.2rem' },
  form: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, padding: 16, background: '#16213e', borderRadius: 8 },
  input: {
    background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '8px 12px', fontSize: '1rem',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  cardWrap: { display: 'flex', alignItems: 'stretch', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a4a' },
  card: {
    flex: 1, display: 'block', padding: 16, background: '#16213e',
    textDecoration: 'none', color: 'inherit',
  },
  cardTitle: { fontSize: '1rem', color: '#c9a84c' },
  cardDesc: { margin: '4px 0 0', fontSize: '0.875rem', color: '#999' },
  cardActions: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '0 12px', borderLeft: '1px solid #2a2a4a', flexShrink: 0,
    background: '#16213e',
  },
  btnIcon: {
    padding: '4px 8px', background: 'transparent', color: '#888',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem',
  },
  muted: { color: '#666', fontStyle: 'italic' },
  btnPrimary: {
    padding: '8px 16px', background: '#c9a84c', color: '#1a1a2e',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
  },
  btnSecondary: {
    padding: '8px 16px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 16px', background: 'transparent', color: '#ef5350',
    border: '1px solid #ef5350', borderRadius: 4, cursor: 'pointer',
  },
};
