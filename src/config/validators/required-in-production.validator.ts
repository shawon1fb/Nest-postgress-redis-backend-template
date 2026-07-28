import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Fails validation when `NODE_ENV=production` and the named environment
 * variable was not set explicitly.
 *
 * Use it on config fields that carry a convenient development default which
 * would be wrong — and silently wrong — in production. Configify does not write
 * defaults back into `process.env`, so an absent variable there reliably means
 * "the default was used".
 *
 * ```ts
 * @RequiredInProduction('STORAGE_DRIVER')
 * @Value('STORAGE_DRIVER', { default: StorageDriverName.LOCAL })
 * driver: StorageDriverName;
 * ```
 */
export function RequiredInProduction(
  envVar: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'requiredInProduction',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(): boolean {
          if (!isProductionEnvironment()) {
            return true;
          }
          const raw = process.env[envVar];
          return raw !== undefined && raw.trim() !== '';
        },
        defaultMessage(): string {
          return `${envVar} must be set explicitly when NODE_ENV=production; the development default is not safe to inherit`;
        },
      },
    });
  };
}

/**
 * Read straight from `process.env` rather than `AppConfig`: validators run
 * while configuration is still being resolved, so no other config class is
 * guaranteed to exist yet.
 */
function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV?.trim().toLowerCase() === 'production';
}
