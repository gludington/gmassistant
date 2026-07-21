import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import {
  exportAdventure, exportPlaylist, exportEncounter,
  exportAdventureManifest, exportPlaylistManifest,
  analyzeImport, applyImport,
  analyzeImportData, applyImportData,
  type Resolutions, type ExportManifest,
} from '../lib/portability.js';

const router = new Hono<{ Variables: AppVariables }>();

// ─── Export ───────────────────────────────────────────────────────────────────

router.get('/export/adventure/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const zip = await exportAdventure(c.var.db, c.var.storage, id);
  const res = new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="adventure-${id}.gma.zip"`,
    },
  });
  return res;
});

router.get('/export/playlist/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const zip = await exportPlaylist(c.var.db, c.var.storage, id);
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="playlist-${id}.gma.zip"`,
    },
  });
});

router.get('/export/encounter/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const zip = await exportEncounter(c.var.db, id);
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="encounter-${id}.gma.zip"`,
    },
  });
});

// JSON-only counterparts (manifest + data + file keys, no zip) — used by the
// web client to assemble the zip itself. See lib/portability.ts's comment on
// exportAdventure/exportAdventureManifest for why. Encounter exports never
// carry files, so they don't need this — the plain zip route above is cheap
// either way.

router.get('/export/adventure/:id/manifest', async (c) => {
  const id = Number(c.req.param('id'));
  return c.json(await exportAdventureManifest(c.var.db, id));
});

router.get('/export/playlist/:id/manifest', async (c) => {
  const id = Number(c.req.param('id'));
  return c.json(await exportPlaylistManifest(c.var.db, id));
});

// ─── Import ───────────────────────────────────────────────────────────────────

router.post('/import', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!file || typeof file === 'string') return c.json({ error: 'No file provided' }, 400);

  const buffer = new Uint8Array(await file.arrayBuffer());
  const targetAdventureId = body['targetAdventureId'] ? Number(body['targetAdventureId']) : undefined;
  const resolutionsRaw = body['resolutions'];
  const resolutions: Resolutions = resolutionsRaw && typeof resolutionsRaw === 'string'
    ? JSON.parse(resolutionsRaw)
    : null;

  // If resolutions provided (even empty {}), apply immediately
  if (resolutions !== null) {
    try {
      const result = await applyImport(c.var.db, c.var.storage, buffer, resolutions, targetAdventureId);
      return c.json({ status: 'ok', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Import skipped') return c.json({ status: 'skipped' });
      return c.json({ error: msg }, 400);
    }
  }

  // Analyze mode — detect conflicts (or apply immediately if none)
  const analysis = await analyzeImport(c.var.db, buffer, targetAdventureId);

  if (analysis.needsTarget) {
    return c.json({ status: 'needs_target', type: analysis.type, name: analysis.name });
  }

  if (analysis.conflicts.length === 0) {
    // No conflicts — apply directly
    const result = await applyImport(c.var.db, c.var.storage, buffer, {}, targetAdventureId);
    return c.json({ status: 'ok', ...result });
  }

  return c.json({ status: 'conflicts', type: analysis.type, name: analysis.name, conflicts: analysis.conflicts });
});

// ─── Import (JSON — assets already uploaded, used by the web client) ──────────
//
// Counterpart to POST /import for browsers, which unzip client-side (see
// packages/frontend/src/components/ImportModal.tsx) to stay under Cloudflare's
// request-body and Worker-memory limits on large exports. The desktop app
// keeps using the raw-zip /import route above, unaffected by this.

router.post('/import/analyze', async (c) => {
  const body = await c.req.json<{ manifest: ExportManifest; data: unknown; targetAdventureId?: number }>();
  const analysis = await analyzeImportData(c.var.db, body.manifest, body.data, body.targetAdventureId);

  if (analysis.needsTarget) {
    return c.json({ status: 'needs_target', type: analysis.type, name: analysis.name });
  }
  if (analysis.conflicts.length === 0) {
    return c.json({ status: 'ready', type: analysis.type, name: analysis.name, conflicts: [] });
  }
  return c.json({ status: 'conflicts', type: analysis.type, name: analysis.name, conflicts: analysis.conflicts });
});

router.post('/import/apply', async (c) => {
  const body = await c.req.json<{
    manifest: ExportManifest; data: unknown; resolutions: Resolutions; targetAdventureId?: number;
  }>();
  try {
    const result = await applyImportData(c.var.db, c.var.storage, body.manifest, body.data, body.resolutions ?? {}, body.targetAdventureId);
    return c.json({ status: 'ok', ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Import skipped') return c.json({ status: 'skipped' });
    return c.json({ error: msg }, 400);
  }
});

export default router;
