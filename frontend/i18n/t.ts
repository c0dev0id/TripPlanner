import de from './de.json';
import { language, locale } from './language';

/**
 * Texts in the page's language: `t` takes the English text, which is the key of its German
 * in de.json, and fills `{name}` placeholders. A text without a German stays English.
 */

const dictionary: Readonly<Record<string, string>> = language === 'de' ? de : {};

/** The English texts shown as they are for lack of a German, collected while developing, where a check can read them from the window. */
export const missing = new Set<string>();
if (import.meta.env.DEV) (globalThis as { i18nMissing?: Set<string> }).i18nMissing = missing;

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function t(text: string, params?: Record<string, string | number>): string {
  const translated = dictionary[text];
  if (translated === undefined && language !== 'en' && import.meta.env.DEV) missing.add(text);
  return fill(translated ?? text, params);
}

const rules = new Intl.PluralRules(locale);

/** One of `forms`, "one|other" in English with `{n}` for the count, as the count calls for it in the page's language. */
export function plural(n: number, forms: string, params?: Record<string, string | number>): string {
  const [one, other] = t(forms).split('|');
  return fill(rules.select(n) === 'one' ? one! : (other ?? one!), { n, ...params });
}

/** The English plural of a noun as counted() writes it. */
const englishPlural = (noun: string): string => (/[^aeiou]y$/.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`);

/** A count with its noun in the right number: "1 trip", "3 trips"; the noun in English, as "trip|trips" in de.json. */
export const counted = (n: number, noun: string): string => `${n} ${plural(n, `${noun}|${englishPlural(noun)}`)}`;
