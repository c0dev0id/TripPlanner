import { createMemo, createResource, createRoot } from 'solid-js';
import { fetchPreferences, savePreferences, type Preferences } from '../api';
import { DEFAULT_ROUTE_COLORING, DEFAULT_ROUTE_WIDTH, type RouteColoring } from '../model/routeLook';
import type { PoiCategoryId } from '../poi/categories';

/** What the user set for the planner as a whole, kept with the account: loaded once, saved as it changes. */

const [loaded, { mutate }] = createRoot(() => createResource(fetchPreferences));

const preferences = (): Preferences => loaded() ?? {};

/** How far from a route a place is shown along it where the user set nothing: narrow, so that a route stays readable. */
const DEFAULT_PLACE_REACH_M = 200;

/** How far from a route a place of the kind is still shown along it, in metres. */
export const placeReachM = (kind: PoiCategoryId): number => preferences().placeReachM?.[kind] ?? DEFAULT_PLACE_REACH_M;

/** The width of a route's line in pixels. */
export const routeWidth = createRoot(() => createMemo((): number => preferences().routeWidth ?? DEFAULT_ROUTE_WIDTH));

/** How opaque one ride is where the map draws them all: translucent enough that a few rides on a road still read as fewer than many. */
export const DEFAULT_RIDES_OPACITY = 0.4;

export const ridesOpacity = createRoot(() => createMemo((): number => preferences().ridesOpacity ?? DEFAULT_RIDES_OPACITY));

/** How routes without a colour of their own get one. */
export const routeColoring = createRoot(() => createMemo((): RouteColoring => preferences().routeColoring ?? DEFAULT_ROUTE_COLORING));

/** Sets the preferences given and keeps them with the account. */
export async function changePreferences(change: Preferences): Promise<void> {
  const next = { ...preferences(), ...change };
  await savePreferences(next);
  mutate(next);
}
