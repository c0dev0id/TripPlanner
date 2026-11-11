import { METRES_PER_DEGREE, stretchesOf } from '../geo/measure';
import { keepTolerances } from '../geo/simplify';
import { t } from '../i18n/t';
import type { LngLat } from '../model/trip';
import { categoryOf, type PoiCategory } from './categories';

/**
 * Places of the POI categories from OpenStreetMap, asked of the Overpass API
 * (wiki.openstreetmap.org/wiki/Overpass_API) around a spot or along lines.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_ATTRIBUTION = t('POI: Overpass API, © OpenStreetMap contributors');
/** Seconds the server may take before it gives up on a query. */
const TIMEOUT_S = 60;
/** The most places of one category a query answers with, so that many of one kind leave room for the others. */
const KIND_LIMIT = 500;
/** Lines are asked for in stretches of this length, a query each: one query along a day's ride runs out of time. */
const STRETCH_M = 50_000;
/** The pause between two queries of a search, and the wait before a query that ran out of time is sent again. */
const PAUSE_MS = 1000;
const RETRY_AFTER_MS = 5000;
/** How often a query that ran out of time is sent again before the search gives up. */
const RETRIES = 3;

/** A category to look for, and how far from the spot or the lines, in metres. */
export interface PoiReach {
  category: PoiCategory;
  metres: number;
}

/** Where to look: around a spot, or along lines such as a day's routes. */
export type PoiArea = { spot: LngLat } | { lines: readonly (readonly LngLat[])[] };

export interface Poi {
  /** The OpenStreetMap object, as "node/123". */
  id: string;
  category: PoiCategory;
  lngLat: LngLat;
  tags: Readonly<Record<string, string>>;
}

const latLng = ([lng, lat]: LngLat): string => `${lat.toFixed(5)},${lng.toFixed(5)}`;

/**
 * The box around the positions and everything within `metres` of them, as Overpass names
 * one: south, west, north, east.
 */
function boxAround(positions: readonly LngLat[], metres: number): string {
  const lngs = positions.map((p) => p[0]);
  const lats = positions.map((p) => p[1]);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const dLat = metres / METRES_PER_DEGREE;
  // A degree of longitude is shortest at the box's edge nearest a pole.
  const dLng = dLat / Math.cos(((Math.max(Math.abs(south), Math.abs(north)) + dLat) * Math.PI) / 180);
  return [south - dLat, Math.min(...lngs) - dLng, north + dLat, Math.max(...lngs) + dLng].map((degrees) => degrees.toFixed(5)).join(',');
}

/**
 * The query for the places of each category within its reach of the area, answered as JSON
 * with a position for each, category by category. A line is asked for without the points that lie within a
 * quarter of the reach of what remains, which keeps the query of a long route short. The
 * query names the box all of it lies in, so that the server looks at nothing outside it.
 */
export function poiQuery(reaches: readonly PoiReach[], area: PoiArea): string {
  const lines = 'spot' in area ? [] : area.lines.map((line) => ({ line, keptUpTo: keepTolerances(line) }));
  const statements = reaches.flatMap(({ category, metres }) => {
    const value = category.values.length === 1 ? `="${category.values[0]}"` : `~"^(${category.values.join('|')})$"`;
    const access = category.noAccess ? `["access"!~"^(${category.noAccess.join('|')})$"]` : '';
    const around =
      'spot' in area
        ? [latLng(area.spot)]
        : lines.map(({ line, keptUpTo }) =>
            line
              .filter((_, i) => keptUpTo[i]! > metres / 4)
              .map(latLng)
              .join(','),
          );
    const found = around.filter((positions) => positions !== '').map((positions) => `nwr["${category.key}"${value}]${access}(around:${Math.round(metres)},${positions});`);
    return found.length > 0 ? [`(${found.join('')});out center ${KIND_LIMIT};`] : [];
  });
  const box = boxAround('spot' in area ? [area.spot] : area.lines.flat(), Math.max(...reaches.map((r) => r.metres)));
  return `[out:json][timeout:${TIMEOUT_S}][bbox:${box}];${statements.join('')}`;
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, string>;
}

/** The server ran out of time or is busy: the same query may be answered a little later. */
class OverpassBusy extends Error {}

/**
 * The places in an Overpass answer; elements without a position or of no category are left
 * out. A query that runs out of time or memory still answers with status 200 and a remark
 * saying so, which is thrown.
 */
export function parsePois(json: unknown): Poi[] {
  const answer = json as { elements?: unknown; remark?: unknown } | null;
  if (typeof answer !== 'object' || answer === null || !Array.isArray(answer.elements)) throw new Error(t('The POI search did not answer with OpenStreetMap data.'));
  if (typeof answer.remark === 'string' && /error/i.test(answer.remark)) throw new OverpassBusy(t('The POI search gave up; a smaller distance or fewer kinds may work.'));
  return (answer.elements as OverpassElement[]).flatMap((element): Poi[] => {
    const lng = Number(element.lon ?? element.center?.lon);
    const lat = Number(element.lat ?? element.center?.lat);
    const tags = element.tags ?? {};
    const category = categoryOf(tags);
    if (!category || !Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [{ id: `${String(element.type)}/${String(element.id)}`, category, lngLat: [lng, lat], tags }];
  });
}

/** Resolves after the time, or rejects as soon as the signal aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

/** Sends one query; the statuses of a server that is busy or took too long are thrown as such. */
async function ask(query: string, signal: AbortSignal): Promise<Poi[]> {
  const response = await fetch(OVERPASS_URL, { method: 'POST', body: new URLSearchParams({ data: query }), signal });
  if ([429, 502, 503, 504].includes(response.status)) throw new OverpassBusy(t('The POI search is not available right now ({status}).', { status: response.status }));
  if (!response.ok) throw new Error(t('The POI search is not available right now ({status}).', { status: response.status }));
  return parsePois(await response.json());
}

export interface FoundPois {
  pois: Poi[];
  /** Whether a query answered with as many places of a category as it may, so that there are likely more. */
  truncated: boolean;
}

/**
 * Looks for the places of each category within its reach of the area. Lines are asked for
 * stretch by stretch with a pause between the queries, and a query the server ran out of
 * time on is sent again after a wait, a few times. Before each query `progress` hears what
 * was found so far and how many of the queries are done, and once more at the end; a
 * query that fails for good is thrown, after what the others found was handed over.
 */
export async function findPois(reaches: readonly PoiReach[], area: PoiArea, signal: AbortSignal, progress: (found: FoundPois, done: number, total: number) => void): Promise<void> {
  const areas: PoiArea[] = 'spot' in area ? [area] : area.lines.flatMap((line) => stretchesOf(line, STRETCH_M)).map((stretch) => ({ lines: [stretch] }));
  const pois = new Map<string, Poi>();
  let truncated = false;
  for (const [done, part] of areas.entries()) {
    progress({ pois: [...pois.values()], truncated }, done, areas.length);
    if (done > 0) await pause(PAUSE_MS, signal);
    const query = poiQuery(reaches, part);
    for (let attempt = 0; ; attempt++) {
      try {
        const found = await ask(query, signal);
        truncated ||= reaches.some(({ category }) => found.filter((poi) => poi.category === category).length >= KIND_LIMIT);
        for (const poi of found) pois.set(poi.id, poi);
        break;
      } catch (fault) {
        if (!(fault instanceof OverpassBusy) || attempt === RETRIES) throw fault;
        await pause(RETRY_AFTER_MS, signal);
      }
    }
  }
  progress({ pois: [...pois.values()], truncated }, areas.length, areas.length);
}
