import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { unzipSync } from 'fflate';
import { isElectron } from '../lib/platform';

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

interface ImportManifest { type: string; schemaVersion: number; exportedAt: string; name: string }

// ── Web import path ─────────────────────────────────────────────────────────
//
// Electron has no size/memory limits, so it just POSTs the raw .gma.zip to
// /api/import and the server unzips it (see routes/portability.ts). Cloudflare
// Workers do: a 100MB request body cap and a 128MB per-isolate memory limit,
// both of which a large adventure export (audio + images) blows through. So on
// the web, we unzip client-side instead, upload each asset individually via
// the existing per-type upload endpoints, then send only small JSON to
// /api/import/analyze and /api/import/apply.

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']);

// Cloudflare Workers cap request bodies at 100MB. A single upload — either
// the whole-file POST below, or one chunk of a multipart upload — must stay
// comfortably under that, hence the margin on both numbers.
const CHUNK_THRESHOLD = 80 * 1024 * 1024;
const CHUNK_SIZE = 40 * 1024 * 1024;

function extractZip(buffer: Uint8Array): { manifest: ImportManifest; data: any; files: Map<string, Uint8Array> } {
  const entries = unzipSync(buffer);
  const decoder = new TextDecoder();
  const manifest: ImportManifest = JSON.parse(decoder.decode(entries['manifest.json']));
  const data = JSON.parse(decoder.decode(entries['data.json']));
  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith('uploads/')) files.set(path.slice('uploads/'.length), bytes);
  }
  return { manifest, data, files };
}

async function uploadAsset(key: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > CHUNK_THRESHOLD) return uploadAssetChunked(key, bytes);

  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  const endpoint = IMAGE_EXTS.has(ext) ? '/api/uploads' : '/api/playlists/upload';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)]), key);
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Failed to upload ${key}`);
  const body = await res.json();
  return body.url as string;
}

// For files over CHUNK_THRESHOLD (e.g. the 189MB/183MB audio tracks that
// surfaced this need) — splits into CHUNK_SIZE pieces, each its own request,
// via the R2-multipart-backed /api/uploads/multipart/* routes.
async function uploadAssetChunked(key: string, bytes: Uint8Array): Promise<string> {
  const startRes = await fetch('/api/uploads/multipart/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: key }),
  });
  if (!startRes.ok) throw new Error(`Failed to start upload for ${key}`);
  const { key: storageKey, uploadId } = await startRes.json();

  const parts: { partNumber: number; etag: string }[] = [];
  let partNumber = 1;
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.byteLength));
    const form = new FormData();
    form.append('key', storageKey);
    form.append('uploadId', uploadId);
    form.append('partNumber', String(partNumber));
    form.append('file', new Blob([new Uint8Array(chunk)]), key);
    const res = await fetch('/api/uploads/multipart/part', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Failed to upload part ${partNumber} of ${key}`);
    const body = await res.json();
    parts.push({ partNumber, etag: body.etag });
    partNumber++;
  }

  const completeRes = await fetch('/api/uploads/multipart/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: storageKey, uploadId, parts }),
  });
  if (!completeRes.ok) throw new Error(`Failed to complete upload for ${key}`);
  const body = await completeRes.json();
  return body.url as string;
}

