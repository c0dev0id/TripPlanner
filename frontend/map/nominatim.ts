import { t } from '../i18n/t';
import type { LngLat } from '../model/trip';

/**
 * Place and address search, and the place a position is in, with Nominatim,
 * OpenStreetMap's geocoder. Its usage policy
 * (operations.osmfoundation.org/policies/nominatim) allows one request per second and no
 * search as you type, and asks for attribution.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const NOMINATIM_ATTRIBUTION = t('Search: Nominatim, © OpenStreetMap contributors');
const NOMINATIM_MIN_INTERVAL_MS = 1000;

const TIMEOUT_MS = 15_000;

let nextTurn = 0;

/** Nominatim's answer to a request, as JSON, asked once it may be asked again: one request per second, whoever asks; those who wait are served in turn. */
async function ask(url: string): Promise<unknown> {
  const at = Math.max(Date.now(), nextTurn);
  nextTurn = at + NOMINATIM_MIN_INTERVAL_MS;
  if (at > Date.now()) await new Promise((resolve) => setTimeout(resolve, at - Date.now()));
  return (await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })).json();
}
const RESULT_LIMIT = 5;

/** West, south, east, north. */
export type Bounds = [number, number, number, number];

export interface Place {
  /** The full description: name, street, town, region, country. */
  label: string;
  lngLat: LngLat;
  /** The place's extent, where it has one larger than a point. */
  bounds?: Bounds;
}

/** The search for `query`, preferring places within `near` without being limited to them. */
export function searchUrl(query: string, near?: Bounds): string {
  const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: String(RESULT_LIMIT) });
  if (near) params.set('viewbox', near.join(','));
  return `${NOMINATIM_URL}/search?${params}`;
}

/** The request for the town, city or village a position is in. */
export const reverseUrl = ([lng, lat]: LngLat): string => `${NOMINATIM_URL}/reverse?${new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '10' })}`;

/** The name of the place in Nominatim's answer for a position; none where it knows no place there. */
export function parsePlaceName(json: unknown): string | undefined {
  const name = (json as { name?: unknown } | null)?.name;
  return typeof name === 'string' && name !== '' ? name : undefined;
}

interface NominatimPlace {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  /** South, north, west, east, as strings. */
  boundingbox?: unknown;
}

/** The places in a Nominatim answer; entries without a position are left out. */
export function parsePlaces(json: unknown): Place[] {
  if (!Array.isArray(json)) throw new Error(t('The search did not answer with a list of places.'));
  return (json as NominatimPlace[]).flatMap((p): Place[] => {
    const lng = Number(p.lon);
    const lat = Number(p.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    const box = Array.isArray(p.boundingbox) ? p.boundingbox.map(Number) : [];
    const bounds: Bounds | undefined = box.length === 4 && box.every(Number.isFinite) && box[0]! < box[1]! && box[2]! < box[3]! ? [box[2]!, box[0]!, box[3]!, box[1]!] : undefined;
    return [{ label: typeof p.display_name === 'string' ? p.display_name : `${lat}, ${lng}`, lngLat: [lng, lat], ...(bounds && { bounds }) }];
  });
}

/** The places Nominatim finds for `query`, those within `near` first. */
export const searchPlaces = async (query: string, near?: Bounds): Promise<Place[]> => parsePlaces(await ask(searchUrl(query, near)));

/** The names asked for, by position to some hundred metres, kept while the page stands: many rides begin where others began. */
const names = new Map<string, string | undefined>();

/** The town, city or village a position is in, as Nominatim names it; none where it knows no place. */
export async function placeNameAt(lngLat: LngLat): Promise<string | undefined> {
  const key = lngLat.map((value) => value.toFixed(3)).join(',');
  if (!names.has(key)) names.set(key, parsePlaceName(await ask(reverseUrl(lngLat))));
  return names.get(key);
}
