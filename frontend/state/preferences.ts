import { createMemo, createResource, createRoot } from 'solid-js';
import { fetchPreferences, savePreferences, type Preferences } from '../api';
import { DEFAULT_RIDES_OPACITY, DEFAULT_ROUTE_COLORING, DEFAULT_ROUTE_WIDTH, type RouteColoring } from '../model/routeLook';
import { isBadge, isStoreKind, type BadgeId } from '../poi/categories';

/** What the user set for the planner as a whole, kept with the account: loaded once, saved as it changes. */

const [loaded, { mutate }] = createRoot(() => createResource(fetchPreferences));

const preferences = (): Preferences => loaded() ?? {};

/** How far from a route a place is shown along it where the user set nothing: narrow, so that a route stays readable. */
const DEFAULT_PLACE_REACH_M = 200;

/** How far from a route a place of the kind is still shown along it, in metres: a kind of the store by its id, one of the user's own by its section's. */
export const placeReachM = (kind: string): number => preferences().placeReachM?.[kind] ?? DEFAULT_PLACE_REACH_M;

/** The badge the places of the kind are drawn with, where the user picked one. */
export function placeIcon(kind: string): BadgeId | undefined {
  const icon = preferences().placeIcons?.[kind];
  return icon !== undefined && isBadge(icon) ? icon : undefined;
}

/** The badge the places of the kind wear: the one picked, else a kind of the store's own; none for a kind of a list, which is drawn as a dot. */
export const placeBadge = (kind: string): BadgeId | undefined => placeIcon(kind) ?? (isStoreKind(kind) ? kind : undefined);

/** Sets how far from a route the places of the kind are shown along it, and the badge they are drawn with, none for the kind's own look. */
export function changePlaceKind(kind: string, reachM: number, icon: BadgeId | undefined): Promise<void> {
  const { [kind]: _, ...icons } = preferences().placeIcons ?? {};
  return changePreferences({ placeReachM: { ...preferences().placeReachM, [kind]: reachM }, placeIcons: icon ? { ...icons, [kind]: icon } : icons });
}

/** The width of a route's line in pixels. */
export const routeWidth = createRoot(() => createMemo((): number => preferences().routeWidth ?? DEFAULT_ROUTE_WIDTH));

/** How opaque one ride is where the map draws them all. */
export const ridesOpacity = createRoot(() => createMemo((): number => preferences().ridesOpacity ?? DEFAULT_RIDES_OPACITY));

/** How routes without a colour of their own get one. */
export const routeColoring = createRoot(() => createMemo((): RouteColoring => preferences().routeColoring ?? DEFAULT_ROUTE_COLORING));

/** The order the folders at the top of the trees were put in, by id. */
export const folderOrder = createRoot(() => createMemo((): readonly number[] => preferences().folderOrder ?? []));

/** Sets the preferences given and keeps them with the account. */
export async function changePreferences(change: Preferences): Promise<void> {
  const next = { ...preferences(), ...change };
  await savePreferences(next);
  mutate(next);
}
