import { t } from '../i18n/t';
import { errorMessage } from '../api';
import type { LngLat } from '../model/trip';
import { counted } from '../ui/format';
import { placeNameAt } from './nominatim';

/** What is named: what it is called now, the positions it runs along, and how it takes a name. */
export interface Named {
  name: string;
  line: () => readonly LngLat[];
  rename: (name: string) => unknown;
}

/**
 * Names things after where they begin and end, as "Hockenheim - Walldorf", saying how
 * far it is. The answer says how many were named, counted as `noun`s, and which could not
 * be and why; the naming goes on past those. What bears that name already is left as it
 * is and counted.
 */
export async function autoname(things: readonly Named[], noun: string, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const errors: string[] = [];
  let named = 0;
  for (const [n, thing] of things.entries()) {
    onProgress(t('Renaming {i} of {n}: {name}', { i: n + 1, n: things.length, name: thing.name }));
    try {
      const line = thing.line();
      const from = line[0] && (await placeNameAt(line[0]));
      const to = from && (await placeNameAt(line.at(-1)!));
      if (!to) throw new Error(t('No place name found for its start or end.'));
      if (thing.name !== `${from} - ${to}`) await thing.rename(`${from} - ${to}`);
      named++;
    } catch (error) {
      errors.push(`${thing.name}: ${errorMessage(error)}`);
    }
  }
  return { text: named > 0 ? t('{what} renamed.', { what: counted(named, noun) }) : '', errors };
}
