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
  private multipartUploads = new Map<string, Map<number, Buffer>>();

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

  // Node has no request-body-size ceiling, so this is only exercised when
  // testing the web import flow's chunked-upload path against a local dev
  // server — not used by the desktop app's own (unchunked) import.
  async createMultipartUpload(_key: string, _contentType?: string): Promise<{ uploadId: string }> {
    const uploadId = crypto.randomUUID();
    this.multipartUploads.set(uploadId, new Map());
    return { uploadId };
  }

  async uploadPart(_key: string, uploadId: string, partNumber: number, body: ArrayBuffer): Promise<{ etag: string }> {
    const parts = this.multipartUploads.get(uploadId);
    if (!parts) throw new Error('Unknown multipart upload');
    parts.set(partNumber, Buffer.from(body));
    return { etag: String(partNumber) };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> {
    const stored = this.multipartUploads.get(uploadId);
    if (!stored) throw new Error('Unknown multipart upload');
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => {
      const buf = stored.get(p.partNumber);
      if (!buf) throw new Error(`Missing part ${p.partNumber}`);
      return buf;
    });
    const path = join(this.dir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.concat(ordered));
    this.multipartUploads.delete(uploadId);
  }
}
