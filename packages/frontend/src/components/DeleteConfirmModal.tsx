import { useState, useEffect, useRef } from 'react';

export function DeleteConfirmModal({ title, name, description, isPending, onConfirm, onCancel }: {
  title: string;
  name: string;
  description: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h2 style={s.modalTitle}>{title}</h2>
        <p style={s.modalBody}>
          This will permanently delete <strong style={{ color: '#c9a84c' }}>{name}</strong>.{' '}
          {description}
        </p>
        <p style={s.modalBody}>
          Type <strong style={{ color: '#ef5350', letterSpacing: '0.1em' }}>DELETE</strong> to confirm:
        </p>
        <input
          ref={inputRef}
          style={s.input}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={s.btnSecondary} onClick={onCancel} disabled={isPending}>Cancel</button>
          <button
            style={{ ...s.btnDanger, opacity: typed === 'DELETE' ? 1 : 0.4, cursor: typed === 'DELETE' ? 'pointer' : 'not-allowed' }}
            disabled={typed !== 'DELETE' || isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Deleting…' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#16213e', border: '1px solid #3a3a5a', borderRadius: 10,
    padding: '28px 32px', maxWidth: 440, width: '90%',
  },
  modalTitle: { margin: '0 0 16px', fontSize: '1.1rem', color: '#c9a84c' },
  modalBody: { margin: '0 0 12px', fontSize: '0.9rem', color: '#ccc', lineHeight: 1.6 },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '8px 12px', fontSize: '1rem',
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
