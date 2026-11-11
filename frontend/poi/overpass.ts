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
/** The most places one search answers with. */
export const POI_LIMIT = 2000;

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
 * The query for the places of each category within its reach of the area, answered as JSON
 * with a position for each. A line is asked for without the points that lie within a
 * quarter of the reach of what remains, which keeps the query of a long route short.
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
    return around.filter((positions) => positions !== '').map((positions) => `nwr["${category.key}"${value}]${access}(around:${Math.round(metres)},${positions});`);
  });
  return `[out:json][timeout:${TIMEOUT_S}];(${statements.join('')});out center ${POI_LIMIT};`;
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, string>;
}

/**
 * The places in an Overpass answer; elements without a position or of no category are left
 * out. A query that runs out of time or memory still answers with status 200 and a remark
 * saying so, which is thrown.
 */
export function parsePois(json: unknown): Poi[] {
  const answer = json as { elements?: unknown; remark?: unknown } | null;
  if (typeof answer !== 'object' || answer === null || !Array.isArray(answer.elements)) throw new Error(t('The POI search did not answer with OpenStreetMap data.'));
  if (typeof answer.remark === 'string' && /error/i.test(answer.remark)) throw new Error(t('The POI search gave up; a smaller distance or fewer kinds may work.'));
  return (answer.elements as OverpassElement[]).flatMap((element): Poi[] => {
    const lng = Number(element.lon ?? element.center?.lon);
    const lat = Number(element.lat ?? element.center?.lat);
    const tags = element.tags ?? {};
    const category = categoryOf(tags);
    if (!category || !Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [{ id: `${String(element.type)}/${String(element.id)}`, category, lngLat: [lng, lat], tags }];
  });
}

/** The places of each category within its reach of the area. */
export async function findPois(reaches: readonly PoiReach[], area: PoiArea): Promise<Poi[]> {
  const response = await fetch(OVERPASS_URL, { method: 'POST', body: new URLSearchParams({ data: poiQuery(reaches, area) }) });
  if (!response.ok) throw new Error(t('The POI search is not available right now ({status}).', { status: response.status }));
  return parsePois(await response.json());
}
