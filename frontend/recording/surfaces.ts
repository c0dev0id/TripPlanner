import type { LngLat } from '../model/trip';
import { fetchSurfaces } from '../routing/valhalla';

/** Points of a track closer than this to the last one matched are not matched themselves: surfaces change over longer stretches, and the server's work grows with the points. */
const SPACING_M = 50;

/** The surface under each point of a track, as the routing server matches it to the roads; a point between those matched takes the surface of the one before it. */
export async function trackSurfaces(points: readonly LngLat[], distance: Float64Array, match = fetchSurfaces): Promise<(string | null)[]> {
  const kept: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (kept.length === 0 || i === points.length - 1 || distance[i]! - distance[kept.at(-1)!]! >= SPACING_M) kept.push(i);
  }
  const matched = await match(kept.map((i) => points[i]!));
  const surfaces: (string | null)[] = [];
  let k = 0;
  for (let i = 0; i < points.length; i++) {
    if (k + 1 < kept.length && kept[k + 1]! <= i) k++;
    surfaces.push(matched[k] ?? null);
  }
  return surfaces;
}
