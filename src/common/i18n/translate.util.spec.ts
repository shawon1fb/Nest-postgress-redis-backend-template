import { I18nContext } from 'nestjs-i18n';
import {
  isTranslationKey,
  translate,
  translateMessage,
} from './translate.util';
import { CommonMessage, StorageMessage, UsersMessage } from '../i18n';

describe('translate utils', () => {
  afterEach(() => jest.restoreAllMocks());

  /** Stands in for the per-request I18nContext nestjs-i18n installs. */
  const mockContext = (
    translations: Record<string, string>,
    onCall?: jest.Mock,
  ) => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: (key: string, options?: { args?: Record<string, unknown> }) => {
        onCall?.(key, options);
        const value = translations[key];
        if (value === undefined) {
          // nestjs-i18n echoes unknown keys back.
          return key;
        }
        return Object.entries(options?.args ?? {}).reduce(
          (text, [name, arg]) => text.replace(`{${name}}`, String(arg)),
          value,
        );
      },
    } as unknown as I18nContext);
  };

  describe('isTranslationKey', () => {
    it('recognises namespaced keys', () => {
      expect(isTranslationKey(UsersMessage.NOT_FOUND)).toBe(true);
      expect(isTranslationKey(CommonMessage.SUCCESS)).toBe(true);
    });

    it('rejects human-readable messages and unknown namespaces', () => {
      expect(isTranslationKey('User not found')).toBe(false);
      expect(isTranslationKey('billing.not_found')).toBe(false);
      expect(isTranslationKey('Invalid sort field: createdAt')).toBe(false);
    });
  });

  describe('translate', () => {
    it('returns the key when there is no request context', () => {
      jest.spyOn(I18nContext, 'current').mockReturnValue(undefined);

      expect(translate(UsersMessage.NOT_FOUND)).toBe(UsersMessage.NOT_FOUND);
    });

    it('resolves the message for the active language', () => {
      mockContext({ [UsersMessage.NOT_FOUND]: 'ব্যবহারকারী পাওয়া যায়নি' });

      expect(translate(UsersMessage.NOT_FOUND)).toBe(
        'ব্যবহারকারী পাওয়া যায়নি',
      );
    });

    it('interpolates arguments', () => {
      mockContext({
        [StorageMessage.FILE_TOO_LARGE]: 'Max {maxSize} bytes',
      });

      expect(translate(StorageMessage.FILE_TOO_LARGE, { maxSize: 1024 })).toBe(
        'Max 1024 bytes',
      );
    });
  });

  describe('translateMessage', () => {
    it('translates keys and leaves literal messages alone', () => {
      mockContext({ [CommonMessage.SUCCESS]: 'সফল হয়েছে' });

      expect(translateMessage(CommonMessage.SUCCESS)).toBe('সফল হয়েছে');
      expect(translateMessage('Something already localized')).toBe(
        'Something already localized',
      );
    });

    it('falls back to the key when the locale file lacks it', () => {
      mockContext({});

      expect(translateMessage(UsersMessage.DELETED)).toBe(UsersMessage.DELETED);
    });

    it('translates each entry of a validation error array', () => {
      mockContext({ [UsersMessage.PASSWORD_MISMATCH]: 'মিলছে না' });

      expect(
        translateMessage([UsersMessage.PASSWORD_MISMATCH, 'email must be set']),
      ).toEqual(['মিলছে না', 'email must be set']);
    });

    it('never calls the translator for non-key strings', () => {
      const onCall = jest.fn();
      mockContext({}, onCall);

      translateMessage('A plain sentence with a . dot');

      expect(onCall).not.toHaveBeenCalled();
    });
  });
});
