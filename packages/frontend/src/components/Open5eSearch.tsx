import { useState, useEffect, useRef } from 'react';

interface MonsterHit {
  key: string;
  name: string;
  hit_points: number;
  initiative_bonus?: number;
  challenge_rating_decimal: number;
  type: string | { name: string; key: string };
  document?: { display_name: string };
  [key: string]: unknown;
}

interface ApiResponse {
  count: number;
  results: MonsterHit[];
}

export interface MonsterImport {
  name: string;
  maxHp: number;
  initiativeModifier: number;
  type: 'enemy';
  statBlock?: string;
}

interface Props {
  onSelect: (m: MonsterImport) => void;
  style?: React.CSSProperties;
}

export function Open5eSearch({ onSelect, style }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MonsterHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setError(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(
          `https://api.open5e.com/v2/creatures/?name__icontains=${encodeURIComponent(query.trim())}&limit=12&ordering=challenge_rating_decimal`
        );
        if (!res.ok) throw new Error();
        const data: ApiResponse = await res.json();
        setResults(data.results ?? []);
      } catch {
        setError(true);
        setResults([]);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function pick(m: MonsterHit) {
    onSelect({
      name: m.name,
      maxHp: m.hit_points,
      initiativeModifier: m.initiative_bonus ?? 0,
      type: 'enemy',
      statBlock: JSON.stringify(m),
    });
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  if (!open) {
    return (
      <button type="button" style={{ ...btn, ...style }} onClick={() => setOpen(true)}>
        🔍 Open5e
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={searchRow}>
        <input
          ref={inputRef}
          style={searchInput}
          placeholder="Search monsters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" style={closeBtn} onClick={() => { setOpen(false); setQuery(''); setResults([]); }}>✕</button>
      </div>

      {loading && <p style={hint}>Searching…</p>}
      {error && <p style={{ ...hint, color: '#ef5350' }}>Failed to reach Open5e</p>}
      {!loading && !error && query && results.length === 0 && <p style={hint}>No results</p>}

      {results.length > 0 && (
        <div style={list}>
          {results.map((m) => (
            <button key={m.key} type="button" style={resultRow} onClick={() => pick(m)}>
              <span style={resultName}>
                {m.name}
                {m.document?.display_name && (
                  <span style={resultSource}> ({m.document.display_name})</span>
                )}
              </span>
              <span style={resultMeta}>
                CR {m.challenge_rating_decimal} · {typeof m.type === 'object' ? m.type.name : m.type} · {m.hit_points} HP · init {(m.initiative_bonus ?? 0) >= 0 ? '+' : ''}{m.initiative_bonus ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const btn: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: '#64b5f6',
  border: '1px solid #64b5f6', borderRadius: 4, cursor: 'pointer',
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
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  padding: '6px 10px', background: '#16213e', border: '1px solid #2a2a4a',
  borderRadius: 4, cursor: 'pointer', textAlign: 'left', width: '100%',
};

const resultName: React.CSSProperties = {
  fontSize: '0.875rem', color: '#e0e0e0', fontWeight: 600,
};

const resultSource: React.CSSProperties = {
  fontWeight: 400, color: '#777', fontSize: '0.8rem',
};

const resultMeta: React.CSSProperties = {
  fontSize: '0.72rem', color: '#888', marginTop: 1,
};
