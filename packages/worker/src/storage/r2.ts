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

  async createMultipartUpload(key: string, contentType?: string): Promise<{ uploadId: string }> {
    const upload = await this.bucket.createMultipartUpload(key, {
      httpMetadata: { contentType: contentType ?? 'application/octet-stream' },
    });
    return { uploadId: upload.uploadId };
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: ArrayBuffer): Promise<{ etag: string }> {
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, body);
    return { etag: part.etag };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> {
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    await upload.complete(parts);
  }
}
