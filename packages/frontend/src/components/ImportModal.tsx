import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

interface ImportConflict {
  id: string;
  type: string;
  name: string;
  existingId: number;
  suggestedNewName: string;
}

interface ConflictResolution {
  action: 'replace' | 'rename' | 'skip';
  newName?: string;
}

interface Adventure { id: number; name: string }

type Step = 'pick' | 'needs_target' | 'conflicts' | 'loading' | 'done' | 'error';

interface ImportResult { type: string; id: number; adventureId?: number }

export function ImportModal({ onClose, onSuccess, defaultTargetAdventureId }: {
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
  defaultTargetAdventureId?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [importType, setImportType] = useState<string | null>(null);
  const [importName, setImportName] = useState<string | null>(null);
  const [targetAdventureId, setTargetAdventureId] = useState<number | null>(defaultTargetAdventureId ?? null);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: adventures = [] } = useQuery<Adventure[]>({
    queryKey: ['adventures'],
    queryFn: () => fetch('/api/adventures').then((r) => r.json()),
    enabled: step === 'needs_target',
  });

  async function submit(theFile: File, target?: number, theResolutions?: Record<string, ConflictResolution>) {
    setStep('loading');
    setError(null);
    const form = new FormData();
    form.append('file', theFile);
    if (target != null) form.append('targetAdventureId', String(target));
    if (theResolutions != null) form.append('resolutions', JSON.stringify(theResolutions));

    try {
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'Import failed'); setStep('error'); return; }

      if (body.status === 'needs_target') {
        setImportType(body.type);
        setImportName(body.name);
        setStep('needs_target');
      } else if (body.status === 'conflicts') {
        setImportType(body.type);
        setImportName(body.name);
        const initial: Record<string, ConflictResolution> = {};
        for (const c of body.conflicts as ImportConflict[]) {
          initial[c.id] = { action: 'rename', newName: c.suggestedNewName };
        }
        setConflicts(body.conflicts);
        setResolutions(initial);
        setStep('conflicts');
      } else if (body.status === 'ok') {
        setResult(body);
        setStep('done');
        onSuccess(body);
      } else if (body.status === 'skipped') {
        setError('Import was skipped.');
        setStep('error');
      }
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  }

  function handleFilePick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    setFile(f);
    submit(f);
  }

  function handleTargetSubmit() {
    if (!file || targetAdventureId == null) return;
    submit(file, targetAdventureId);
  }

  function handleConflictSubmit() {
    if (!file) return;
    submit(file, targetAdventureId ?? undefined, resolutions);
  }

  function setResolutionAction(conflictId: string, action: ConflictResolution['action'], suggestedNewName: string) {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: { action, newName: action === 'rename' ? (prev[conflictId]?.newName ?? suggestedNewName) : undefined },
    }));
  }

  function setResolutionName(conflictId: string, newName: string) {
    setResolutions((prev) => ({ ...prev, [conflictId]: { ...prev[conflictId], newName } }));
  }

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>Import GMA Package</span>
          <button style={s.closeBtn} onClick={onClose} type="button">✕</button>
        </div>

        <div style={s.body}>

          {/* ── Pick file ── */}
          {(step === 'pick') && (
            <>
              <p style={s.hint}>Select a <code>.gma.zip</code> file exported from GM Assistant.</p>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,.gma.zip"
                style={{ display: 'none' }}
                onChange={(e) => handleFilePick(e.target.files)}
              />
              <button style={s.btnPrimary} type="button" onClick={() => fileRef.current?.click()}>
                Choose File…
              </button>
            </>
          )}

          {/* ── Loading ── */}
          {step === 'loading' && (
            <p style={s.hint}>Importing…</p>
          )}

          {/* ── Needs target adventure ── */}
          {step === 'needs_target' && (
            <>
              <p style={s.hint}>
                Importing <strong style={{ color: '#c9a84c' }}>{importName}</strong> ({importType}).
                Which adventure should it be imported into?
              </p>
              <select
                style={s.select}
                value={targetAdventureId ?? ''}
                onChange={(e) => setTargetAdventureId(Number(e.target.value))}
              >
                <option value="">— select adventure —</option>
                {adventures.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div style={s.btnRow}>
                <button style={s.btnPrimary} type="button" disabled={targetAdventureId == null} onClick={handleTargetSubmit}>
                  Continue
                </button>
                <button style={s.btnGhost} type="button" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}

          {/* ── Conflicts ── */}
          {step === 'conflicts' && (
            <>
              <p style={s.hint}>
                The following items already exist. Choose what to do with each:
              </p>
              <div style={s.conflictList}>
                {conflicts.map((c) => {
                  const res = resolutions[c.id] ?? { action: 'rename', newName: c.suggestedNewName };
                  return (
                    <div key={c.id} style={s.conflictRow}>
                      <div style={s.conflictName}>
                        <span style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase' }}>{c.type}</span>
                        <strong style={{ color: '#e0e0e0' }}>{c.name}</strong>
                      </div>
                      <div style={s.radioGroup}>
                        {(['replace', 'rename', 'skip'] as const).map((action) => (
                          <label key={action} style={s.radioLabel}>
                            <input
                              type="radio"
                              name={c.id}
                              value={action}
                              checked={res.action === action}
                              onChange={() => setResolutionAction(c.id, action, c.suggestedNewName)}
                            />
                            {action === 'replace' ? 'Replace' : action === 'rename' ? 'Rename' : 'Skip'}
                          </label>
                        ))}
                      </div>
                      {res.action === 'rename' && (
                        <input
                          style={s.input}
                          value={res.newName ?? c.suggestedNewName}
                          onChange={(e) => setResolutionName(c.id, e.target.value)}
                          placeholder="New name"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={s.btnRow}>
                <button style={s.btnPrimary} type="button" onClick={handleConflictSubmit}>
                  Import
                </button>
                <button style={s.btnGhost} type="button" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}

          {/* ── Done ── */}
          {step === 'done' && result && (
            <>
              <p style={{ ...s.hint, color: '#4caf50' }}>
                ✓ Import complete — <strong>{importName ?? result.type}</strong> imported successfully.
              </p>
              <button style={s.btnPrimary} type="button" onClick={onClose}>Close</button>
            </>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <>
              <p style={{ ...s.hint, color: '#ef5350' }}>{error}</p>
              <div style={s.btnRow}>
                <button style={s.btnPrimary} type="button" onClick={() => { setStep('pick'); setFile(null); setError(null); }}>
                  Try Again
                </button>
                <button style={s.btnGhost} type="button" onClick={onClose}>Close</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 8,
    width: 480, maxWidth: '95vw', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid #2a2a4a', flexShrink: 0,
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#c9a84c' },
  closeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1rem', padding: '4px 6px' },
  body: { padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { margin: 0, color: '#aaa', fontSize: '0.875rem', lineHeight: 1.5 },
  select: {
    background: '#0f0f1f', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '8px 10px', fontSize: '0.875rem', width: '100%',
  },
  input: {
    background: '#0f0f1f', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '6px 10px', fontSize: '0.825rem', width: '100%',
    boxSizing: 'border-box', marginTop: 4,
  },
  conflictList: { display: 'flex', flexDirection: 'column', gap: 12 },
  conflictRow: {
    background: '#0f0f1f', border: '1px solid #2a2a4a', borderRadius: 6,
    padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  conflictName: { display: 'flex', flexDirection: 'column', gap: 2 },
  radioGroup: { display: 'flex', gap: 16 },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: '0.825rem', cursor: 'pointer' },
  btnRow: { display: 'flex', gap: 8, marginTop: 4 },
  btnPrimary: {
    padding: '8px 18px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
  },
  btnGhost: {
    padding: '8px 18px', background: 'transparent', color: '#666',
    border: '1px solid #3a3a5a', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem',
  },
};
