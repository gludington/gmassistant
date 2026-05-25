import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { GmHeader } from '../components/GmHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import type { Adventure } from '@gmassisstant/types';
import { useCurrentAdventure } from '../context/AdventureContext';
import { ImportModal } from '../components/ImportModal';

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
  const mutation = useMutation({
    mutationFn: createAdventure,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adventures'] }),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({ name: name.trim(), description: description.trim() }, {
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
            <button style={styles.btnSecondary} onClick={() => setShowImport(true)}>↑ Import</button>
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
            <button style={styles.btnPrimary} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}

        {isLoading && <p style={styles.muted}>Loading...</p>}

        <div style={styles.list}>
          {adventures?.map((a) => (
            <Link key={a.id} to="/adventures/$adventureId" params={{ adventureId: String(a.id) }} style={styles.card}>
              <strong style={styles.cardTitle}>{a.name}</strong>
              {a.description && <p style={styles.cardDesc}>{a.description}</p>}
            </Link>
          ))}
          {adventures?.length === 0 && (
            <p style={styles.muted}>No adventures yet. Create one to get started.</p>
          )}
        </div>
      </main>
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
  card: {
    display: 'block', padding: 16, background: '#16213e', border: '1px solid #2a2a4a',
    borderRadius: 8, textDecoration: 'none', color: 'inherit',
  },
  cardTitle: { fontSize: '1rem', color: '#c9a84c' },
  cardDesc: { margin: '4px 0 0', fontSize: '0.875rem', color: '#999' },
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