// Rewrites fileKey/url references in the parsed export data to point at the
// freshly-uploaded keys, in place. Mirrors the shapes produced by
// exportAdventure/exportPlaylist in packages/backend/src/lib/portability.ts.
function rewriteFileReferences(manifest: ImportManifest, data: any, keyMap: Map<string, string>) {
  const rewriteTracks = (tracks: any[]) => {
    for (const t of tracks) {
      if (t.type === 'file' && t.fileKey && keyMap.has(t.fileKey)) t.url = keyMap.get(t.fileKey);
    }
  };
  if (manifest.type === 'adventure') {
    for (const pl of data.playlists ?? []) rewriteTracks(pl.tracks ?? []);
    for (const sc of data.imageScenes ?? []) {
      for (const img of sc.images ?? []) {
        if (img.fileKey && keyMap.has(img.fileKey)) {
          img.fileKey = (keyMap.get(img.fileKey) as string).replace('/uploads/', '');
        }
      }
    }
  } else if (manifest.type === 'playlist') {
    rewriteTracks(data.tracks ?? []);
  }
  // 'encounter' exports never carry files (see exportEncounter) — nothing to rewrite.
}

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
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; fileName: string } | null>(null);
  const parsedRef = useRef<{ manifest: ImportManifest; data: any; files: Map<string, Uint8Array> } | null>(null);

  const { data: adventures = [] } = useQuery<Adventure[]>({
    queryKey: ['adventures'],
    queryFn: () => fetch('/api/adventures').then((r) => r.json()),
    enabled: step === 'needs_target',
  });

  function handleImportResponse(body: any) {
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
  }

  async function submitElectron(theFile: File, target?: number, theResolutions?: Record<string, ConflictResolution>) {
    const form = new FormData();
    form.append('file', theFile);
    if (target != null) form.append('targetAdventureId', String(target));
    if (theResolutions != null) form.append('resolutions', JSON.stringify(theResolutions));

    const res = await fetch('/api/import', { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? 'Import failed'); setStep('error'); return; }
    handleImportResponse(body);
  }

  // Uploads every extracted asset individually, rewrites the parsed data's
  // file references to the new keys, then applies. Only reached once conflicts
  // (if any) are resolved — see rewriteFileReferences for the shapes involved.
  async function finishWebImport(target?: number, theResolutions?: Record<string, ConflictResolution>) {
    const parsed = parsedRef.current;
    if (!parsed) return;
    const { manifest, data, files } = parsed;

    const keyMap = new Map<string, string>();
    const entries = Array.from(files.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, bytes] = entries[i];
      setUploadProgress({ done: i, total: entries.length, fileName: key });
      const url = await uploadAsset(key, bytes);
      keyMap.set(key, url);
    }
    setUploadProgress({ done: entries.length, total: entries.length, fileName: '' });
    rewriteFileReferences(manifest, data, keyMap);

    const res = await fetch('/api/import/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, data, resolutions: theResolutions ?? {}, targetAdventureId: target }),
    });
    const body = await res.json();
    setUploadProgress(null);
    if (!res.ok) { setError(body.error ?? 'Import failed'); setStep('error'); return; }
    handleImportResponse(body);
  }

  async function submitWeb(theFile: File, target?: number, theResolutions?: Record<string, ConflictResolution>) {
    if (!parsedRef.current) {
      const buffer = new Uint8Array(await theFile.arrayBuffer());
      parsedRef.current = extractZip(buffer);
    }

    // Conflicts already resolved (or none existed) — go straight to upload + apply.
    if (theResolutions != null) {
      await finishWebImport(target, theResolutions);
      return;
    }

    const { manifest, data } = parsedRef.current;
    const res = await fetch('/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, data, targetAdventureId: target }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? 'Import failed'); setStep('error'); return; }

    if (body.status === 'needs_target') {
      setImportType(body.type);
      setImportName(body.name);
      setStep('needs_target');
    } else if (body.status === 'conflicts') {
      handleImportResponse(body);
    } else if (body.status === 'ready') {
      await finishWebImport(target, {});
    }
  }

  async function submit(theFile: File, target?: number, theResolutions?: Record<string, ConflictResolution>) {
    setStep('loading');
    setError(null);
    try {
      if (isElectron()) await submitElectron(theFile, target, theResolutions);
      else await submitWeb(theFile, target, theResolutions);
    } catch (e) {
      setUploadProgress(null);
      setError(String(e));
      setStep('error');
    }
  }

  function handleFilePick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    parsedRef.current = null;
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
            <p style={s.hint}>
              {uploadProgress
                ? uploadProgress.fileName
                  ? `Uploading ${uploadProgress.fileName}… (${uploadProgress.done + 1}/${uploadProgress.total})`
                  : `Uploading assets… ${uploadProgress.done}/${uploadProgress.total}`
                : 'Importing…'}
            </p>
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
                <button style={s.btnPrimary} type="button" onClick={() => { parsedRef.current = null; setUploadProgress(null); setStep('pick'); setFile(null); setError(null); }}>
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
