import type { LngLat, Profile, RoutedLeg } from '../model/trip';

/** FOSSGIS OSRM servers: one request per second at most, see routing.openstreetmap.de/about.html. */
const ROUTING_URL = 'https://routing.openstreetmap.de';
export const ROUTING_ATTRIBUTION =
  'Routing: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS OSRM</a>';
/** Milliseconds between routing requests: FOSSGIS allows at most one request per second. */
export const ROUTING_MIN_INTERVAL_MS = 1100;
const ROUTING_TIMEOUT_MS = 15_000;

/** OSRM route request for one leg on the FOSSGIS servers (profile selected by path). */
export function routeUrl(profile: Profile, from: LngLat, to: LngLat): string {
  return `${ROUTING_URL}/routed-${profile}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=polyline6`;
}

/** The first route's polyline6 geometry, length and riding time, or throws with the server's message. */
export function parseRouteResponse(data: unknown): RoutedLeg {
  if (typeof data === 'object' && data !== null && 'code' in data) {
    const response = data as { code: unknown; message?: unknown; routes?: { geometry?: unknown; distance?: unknown; duration?: unknown }[] };
    const route = response.routes?.[0];
    if (response.code === 'Ok' && typeof route?.geometry === 'string') {
      return {
        geometry: route.geometry,
        distanceM: Math.round(typeof route.distance === 'number' ? route.distance : 0),
        durationS: Math.round(typeof route.duration === 'number' ? route.duration : 0),
      };
    }
    throw new Error(typeof response.message === 'string' ? response.message : `Routing failed (${String(response.code)}).`);
  }
  throw new Error('Unexpected answer from the routing server.');
}

/** Routes one leg; rejects on network errors, timeouts and routing errors. */
export async function fetchLeg(leg: { profile: Profile; from: LngLat; to: LngLat }, fetchFn: typeof fetch = fetch): Promise<RoutedLeg> {
  const response = await fetchFn(routeUrl(leg.profile, leg.from, leg.to), {
    signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The routing server answered with status ${response.status}.`);
  }
  return parseRouteResponse(data);
}
