import { InternalServerErrorException, Module, Provider } from '@nestjs/common';
import { StorageConfig, StorageDriverName } from '../config/storage.config';
import { DatabaseModule } from '../database/database.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { STORAGE_DRIVER, StorageDriver } from './interfaces';
import {
  AppwriteStorageDriver,
  LocalStorageDriver,
  S3StorageDriver,
} from './drivers';

/**
 * Registry of available backends. Adding a provider means adding a driver class
 * that implements `StorageDriver`, a `StorageDriverName` entry, and one line
 * here — nothing else in the app changes.
 */
const STORAGE_DRIVERS: Record<
  StorageDriverName,
  new (config: StorageConfig) => StorageDriver
> = {
  [StorageDriverName.LOCAL]: LocalStorageDriver,
  [StorageDriverName.S3]: S3StorageDriver,
  [StorageDriverName.APPWRITE]: AppwriteStorageDriver,
};

/**
 * Resolves the single driver named by `STORAGE_DRIVER` at startup, so a
 * misconfigured backend fails fast instead of on the first upload.
 */
const storageDriverProvider: Provider = {
  provide: STORAGE_DRIVER,
  inject: [StorageConfig],
  useFactory: (config: StorageConfig): StorageDriver => {
    const Driver = STORAGE_DRIVERS[config.driver];

    if (!Driver) {
      throw new InternalServerErrorException(
        `Unknown STORAGE_DRIVER "${config.driver}". Supported: ${Object.keys(STORAGE_DRIVERS).join(', ')}`,
      );
    }
    return new Driver(config);
  },
};

@Module({
  imports: [DatabaseModule],
  controllers: [StorageController],
  providers: [storageDriverProvider, StorageService],
  exports: [StorageService, STORAGE_DRIVER],
})
export class StorageModule {}
