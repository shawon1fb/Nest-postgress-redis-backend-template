/**
 * Every translatable message, as an enum member whose value is the lookup key
 * into `src/i18n/<lang>/<namespace>.json`.
 *
 * Nothing in application code should spell a key out as a string literal —
 * throw `new NotFoundException(UsersMessage.NOT_FOUND)` instead, so a renamed
 * or deleted key fails at compile time rather than silently shipping an
 * untranslated string to clients.
 *
 * Adding a message means adding a member here plus the matching entry in every
 * locale file.
 */

/** One namespace per JSON file inside each locale directory. */
export enum TranslationNamespace {
  COMMON = 'common',
  AUTH = 'auth',
  USERS = 'users',
  STORAGE = 'storage',
}

export enum CommonMessage {
  SUCCESS = 'common.success',
  INTERNAL_ERROR = 'common.internal_error',
  UNAUTHORIZED = 'common.unauthorized',
  FORBIDDEN = 'common.forbidden',
  NOT_FOUND = 'common.not_found',
  VALIDATION_FAILED = 'common.validation_failed',
}

export enum AuthMessage {
  INVALID_CREDENTIALS = 'auth.invalid_credentials',
  ACCOUNT_LOCKED = 'auth.account_locked',
  ACCOUNT_DEACTIVATED = 'auth.account_deactivated',
  INVALID_REFRESH_TOKEN = 'auth.invalid_refresh_token',
  LOGGED_OUT = 'auth.logged_out',
  PASSWORD_RESET_SENT = 'auth.password_reset_sent',
  PASSWORD_RESET_SUCCESS = 'auth.password_reset_success',
  INVALID_RESET_TOKEN = 'auth.invalid_reset_token',
}

export enum UsersMessage {
  NOT_FOUND = 'users.not_found',
  EMAIL_EXISTS = 'users.email_exists',
  USERNAME_EXISTS = 'users.username_exists',
  EMAIL_OR_USERNAME_EXISTS = 'users.email_or_username_exists',
  PASSWORD_CHANGED = 'users.password_changed',
  PASSWORD_MISMATCH = 'users.password_mismatch',
  CURRENT_PASSWORD_INCORRECT = 'users.current_password_incorrect',
  DELETED = 'users.deleted',
  ACCOUNT_DEACTIVATED = 'users.account_deactivated',
}

export enum StorageMessage {
  FILE_NOT_FOUND = 'storage.file_not_found',
  NO_FILE_UPLOADED = 'storage.no_file_uploaded',
  MULTIPART_REQUIRED = 'storage.multipart_required',
  EMPTY_FILE = 'storage.empty_file',
  FILE_TOO_LARGE = 'storage.file_too_large',
  MIME_NOT_ALLOWED = 'storage.mime_not_allowed',
  DELETED = 'storage.deleted',
  INVALID_EXPIRES_IN = 'storage.invalid_expires_in',
  FILE_FIELD_MISSING = 'storage.file_field_missing',
  FILE_TOO_LARGE_LIMIT = 'storage.file_too_large_limit',
}

/** Union of every message enum, for helpers that accept any key. */
export type TranslationKey =
  | CommonMessage
  | AuthMessage
  | UsersMessage
  | StorageMessage;
