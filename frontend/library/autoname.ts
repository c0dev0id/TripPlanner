import { t } from '../i18n/t';
import { errorMessage, renameRide } from '../api';
import { nominatimTurn, parsePlaceName, reverseUrl } from '../map/nominatim';
import type { LngLat } from '../model/trip';
import type { Ride } from '../recording/rides';
import { decodePolyline } from '../routing/polyline';
import { counted } from '../ui/format';

const TIMEOUT_MS = 15_000;

/** The places asked for, by position to some hundred metres, kept while the page stands: many rides begin where others began. */
const places = new Map<string, string | undefined>();

/** The town, city or village a position is in, as Nominatim names it; none where it knows no place. */
async function placeAt(lngLat: LngLat): Promise<string | undefined> {
  const key = lngLat.map((value) => value.toFixed(3)).join(',');
  if (!places.has(key)) {
    await nominatimTurn();
    const response = await fetch(reverseUrl(lngLat), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    places.set(key, parsePlaceName(await response.json()));
  }
  return places.get(key);
}

/**
 * Names rides after where they began and ended, as "Hockenheim - Walldorf", saying how
 * far it is. The answer says how many were named, and which could not be and why; the
 * naming goes on past those.
 */
export async function autoname(rides: readonly Ride[], onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const errors: string[] = [];
  let named = 0;
  for (const [n, ride] of rides.entries()) {
    onProgress(t('Naming {i} of {n}: {name}', { i: n + 1, n: rides.length, name: ride.name }));
    try {
      const line = decodePolyline(ride.line);
      const from = line[0] && (await placeAt(line[0]));
      const to = from && (await placeAt(line.at(-1)!));
      if (!to) throw new Error(t('No place is known where it begins or ends.'));
      if (ride.name !== `${from} - ${to}`) await renameRide(ride.id, `${from} - ${to}`);
      named++;
    } catch (error) {
      errors.push(`${ride.name}: ${errorMessage(error)}`);
    }
  }
  return { text: named > 0 ? t('{what} named.', { what: counted(named, 'ride') }) : '', errors };
}
