/**
 * Preferences of this browser, kept in localStorage: the base map and the theme. Storage
 * may be refused (private windows, blocked site data), in which case nothing is kept and
 * nothing breaks.
 */

const PREFIX = 'planner.';

export function readPreference(key: string): string | undefined {
  try {
    return localStorage.getItem(PREFIX + key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Keeps the value, or forgets the preference for undefined. */
export function writePreference(key: string, value: string | undefined): void {
  try {
    if (value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Not kept; the choice holds for this page.
  }
}
