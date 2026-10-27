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
