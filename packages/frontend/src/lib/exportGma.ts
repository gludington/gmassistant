import { zipSync, type ZipOptions } from 'fflate';

// Assembles a .gma.zip client-side and triggers a download. Used on the web
// instead of downloading /api/export/... directly: building the zip
// server-side means computing a CRC-32 over every asset byte, which reliably
// exceeds the Workers Free plan's 10ms CPU-time budget for any real adventure
// (confirmed live — non-deterministic partial output / 500s past a certain
// size). Browsers have no equivalent CPU limit, so the same zipSync() call
// that already runs server-side for the desktop app works fine here.
//
// The manifest/data.json shape and uploads/<key> layout exactly match what
// the server's own exportAdventure/exportPlaylist produce (see
// packages/backend/src/lib/portability.ts), so the resulting archive imports
// identically through either path.

const encoder = new TextEncoder();

export async function downloadGmaExport(
  kind: 'adventure' | 'playlist',
  id: number,
  filename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const res = await fetch(`/api/export/${kind}/${id}/manifest`);
  if (!res.ok) throw new Error('Export failed');
  const { manifest, data, fileKeys } = await res.json();

  const entries: Record<string, Uint8Array | [Uint8Array, ZipOptions]> = {
    'manifest.json': [encoder.encode(JSON.stringify(manifest, null, 2)), { level: 9 }],
    'data.json': [encoder.encode(JSON.stringify(data, null, 2)), { level: 9 }],
  };

  for (let i = 0; i < fileKeys.length; i++) {
    const key: string = fileKeys[i];
    onProgress?.(i, fileKeys.length);
    const fileRes = await fetch(`/uploads/${key}`);
    if (!fileRes.ok) continue;
    entries[`uploads/${key}`] = [new Uint8Array(await fileRes.arrayBuffer()), { level: 0 }];
  }
  onProgress?.(fileKeys.length, fileKeys.length);

  const zipped = zipSync(entries);
  const blob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
