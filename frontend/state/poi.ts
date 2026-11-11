import { createSignal } from 'solid-js';
import { errorMessage } from '../api';
import type { LngLat } from '../model/trip';
import { findPois, type FoundPois, type Poi, type PoiArea, type PoiReach } from '../poi/overpass';

/** The POI search: the spot its dialog is open for, and how the last search goes or went. Never kept. */

export const [poiSearchSpot, setPoiSearchSpot] = createSignal<LngLat>();

/** What a search found so far; while it runs, how many of its queries are done; why it ended early, if it did. */
type PoiSearch = FoundPois & { searching?: { done: number; total: number }; failure?: string };

const [poiSearch, setPoiSearch] = createSignal<PoiSearch>();
export { poiSearch };

const NONE: Poi[] = [];

/** The places the search found, so far while it runs. */
export const foundPois = (): Poi[] => poiSearch()?.pois ?? NONE;

/** Stops the search that is running, if one is. */
let running = new AbortController();

/**
 * Looks for the places of each category within its reach of the area; what was found before
 * goes. Gives back what it found once it is through, and nothing where it failed or was
 * stopped: what it found until then stays on the map.
 */
export async function searchPois(reaches: readonly PoiReach[], area: PoiArea): Promise<Poi[] | undefined> {
  running.abort();
  const { signal } = (running = new AbortController());
  let found: FoundPois = { pois: NONE, truncated: false };
  try {
    await findPois(reaches, area, signal, (soFar, done, total) => {
      found = soFar;
      setPoiSearch({ ...found, ...(done < total && { searching: { done, total } }) });
    });
    return found.pois;
  } catch (fault) {
    if (!signal.aborted) setPoiSearch({ ...found, failure: errorMessage(fault) });
    return undefined;
  }
}

/** Ends the running search; what it found so far stays. */
export function stopPoiSearch(): void {
  running.abort();
  setPoiSearch((search) => search && { pois: search.pois, truncated: search.truncated });
}

export function clearPois(): void {
  running.abort();
  setPoiSearch(undefined);
}
