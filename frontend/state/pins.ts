import { createEffect, createRoot, createSignal, on } from 'solid-js';
import type { LngLat } from '../model/trip';
import { openTripId } from './trip';

/**
 * What the user has pinned to the map: routes and recordings that stay on it while
 * something else is taken up, which otherwise is drawn alone, or while another tab is
 * shown, and the rides pinned in their own tab. Nothing is pinned to begin with. The
 * pins of routes and recordings are those of the open trip, for all of its days, and go
 * when it is left; a trip set aside for another tab's leaves its pinned lines on the map
 * and takes its pins back when it is opened again.
 */

const [pinnedRoutes, setPinnedRoutes] = createSignal<ReadonlySet<string>>(new Set());
const [pinnedRecordings, setPinnedRecordings] = createSignal<ReadonlySet<number>>(new Set());

createRoot(() => {
  createEffect(
    on(openTripId, () => {
      setPinnedRoutes(new Set<string>());
      setPinnedRecordings(new Set<number>());
    }),
  );
});

/** The set with the ids in it, or without them. */
function withIds<T>(set: ReadonlySet<T>, ids: readonly T[], inIt: boolean): ReadonlySet<T> {
  const next = new Set(set);
  for (const id of ids) {
    if (inIt) next.add(id);
    else next.delete(id);
  }
  return next;
}

export const isRoutePinned = (id: string): boolean => pinnedRoutes().has(id);

export const isRecordingPinned = (id: number): boolean => pinnedRecordings().has(id);

export const pinRoutes = (ids: readonly string[], pinned: boolean): void => void setPinnedRoutes(withIds(pinnedRoutes(), ids, pinned));

export const pinRecordings = (ids: readonly number[], pinned: boolean): void => void setPinnedRecordings(withIds(pinnedRecordings(), ids, pinned));

/** The rides pinned in their tab, in the order they were pinned. Unlike a trip's pins they are not the open trip's: they are kept for the page, whatever trip is open. */
const [pinnedRides, setPinnedRides] = createSignal<ReadonlySet<number>>(new Set());
export { pinnedRides };

export const isRidePinned = (id: number): boolean => pinnedRides().has(id);

export const pinRides = (ids: readonly number[], pinned: boolean): void => void setPinnedRides(withIds(pinnedRides(), ids, pinned));

/** A pinned line of a trip set aside, as the map draws it. */
export interface PinnedLine {
  points: readonly LngLat[];
  color: string;
}

/** The pins of the trips set aside for another tab's, by trip: their ids, and their lines while the trip is not open. */
const [setAside, setSetAside] = createSignal<ReadonlyMap<number, { routes: string[]; recordings: number[]; lines: PinnedLine[] }>>(new Map());

/** The pinned lines of the trips set aside. */
export const pinnedAsideLines = (): PinnedLine[] => [...setAside().values()].flatMap((aside) => aside.lines);

/** Keeps the open trip's pins, by their ids, and their lines on the map while the trip is set aside. */
export function setPinsAside(tripId: number, lines: PinnedLine[]): void {
  if (lines.length === 0) return;
  setSetAside(new Map(setAside()).set(tripId, { routes: [...pinnedRoutes()], recordings: [...pinnedRecordings()], lines }));
}

/** Pins again what the trip had pinned when it was set aside, now that it is open. */
export function takePinsBack(tripId: number): void {
  const aside = setAside().get(tripId);
  if (!aside) return;
  const rest = new Map(setAside());
  rest.delete(tripId);
  setSetAside(rest);
  pinRoutes(aside.routes, true);
  pinRecordings(aside.recordings, true);
}
