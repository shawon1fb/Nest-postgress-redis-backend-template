import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Opts a handler out of the `{ success, statusCode, message, data }` envelope
 * applied by `TransformInterceptor`.
 *
 * Use it for routes that must return raw bytes — file downloads, streams,
 * CSV/PDF exports — where wrapping the payload would corrupt it. Document such
 * routes with a plain `@ApiResponse`, not the `ApiEnvelope*` decorators.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
