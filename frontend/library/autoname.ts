import { t } from '../i18n/t';
import { errorMessage, renameRide } from '../api';
import { placeNameAt } from '../map/nominatim';
import type { Ride } from '../recording/rides';
import { decodePolyline } from '../routing/polyline';
import { counted } from '../ui/format';

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
      const from = line[0] && (await placeNameAt(line[0]));
      const to = from && (await placeNameAt(line.at(-1)!));
      if (!to) throw new Error(t('No place is known where it begins or ends.'));
      if (ride.name !== `${from} - ${to}`) await renameRide(ride.id, `${from} - ${to}`);
      named++;
    } catch (error) {
      errors.push(`${ride.name}: ${errorMessage(error)}`);
    }
  }
  return { text: named > 0 ? t('{what} named.', { what: counted(named, 'ride') }) : '', errors };
}
