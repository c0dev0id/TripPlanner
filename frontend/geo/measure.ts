import type { LngLat } from '../model/trip';

/** The Earth's mean radius in metres. */
const EARTH_RADIUS = 6_371_008.8;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The great-circle distance between two points in metres. */
export function distanceBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const h = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}
