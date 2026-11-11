import { createSignal } from 'solid-js';
import { errorMessage } from '../api';
import type { LngLat } from '../model/trip';
import { findPois, type Poi, type PoiArea, type PoiReach } from '../poi/overpass';

/** The POI search: the spot its dialog is open for, and how the last search went. Never kept. */

export const [poiSearchSpot, setPoiSearchSpot] = createSignal<LngLat>();

type PoiSearch = { state: 'searching' } | { state: 'found'; pois: Poi[] } | { state: 'failed'; message: string };

const [poiSearch, setPoiSearch] = createSignal<PoiSearch>();
export { poiSearch };

/** The places the last search found. */
export function foundPois(): Poi[] {
  const search = poiSearch();
  return search?.state === 'found' ? search.pois : [];
}

/** Counts the searches, so that one a later search or a clearing overtook is dropped. */
let searches = 0;

/** Looks for the places of each category within its reach of the area; what was found before goes. */
export async function searchPois(reaches: readonly PoiReach[], area: PoiArea): Promise<void> {
  const search = ++searches;
  setPoiSearch({ state: 'searching' });
  let result: PoiSearch;
  try {
    result = { state: 'found', pois: await findPois(reaches, area) };
  } catch (fault) {
    result = { state: 'failed', message: errorMessage(fault) };
  }
  if (search === searches) setPoiSearch(result);
}

export function clearPois(): void {
  searches++;
  setPoiSearch(undefined);
}
