import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { openTripId } from './trip';

/**
 * What the user has on the map, as a layer panel has it: an eye on every route and every
 * recording, and one on each of the two groups, the routes and the recordings. A thing is
 * on the map while its own eye and its group's are open; routes start open, recordings
 * closed. What is taken up is drawn whatever they say, which those who draw see to. The
 * eyes are those of the open trip, for all of its days, and go when it is left.
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

/** Whether a route or a recording is on the map by its eye and its group's. */
export const routeOnMap = (id: string): boolean => groupEye('routes') && routeEye(id);

export const recordingOnMap = (id: number): boolean => groupEye('recordings') && recordingEye(id);
