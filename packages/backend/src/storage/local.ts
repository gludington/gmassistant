import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { StorageAdapter } from './types.js';

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
  flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm',
  mp4: 'audio/mp4', opus: 'audio/opus', wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff', aif: 'audio/aiff',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
};

export class LocalStorage implements StorageAdapter {
  constructor(private dir: string) {}

  async put(key: string, body: ArrayBuffer, _contentType?: string): Promise<void> {
    const path = join(this.dir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(body));
  }

  async get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null> {
    try {
      const data = await readFile(join(this.dir, key));
      const ext = key.split('.').pop()?.toLowerCase() ?? '';
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });
      return { body: stream, contentType: MIME[ext] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.dir, key));
    } catch {}
  }
}
