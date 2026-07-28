import { Configuration, Value } from '@itgorillaz/configify';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { toBoolean } from './parsers';

@Configuration()
export class I18nConfig {
  /** Language used when the client sends nothing, or an unsupported code. */
  @IsNotEmpty()
  @IsString()
  @Value('I18N_FALLBACK_LANGUAGE', { default: 'en' })
  fallbackLanguage: string;

  /**
   * Request header carrying the language code, e.g. `x-lang: bn`.
   * `Accept-Language` is honoured too, at lower priority.
   */
  @IsNotEmpty()
  @IsString()
  @Value('I18N_HEADER_NAME', { default: 'x-lang' })
  headerName: string;

  /** Comma-separated locales that ship with the app. */
  @IsNotEmpty()
  @IsString()
  @Value('I18N_SUPPORTED_LANGUAGES', { default: 'en,bn' })
  supportedLanguages: string;

  /** Reload translations from disk on change. Development convenience. */
  @IsBoolean()
  @Value('I18N_WATCH', { default: false, parse: toBoolean })
  watch: boolean;

  get supportedLanguageList(): string[] {
    return this.supportedLanguages
      .split(',')
      .map((language) => language.trim())
      .filter(Boolean);
  }
}
