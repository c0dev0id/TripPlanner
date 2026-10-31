import { takesMotorwayDial, type Highways, type LngLat, type RoutedLeg } from '../model/trip';
import type { Costing, RoadLeg } from './legs';

/** The FOSSGIS Valhalla server: one request per second at most, see fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen. */
const ROUTING_URL = 'https://valhalla1.openstreetmap.de/route';
const MATCHING_URL = 'https://valhalla1.openstreetmap.de/trace_attributes';
export const ROUTING_ATTRIBUTION =
  'Routing: <a href="https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/" target="_blank" rel="noopener">FOSSGIS Valhalla</a>';
/** Milliseconds between routing requests: FOSSGIS allows at most one request per second. */
export const ROUTING_MIN_INTERVAL_MS = 1100;
const ROUTING_TIMEOUT_MS = 15_000;

let nextTurn = 0;

/** Waits for this page's next turn at the server, which takes one request per ROUTING_MIN_INTERVAL_MS whatever asks: routing or matching. */
export async function valhallaTurn(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextTurn);
  nextTurn = at + ROUTING_MIN_INTERVAL_MS;
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}

/** The motorway dial as Valhalla's `use_highways`: 0 avoids, 1 favours. */
const USE_HIGHWAYS: Record<Highways, number> = { avoid: 0, allow: 0.5, prefer: 1 };

export type LegRequest = Costing & Pick<RoadLeg, 'from' | 'to'>;

/** The request for one leg: both ends, the profile as the costing, and for the motorcycle the motorway dial. */
export function routeRequest(leg: LegRequest) {
  return {
    locations: [
      { lon: leg.from[0], lat: leg.from[1] },
      { lon: leg.to[0], lat: leg.to[1] },
    ],
    costing: leg.profile,
    costing_options: takesMotorwayDial(leg.profile) ? { motorcycle: { use_highways: USE_HIGHWAYS[leg.highways] } } : undefined,
    units: 'kilometers',
  };
}

/** The trip's polyline6 shape, length and riding time, or throws with the server's message. */
export function parseRouteResponse(data: unknown): RoutedLeg {
  if (typeof data !== 'object' || data === null) throw new Error('Unexpected answer from the routing server.');
  const response = data as { error?: unknown; error_code?: unknown; trip?: { summary?: { length?: unknown; time?: unknown }; legs?: { shape?: unknown }[] } };
  const shape = response.trip?.legs?.[0]?.shape;
  if (typeof shape === 'string') {
    const summary = response.trip!.summary;
    return {
      geometry: shape,
      distanceM: Math.round(typeof summary?.length === 'number' ? summary.length * 1000 : 0),
      durationS: Math.round(typeof summary?.time === 'number' ? summary.time : 0),
    };
  }
  throw new Error(typeof response.error === 'string' ? response.error : `Routing failed (${String(response.error_code ?? 'no route')}).`);
}

/** Routes one leg; rejects on network errors, timeouts and routing errors. */
export async function fetchLeg(leg: LegRequest, fetchFn: typeof fetch = fetch): Promise<RoutedLeg> {
  const response = await fetchFn(ROUTING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(routeRequest(leg)),
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

/** Points matched per request, well within what the server matches at once. */
const MATCHING_CHUNK = 1000;

/** The surfaces of the roads a stretch of track runs on, a point each: null where the point matched no road. */
async function matchSurfaces(points: readonly LngLat[], fetchFn: typeof fetch): Promise<(string | null)[]> {
  const response = await fetchFn(MATCHING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shape: points.map(([lon, lat]) => ({ lat, lon })),
      costing: 'motorcycle',
      shape_match: 'map_snap',
      filters: { attributes: ['edge.surface', 'matched.edge_index', 'matched.type'], action: 'include' },
    }),
    signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS * 2),
  });
  const data = (await response.json()) as { error?: unknown; edges?: { surface?: string }[]; matched_points?: { edge_index?: number; type?: string }[] };
  const matched = data.matched_points;
  if (!matched) throw new Error(typeof data.error === 'string' ? data.error : 'No road matched.');
  return points.map((_, i) => {
    const point = matched[i];
    return !point || point.type === 'unmatched' || point.edge_index === undefined ? null : (data.edges?.[point.edge_index]?.surface ?? null);
  });
}

/**
 * The surface of the road under each point of a track, as the server matches the track to
 * OpenStreetMap's roads (paved_smooth, paved, paved_rough, compacted, dirt, gravel, path,
 * impassable): asked in pieces of MATCHING_CHUNK points, each on its turn; a piece that
 * fails leaves its points without a surface (null). Throws where every piece failed.
 */
export async function fetchSurfaces(points: readonly LngLat[], fetchFn: typeof fetch = fetch, turn = valhallaTurn): Promise<(string | null)[]> {
  const surfaces: (string | null)[] = [];
  let failure: unknown;
  let matchedAny = false;
  for (let start = 0; start < points.length; start += MATCHING_CHUNK) {
    const piece = points.slice(start, start + MATCHING_CHUNK);
    await turn();
    try {
      surfaces.push(...(await matchSurfaces(piece, fetchFn)));
      matchedAny = true;
    } catch (fault) {
      failure ??= fault;
      surfaces.push(...piece.map(() => null));
    }
  }
  if (!matchedAny && failure !== undefined) throw failure;
  return surfaces;
}
