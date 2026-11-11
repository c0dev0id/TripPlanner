import { createEffect, createResource, createRoot, createSignal, on } from 'solid-js';
import { forgetRoutePois, keepRoutePois, listRoutePois, type RoutePois } from '../api';
import { lineLength } from '../geo/measure';
import type { Route } from '../model/trip';
import { POI_CATEGORIES, type PoiCategory } from '../poi/categories';
import { detailTags } from '../poi/details';
import type { Poi, PoiReach } from '../poi/overpass';
import { routeLine } from '../routing/legs';
import { clearPois, searchPois } from './poi';
import { openTripId, selectedDay } from './trip';

/**
 * What POI searches found along the open trip's routes, kept with the trip: one answer per
 * route and kind of place, loaded with the trip and shown on the map again without asking
 * anyone. Which of them are shown is not kept.
 */

const [list, { mutate }] = createRoot(() => createResource(openTripId, async (tripId) => ({ tripId, found: await listRoutePois(tripId) })));

function allKept(): RoutePois[] {
  const loaded = list();
  return loaded && loaded.tripId === openTripId() ? loaded.found : [];
}

/** What is kept for a route, in the order of the kinds. */
export const keptFor = (routeId: string): RoutePois[] =>
  POI_CATEGORIES.flatMap((category) => allKept().filter((kept) => kept.routeId === routeId && kept.category === category.id));

export const categoryOfKept = (kept: RoutePois): PoiCategory => POI_CATEGORIES.find((category) => category.id === kept.category)!;

/** A mark of a route's line that changes when the line does: how many points it has and how long it is. */
const lineMark = (route: Route): string => {
  const line = routeLine(route);
  return `${line.length}:${Math.round(lineLength(line))}`;
};

/** Whether the route's line has changed since the places were found along it. */
export const isOutdated = (kept: RoutePois, route: Route): boolean => kept.lineMark !== lineMark(route);

const keyOf = (routeId: string, category: string): string => `${routeId}/${category}`;

/** The answers shown on the map, by route and kind. */
const [shown, setShown] = createSignal<ReadonlySet<string>>(new Set());

export const isOnMap = (kept: RoutePois): boolean => shown().has(keyOf(kept.routeId, kept.category));

export function putOnMap(kept: Pick<RoutePois, 'routeId' | 'category'>, on: boolean): void {
  const next = new Set(shown());
  if (on) next.add(keyOf(kept.routeId, kept.category));
  else next.delete(keyOf(kept.routeId, kept.category));
  setShown(next);
}

createRoot(() => {
  // Another trip starts with nothing shown.
  createEffect(on(openTripId, () => setShown(new Set<string>()), { defer: true }));
});

/** The kept places shown on the map: those switched on, of the selected day's routes. */
export function keptPoisOnMap(): Poi[] {
  const routes = new Set(selectedDay()?.routes.map((route) => route.id));
  return allKept()
    .filter((kept) => routes.has(kept.routeId) && isOnMap(kept))
    .flatMap((kept) => kept.places.map((place) => ({ ...place, category: categoryOfKept(kept) })));
}

/** Keeps what a search found along a route for a kind, on the server and here, and shows it. */
async function keep(route: Route, reach: PoiReach, pois: readonly Poi[]): Promise<void> {
  const tripId = openTripId()!;
  const places = pois.filter((poi) => poi.category === reach.category).map((poi) => ({ id: poi.id, lngLat: poi.lngLat, tags: detailTags(poi.tags) }));
  const found = { routeId: route.id, category: reach.category.id, reachM: Math.round(reach.metres), lineMark: lineMark(route), places };
  await keepRoutePois(tripId, found);
  const kept: RoutePois = { ...found, foundAt: new Date().toISOString() };
  mutate((loaded) => loaded && loaded.tripId === tripId ? { tripId, found: [...loaded.found.filter((other) => keyOf(other.routeId, other.category) !== keyOf(kept.routeId, kept.category)), kept] } : loaded);
  putOnMap(kept, true);
}

/**
 * Looks for the places of each kind along each of the routes, one route after the other,
 * and keeps what was found for a route once its search is through; a search that fails or
 * is stopped keeps nothing for its route.
 */
export async function searchAlong(routes: readonly Route[], reaches: readonly PoiReach[]): Promise<void> {
  for (const route of routes) {
    const pois = await searchPois(reaches, { lines: [routeLine(route)] });
    if (!pois) return;
    for (const reach of reaches) await keep(route, reach, pois);
  }
  // What was found is on the map as kept now.
  clearPois();
}

/** Forgets what is kept for a route and kind. */
export async function forget(kept: RoutePois): Promise<void> {
  const tripId = openTripId()!;
  await forgetRoutePois(tripId, kept.routeId, kept.category);
  mutate((loaded) => loaded && { ...loaded, found: loaded.found.filter((other) => other !== kept) });
  putOnMap(kept, false);
}
