import { Readable } from 'stream';

export interface StorageAdapter {
  /**
   * Stores a file buffer or stream under a secure, randomized storageKey.
   */
  putFile(storageKey: string, content: Buffer | Uint8Array, mimeType: string): Promise<void>;

  /**
   * Retrieves a readable stream for the specified storageKey.
   */
  getFileStream(storageKey: string): Promise<Readable>;

  /**
   * Retrieves the raw buffer for the specified storageKey.
   */
  getFileBuffer(storageKey: string): Promise<Buffer>;

  /**
   * Deletes a file from storage.
   */
  deleteFile(storageKey: string): Promise<void>;

  /**
   * Checks if a file exists in storage.
   */
  exists(storageKey: string): Promise<boolean>;
}
