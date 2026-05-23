import { Hono } from 'hono';
import type { AppVariables } from '../types.js';

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

export default router;
