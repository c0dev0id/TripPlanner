import type { LngLat } from '../model/trip';
import type { XY } from './nearest';

/** The Earth's mean radius in metres. */
const EARTH_RADIUS = 6_371_008.8;

/** Metres per degree of latitude; longitudes are scaled by the cosine of the latitude. */
export const METRES_PER_DEGREE = (2 * Math.PI * EARTH_RADIUS) / 360;

/** A flat map in metres around a position; within a day's extent the scale stays within a percent. */
export function planeAt([lng0, lat0]: LngLat): (p: LngLat) => XY {
  const scale = Math.cos((lat0 * Math.PI) / 180);
  return ([lng, lat]) => [(lng - lng0) * scale * METRES_PER_DEGREE, (lat - lat0) * METRES_PER_DEGREE];
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The great-circle distance between two points in metres. */
export function distanceBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const h = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The metres along each line so far, by the line, which is never changed in place: a decoded track is measured once while it is kept. */
const measured = new WeakMap<readonly LngLat[], Float64Array>();

/** The metres from the start of the line to each of its points. */
export function metresAlong(line: readonly LngLat[]): Float64Array {
  let along = measured.get(line);
  if (!along) {
    along = new Float64Array(line.length);
    for (let i = 1; i < line.length; i++) along[i] = along[i - 1]! + distanceBetween(line[i - 1]!, line[i]!);
    measured.set(line, along);
  }
  return along;
}

/** The length of a line in metres. */
export const lineLength = (line: readonly LngLat[]): number => metresAlong(line).at(-1) ?? 0;

/**
 * The line in stretches of at most about `metres`, each beginning at the point the one
 * before ends at; a segment longer than that is a stretch of its own.
 */
export function stretchesOf(line: readonly LngLat[], metres: number): LngLat[][] {
  const along = metresAlong(line);
  const stretches: LngLat[][] = [];
  let first = 0;
  for (let i = 1; i < line.length; i++) {
    if (i === line.length - 1 || along[i + 1]! - along[first]! > metres) {
      stretches.push(line.slice(first, i + 1));
      first = i;
    }
  }
  return stretches;
}
