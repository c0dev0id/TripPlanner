import { planeAt } from '../geo/measure';
import { nearestOnLines } from '../geo/nearest';
import type { LngLat } from '../model/trip';

/**
 * The places within reach of lines, such as a day's routes: each within the distance in
 * metres `reachM` gives for it. Measured on a flat map around the lines' first point,
 * which holds for a day's ride.
 */
export function placesNear<T extends { lngLat: LngLat }>(places: readonly T[], lines: readonly (readonly LngLat[])[], reachM: (place: T) => number): T[] {
  const origin = lines.find((line) => line.length > 0)?.[0];
  if (!origin) return [];
  const flat = planeAt(origin);
  const nearest = nearestOnLines(lines.map((line) => line.map(flat)));
  return places.filter((place) => nearest(flat(place.lngLat), reachM(place)) !== undefined);
}
