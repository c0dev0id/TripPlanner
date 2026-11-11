import { createResource, createRoot } from 'solid-js';
import { fetchPreferences, savePreferences, type Preferences } from '../api';
import type { PoiCategoryId } from '../poi/categories';

/** What the user set for the planner as a whole, kept with the account: loaded once, saved as it changes. */

const [loaded, { mutate }] = createRoot(() => createResource(fetchPreferences));

const preferences = (): Preferences => loaded() ?? {};

/** How far from a route a place is shown along it where the user set nothing: narrow, so that a route stays readable. */
export const DEFAULT_PLACE_REACH_M = 200;

/** How far from a route a place of the kind is still shown along it, in metres. */
export const placeReachM = (kind: PoiCategoryId): number => preferences().placeReachM?.[kind] ?? DEFAULT_PLACE_REACH_M;

/** Sets the distances of the kinds given and keeps them with the account. */
export async function setPlaceReaches(reaches: Partial<Record<PoiCategoryId, number>>): Promise<void> {
  const next = { ...preferences(), placeReachM: { ...preferences().placeReachM, ...reaches } };
  await savePreferences(next);
  mutate(next);
}
