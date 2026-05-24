import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import {
  exportAdventure, exportPlaylist, exportEncounter,
  analyzeImport, applyImport,
  type Resolutions,
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

export default router;
