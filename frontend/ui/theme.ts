import { createSignal } from 'solid-js';
import { readPreference, writePreference } from './preferences';

/**
 * Light or dark by hand, or as the browser says. The choice is a `data-theme` attribute
 * on the document that the stylesheets turn into a colour scheme; the pages set it from
 * the preference before their first paint (templates/theme.php), this module from then on.
 */

export type Theme = 'system' | 'light' | 'dark';

export const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const stored = readPreference('theme');
const [theme, setTheme] = createSignal<Theme>(stored === 'light' || stored === 'dark' ? stored : 'system');
export { theme };

export function chooseTheme(choice: Theme): void {
  setTheme(choice);
  writePreference('theme', choice === 'system' ? undefined : choice);
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}
