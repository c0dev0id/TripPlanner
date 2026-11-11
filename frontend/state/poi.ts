import { createSignal } from 'solid-js';
import { errorMessage } from '../api';
import type { LngLat } from '../model/trip';
import { findPois, type FoundPois, type Poi, type PoiArea, type PoiReach } from '../poi/overpass';

/** The POI search: the spot its dialog is open for, and how the last search went. Never kept. */

export const [poiSearchSpot, setPoiSearchSpot] = createSignal<LngLat>();

type PoiSearch = { state: 'searching'; done: number; total: number } | ({ state: 'found' } & FoundPois) | { state: 'failed'; message: string };

const [poiSearch, setPoiSearch] = createSignal<PoiSearch>();
export { poiSearch };

/** The places the last search found. */
export function foundPois(): Poi[] {
  const search = poiSearch();
  return search?.state === 'found' ? search.pois : [];
}

/** Stops the search that is running, if one is. */
let running = new AbortController();

/** Looks for the places of each category within its reach of the area; what was found before goes. */
export async function searchPois(reaches: readonly PoiReach[], area: PoiArea): Promise<void> {
  running.abort();
  const { signal } = (running = new AbortController());
  let result: PoiSearch;
  try {
    result = { state: 'found', ...(await findPois(reaches, area, signal, (done, total) => setPoiSearch({ state: 'searching', done, total }))) };
  } catch (fault) {
    result = { state: 'failed', message: errorMessage(fault) };
  }
  if (!signal.aborted) setPoiSearch(result);
}

export function clearPois(): void {
  running.abort();
  setPoiSearch(undefined);
}
