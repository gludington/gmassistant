import type { StorageAdapter } from '@gmassisstant/backend/storage/types';

export class R2Storage implements StorageAdapter {
  constructor(private bucket: R2Bucket) {}

  async put(key: string, body: ArrayBuffer, contentType?: string): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType: contentType ?? 'application/octet-stream' },
    });
  }

  async get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return {
      body: obj.body as ReadableStream<Uint8Array>,
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
