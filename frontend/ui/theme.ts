import { createSignal, type Accessor } from 'solid-js';
import { readPreference, writePreference } from './preferences';

/**
 * Light or dark by hand, or as the browser says. The choice is the document's own
 * `color-scheme`, which turns every `light-dark()` pair of the stylesheets at once; the
 * pages set it from the preference before their first paint (templates/theme.php), this
 * module from then on.
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
  // The document first, so that whatever follows the choice finds its colours turned.
  document.documentElement.style.colorScheme = choice === 'system' ? '' : choice;
  writePreference('theme', choice === 'system' ? undefined : choice);
  setTheme(choice);
}

/** Whether the browser asks for dark colours, followed from the first question on. */
let browserDark: Accessor<boolean> | undefined;

/** Whether the page shows dark colours: chosen by hand, or as the browser says, which can change while the page is open. */
export function showsDark(): boolean {
  if (!browserDark) {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const [dark, setDark] = createSignal(query.matches);
    query.addEventListener('change', (e) => setDark(e.matches));
    browserDark = dark;
  }
  return theme() === 'dark' || (theme() === 'system' && browserDark());
}
