export interface StorageAdapter {
  put(key: string, body: ArrayBuffer, contentType?: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null>;
  delete(key: string): Promise<void>;
}
