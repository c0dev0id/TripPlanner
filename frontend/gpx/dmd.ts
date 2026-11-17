import type { LngLat } from '../model/trip';
import { children } from './xml';

/**
 * What DMD's planner writes into a route it calculated (`dmd:PreRendered`, see
 * https://docs.dmdnavigation.com/dev/gpx-extension/). Of it the way is read; its turn
 * instructions, surfaces, timings and warnings are not.
 */

/** The version of what is written that is read here; a later one is left to the routing. */
const VERSION = '1';

/** The hash DMD's planner gives what it calculated, which is of the route's points and the profile: the same for as long as they are the ones it calculated for. */
export async function dmdHash(points: readonly LngLat[], profile: string): Promise<string> {
  const text = `${points.map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join(';')};profile=${profile}`;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return `sha256:${[...digest.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** The way DMD's planner calculated for the route as a whole, its points as `lat,lon,ele` with a semicolon between; none where it calculated for other points than the route has now, or wrote none. */
export async function dmdWay(rte: Element, points: readonly LngLat[]): Promise<LngLat[]> {
  const [written] = children(rte, 'extensions').flatMap((e) => children(e, 'PreRendered'));
  const [calculated] = written ? children(written, 'CalculatedRoute') : [];
  if (!calculated || written!.getAttribute('version') !== VERSION || written!.getAttribute('hash') !== (await dmdHash(points, written!.getAttribute('profile') ?? ''))) return [];
  return (calculated.textContent ?? '').split(';').flatMap((point) => {
    const [lat, lng] = point.split(',').map(Number);
    return point.includes(',') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat!) <= 90 ? [[lng!, lat!] as LngLat] : [];
  });
}
