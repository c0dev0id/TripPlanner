import { readPreference, writePreference } from '../ui/preferences';

/**
 * The language of this page, decided once as it loads: the one chosen by hand, else German
 * for a browser that asks for it, else English. Changing the choice loads the page again,
 * so nothing written on the page has to follow a signal.
 */

export type Language = 'en' | 'de';

export const LANGUAGES: readonly { value: Language | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

const stored = readPreference('language');

/** The language chosen by hand, if any. */
export const languageChoice: Language | 'auto' = stored === 'de' || stored === 'en' ? stored : 'auto';

const browserLanguages = (): readonly string[] => (typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));

export const language: Language = languageChoice === 'auto' ? (browserLanguages().some((l) => l.toLowerCase().startsWith('de')) ? 'de' : 'en') : languageChoice;

/** The locale dates and numbers are written in: the browser's own while it picks the language, else the language chosen. */
export const locale: string | undefined = languageChoice === 'auto' ? undefined : languageChoice;

export function chooseLanguage(choice: Language | 'auto'): void {
  writePreference('language', choice === 'auto' ? undefined : choice);
  location.reload();
}
