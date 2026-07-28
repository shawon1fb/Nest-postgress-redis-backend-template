import { createReadStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';
import { Readable } from 'stream';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StorageConfig, StorageDriverName } from '../../config/storage.config';
import {
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from '../interfaces/storage-driver.interface';
import { StorageMessage } from '../../common/i18n';

/**
 * Writes to the local filesystem under `STORAGE_LOCAL_ROOT`.
 *
 * Suitable for development and single-node deployments — objects live on one
 * machine's disk, so it does not survive horizontal scaling or ephemeral
 * containers.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  readonly name = StorageDriverName.LOCAL;

  /** Serves plain public URLs built from STORAGE_LOCAL_BASE_URL. */
  readonly urlsArePermanent = true;

  private readonly root: string;

  constructor(private readonly config: StorageConfig) {
    this.root = resolve(config.localRoot);
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const path = this.resolveKey(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);

    return { key: input.key, size: input.body.length, providerId: null };
  }

  async get(key: string): Promise<Readable> {
    const path = this.resolveKey(key);
    if (!(await this.pathExists(path))) {
      throw new NotFoundException(StorageMessage.FILE_NOT_FOUND);
    }
    return createReadStream(path);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    return this.pathExists(this.resolveKey(key));
  }

  url(key: string): Promise<string> {
    const base = this.config.localBaseUrl.replace(/\/+$/, '');
    if (!base) {
      throw new InternalServerErrorException(
        'STORAGE_LOCAL_BASE_URL is not configured, cannot build a file URL',
      );
    }
    return Promise.resolve(`${base}/${key}`);
  }

  /**
   * Joins the key onto the storage root and refuses anything that escapes it,
   * so a crafted key like `../../etc/passwd` cannot read or write outside the
   * configured directory.
   */
  private resolveKey(key: string): string {
    const path = resolve(join(this.root, normalize(key)));
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new NotFoundException(StorageMessage.FILE_NOT_FOUND);
    }
    return path;
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      const stats = await stat(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}
