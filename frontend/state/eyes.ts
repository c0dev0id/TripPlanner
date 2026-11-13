import { createEffect, createRoot, createSignal, on } from 'solid-js';
import type { Route } from '../model/trip';
import { activeRouteId, openTripId } from './trip';

/**
 * What the user has on the map, as a layer panel has it: an eye on every route and every
 * recording, and one on each of the two groups, the routes and the recordings. A thing is
 * drawn while its own eye and its group's are open; routes start open, recordings closed.
 * The eyes are those of the open trip, for all of its days, and go when it is left.
 */

export type EyeGroup = 'routes' | 'recordings';

const [closedRoutes, setClosedRoutes] = createSignal<ReadonlySet<string>>(new Set());
const [openRecordings, setOpenRecordings] = createSignal<ReadonlySet<number>>(new Set());
const [closedGroups, setClosedGroups] = createSignal<ReadonlySet<EyeGroup>>(new Set());

createRoot(() => {
  createEffect(
    on(openTripId, () => {
      setClosedRoutes(new Set<string>());
      setOpenRecordings(new Set<number>());
      setClosedGroups(new Set<EyeGroup>());
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

export const routeEye = (id: string): boolean => !closedRoutes().has(id);

export const recordingEye = (id: number): boolean => openRecordings().has(id);

export const groupEye = (group: EyeGroup): boolean => !closedGroups().has(group);

export const setRouteEyes = (ids: readonly string[], open: boolean): void => void setClosedRoutes(withIds(closedRoutes(), ids, !open));

export const setRecordingEyes = (ids: readonly number[], open: boolean): void => void setOpenRecordings(withIds(openRecordings(), ids, open));

export const setGroupEye = (group: EyeGroup, open: boolean): void => void setClosedGroups(withIds(closedGroups(), [group], !open));

/** Whether a recording is on the map by its eye and its group's. */
export const recordingOnMap = (id: number): boolean => groupEye('recordings') && recordingEye(id);

/** The routes that are on the map: those whose eye and whose group's are open, and the one taken up; the routes themselves where none is left out. */
export function routesOnMap(routes: readonly Route[]): readonly Route[] {
  const group = groupEye('routes');
  const active = activeRouteId();
  const drawn = routes.filter((route) => route.id === active || (group && routeEye(route.id)));
  return drawn.length === routes.length ? routes : drawn;
}
