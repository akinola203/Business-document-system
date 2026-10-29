import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { StorageAdapter } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageAdapter, OnModuleInit {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly rootUploadDir: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const configuredPath =
      this.configService?.get<string>('STORAGE_UPLOAD_DIR') ||
      process.env.STORAGE_UPLOAD_DIR ||
      path.join(process.cwd(), 'storage', 'secure-uploads');
    this.rootUploadDir = path.resolve(configuredPath);
  }

  onModuleInit() {
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(dir: string = this.rootUploadDir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.log(`Created secure upload storage directory at: ${dir}`);
    }
  }

  /**
   * Safely resolves and validates that a storageKey does not escape the root storage directory.
   */
  private resolvePath(storageKey: string): string {
    // Immediate anti-traversal check
    if (storageKey.includes('..') || path.isAbsolute(storageKey)) {
      throw new Error(`Invalid storage path traversal for key: ${storageKey}`);
    }

    const normalizedRoot = path.resolve(this.rootUploadDir);
    const resolved = path.resolve(normalizedRoot, storageKey);
    const rootWithSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
    if (!resolved.startsWith(rootWithSep) && resolved !== normalizedRoot) {
      throw new Error(`Invalid storage path traversal for key: ${storageKey}`);
    }
    return resolved;
  }

  async putFile(storageKey: string, content: Buffer | Uint8Array, _mimeType: string): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, content);
  }

  async getFileStream(storageKey: string): Promise<Readable> {
    const filePath = this.resolvePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File with storage key "${storageKey}" not found on disk.`);
    }
    return fs.createReadStream(filePath);
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const filePath = this.resolvePath(storageKey);
    return fs.promises.readFile(filePath);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = this.resolvePath(storageKey);
    return fs.existsSync(filePath);
  }
}
