import { I18nContext } from 'nestjs-i18n';
import {
  TranslationKey,
  TranslationNamespace,
} from '../../i18n/translation-keys';

const KEY_PATTERN = new RegExp(
  `^(${Object.values(TranslationNamespace).join('|')})\\.[a-z0-9_.]+$`,
);

/**
 * True when a string looks like a translation key (`users.not_found`) rather
 * than a human-readable message. Keeps literal messages working untouched.
 */
export const isTranslationKey = (value: string): boolean =>
  KEY_PATTERN.test(value);

/**
 * Translates a key into the language resolved for the current request.
 *
 * Falls back to the key itself outside a request context (queues, seeders,
 * unit tests) or when the key is missing from the locale files, so a missing
 * translation degrades to something readable instead of throwing.
 */
export function translate(
  key: TranslationKey,
  args?: Record<string, unknown>,
): string {
  const i18n = I18nContext.current();
  if (!i18n) {
    return key;
  }

  try {
    return i18n.t(key, { args });
  } catch {
    return key;
  }
}

/**
 * Edge translation used by `TransformInterceptor` and `GlobalExceptionFilter`:
 * translates values that look like keys, passes everything else through.
 *
 * This is what lets services stay i18n-free — they throw
 * `new NotFoundException(UsersMessage.NOT_FOUND)` and the envelope localizes
 * it. Accepts plain strings because exception messages arrive untyped, and
 * validation errors arrive as arrays.
 */
export function translateMessage<T extends string | string[]>(message: T): T {
  if (Array.isArray(message)) {
    return message.map((entry) => translateMessage(entry)) as T;
  }

  if (typeof message !== 'string' || !isTranslationKey(message)) {
    return message;
  }

  const translated = translate(message as TranslationKey);
  // nestjs-i18n echoes the key back when it is not found in the locale files.
  return (translated === message ? message : translated) as T;
}
