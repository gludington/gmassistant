import { Hono } from 'hono';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const router = new Hono();

const UPLOADS_DIR = join(process.cwd(), 'uploads');

router.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext)) {
    return c.json({ error: 'Unsupported file type' }, 400);
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  await writeFile(join(UPLOADS_DIR, filename), Buffer.from(buffer));

  return c.json({ url: `/uploads/${filename}` }, 201);
});

export default router;
