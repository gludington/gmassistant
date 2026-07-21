export interface StorageAdapter {
  put(key: string, body: ArrayBuffer, contentType?: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null>;
  delete(key: string): Promise<void>;

  // Multipart upload — for individual files too large for a single request
  // body (see routes/uploads.ts's /multipart/* routes). Desktop's LocalStorage
  // implements these too so the web import flow can be tested locally, but
  // Electron's own import path never calls them.
  createMultipartUpload(key: string, contentType?: string): Promise<{ uploadId: string }>;
  uploadPart(key: string, uploadId: string, partNumber: number, body: ArrayBuffer): Promise<{ etag: string }>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void>;
}
