import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { ASSET_MIME } from '../lib/portability.js';

const router = new Hono<{ Variables: AppVariables }>();

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
};

router.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) {
    return c.json({ error: 'Unsupported file type' }, 400);
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  await c.var.storage.put(filename, buffer, IMAGE_MIME[ext] ?? 'application/octet-stream');

  return c.json({ url: `/uploads/${filename}` }, 201);
});

// ─── Multipart upload (for individual files too large for one request) ───────
//
// Used by the web import flow (packages/frontend/src/components/ImportModal.tsx)
// for asset files over ~80MB, which won't fit under Cloudflare's 100MB request
// body limit as a single upload. Accepts both image and audio extensions,
// unlike the two single-shot routes above which each only accept one kind.

router.post('/multipart/start', async (c) => {
  const { filename } = await c.req.json<{ filename: string }>();
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  if (!ASSET_MIME[ext]) return c.json({ error: `Unsupported file type: .${ext}` }, 400);

  const key = `${crypto.randomUUID()}.${ext}`;
  const { uploadId } = await c.var.storage.createMultipartUpload(key, ASSET_MIME[ext]);
  return c.json({ key, uploadId }, 201);
});

router.post('/multipart/part', async (c) => {
  const body = await c.req.parseBody();
  const { key, uploadId, partNumber, file } = body;
  if (!file || typeof file === 'string' || typeof key !== 'string' || typeof uploadId !== 'string' || typeof partNumber !== 'string') {
    return c.json({ error: 'Missing key, uploadId, partNumber, or file' }, 400);
  }

  const buffer = await file.arrayBuffer();
  const { etag } = await c.var.storage.uploadPart(key, uploadId, Number(partNumber), buffer);
  return c.json({ partNumber: Number(partNumber), etag });
});

router.post('/multipart/complete', async (c) => {
  const { key, uploadId, parts } = await c.req.json<{
    key: string; uploadId: string; parts: { partNumber: number; etag: string }[];
  }>();
  await c.var.storage.completeMultipartUpload(key, uploadId, parts);
  return c.json({ url: `/uploads/${key}` }, 201);
});

export default router;
