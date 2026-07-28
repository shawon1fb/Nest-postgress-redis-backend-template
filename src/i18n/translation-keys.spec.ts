import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  AuthMessage,
  CommonMessage,
  StorageMessage,
  TranslationNamespace,
  UsersMessage,
} from './translation-keys';

const LOCALES_DIR = __dirname;

const allKeys = [
  ...Object.values(CommonMessage),
  ...Object.values(AuthMessage),
  ...Object.values(UsersMessage),
  ...Object.values(StorageMessage),
];

const localeDirectories = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const loadNamespace = (language: string, namespace: string) =>
  JSON.parse(
    readFileSync(join(LOCALES_DIR, language, `${namespace}.json`), 'utf8'),
  ) as Record<string, string>;

describe('translation keys', () => {
  it('ships at least the fallback language', () => {
    expect(localeDirectories).toContain('en');
  });

  describe.each(localeDirectories)('%s locale', (language) => {
    it('has a file for every namespace', () => {
      const files = readdirSync(join(LOCALES_DIR, language));

      for (const namespace of Object.values(TranslationNamespace)) {
        expect(files).toContain(`${namespace}.json`);
      }
    });

    it('defines a non-empty message for every enum key', () => {
      const missing = allKeys.filter((key) => {
        const [namespace, name] = key.split('.');
        const messages = loadNamespace(language, namespace);
        return !messages[name]?.trim();
      });

      expect(missing).toEqual([]);
    });

    it('has no entries that are absent from the enums', () => {
      const declared = new Set<string>(allKeys);
      const orphans: string[] = [];

      for (const namespace of Object.values(TranslationNamespace)) {
        for (const name of Object.keys(loadNamespace(language, namespace))) {
          const key = `${namespace}.${name}`;
          if (!declared.has(key)) {
            orphans.push(key);
          }
        }
      }

      expect(orphans).toEqual([]);
    });
  });
});
