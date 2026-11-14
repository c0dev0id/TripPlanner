import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { openTripId } from './trip';

/**
 * What the user has pinned to the map: routes and recordings that stay on it while
 * something else is taken up, which otherwise is drawn alone. Nothing is pinned to begin
 * with. The pins are those of the open trip, for all of its days, and go when it is left.
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
