import { useState } from 'react';

export function useMonsterImport(onImported: () => void | Promise<void>) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/monsters/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: 'foundry', monsters: parsed }),
      });
      if (!res.ok) throw new Error();
      const { imported, updated } = await res.json();
      setImportResult(`Imported ${imported}, updated ${updated}`);
      await onImported();
    } catch {
      setImportResult('Import failed — check the file is a valid export');
    } finally {
      setImporting(false);
    }
  }

  return { importing, importResult, handleImportFile };
}
