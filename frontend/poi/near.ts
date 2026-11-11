import { planeAt } from '../geo/measure';
import { nearestOnLines } from '../geo/nearest';
import type { LngLat } from '../model/trip';
import type { Place, PoiCategoryId } from './categories';

/**
 * The places within reach of lines, such as a day's routes: each kind within its own
 * distance in metres. Measured on a flat map around the lines' first point, which holds for
 * a day's ride.
 */
export function placesNear(places: readonly Place[], lines: readonly (readonly LngLat[])[], reachM: (kind: PoiCategoryId) => number): Place[] {
  const origin = lines.find((line) => line.length > 0)?.[0];
  if (!origin) return [];
  const flat = planeAt(origin);
  const nearest = nearestOnLines(lines.map((line) => line.map(flat)));
  return places.filter((place) => nearest(flat(place.lngLat), reachM(place.category.id)) !== undefined);
}
