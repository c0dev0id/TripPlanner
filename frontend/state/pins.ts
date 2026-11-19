import { createSignal } from 'solid-js';
import type { LngLat } from '../model/trip';
import { openTripId } from './trip';

/**
 * What the user has pinned to the map: routes and recordings that stay on it whatever
 * else is taken up, whatever day is shown and whatever trip is open, until they are let
 * go of, and the rides pinned in their own tab. Nothing is pinned to begin with. A pin
 * names the trip its route or recording is of and keeps a copy of its line and of what
 * it is called, taken when that trip is left: the map draws the copy while the trip is
 * not open.
 */

/** A pinned line as the map draws it while its trip is not open. */
export interface PinnedLine {
  points: readonly LngLat[];
  color: string;
}

/** What a pin is called, its own name and where it is found from its trip down, and the colour of its line. */
export interface PinName {
  name: string;
  where: readonly string[];
  color: string;
}

/** What is kept of a pin for while its trip is not open: what it is called, and its line. */
export type KeptPin = PinName & PinnedLine;

/** A pin: the trip its route or recording is of, and what was kept of it when that trip was last left. */
interface Pin {
  tripId: number;
  kept?: KeptPin;
}

/** The pinned routes and the recordings pinned on days, by id, in the order they were pinned. */
const [pinnedRoutes, setPinnedRoutes] = createSignal<ReadonlyMap<string, Pin>>(new Map());
const [pinnedRecordings, setPinnedRecordings] = createSignal<ReadonlyMap<number, Pin>>(new Map());
export { pinnedRoutes, pinnedRecordings };

/** The pins with those of the open trip added for the ids, or without the ids. */
function withPins<T>(pins: ReadonlyMap<T, Pin>, ids: readonly T[], pinned: boolean): ReadonlyMap<T, Pin> {
  const next = new Map(pins);
  for (const id of ids) {
    if (pinned) next.set(id, { tripId: openTripId()! });
    else next.delete(id);
  }
  return next;
}

export const isRoutePinned = (id: string): boolean => pinnedRoutes().has(id);

export const isRecordingPinned = (id: number): boolean => pinnedRecordings().has(id);

/** Pins routes of the open trip, or lets go of them. */
export const pinRoutes = (ids: readonly string[], pinned: boolean): void => void setPinnedRoutes(withPins(pinnedRoutes(), ids, pinned));

/** Pins recordings on days of the open trip, or lets go of them. */
export const pinRecordings = (ids: readonly number[], pinned: boolean): void => void setPinnedRecordings(withPins(pinnedRecordings(), ids, pinned));

/** The pins of the open trip with what `keptOf` keeps of them; a pin it keeps nothing of is let go of. */
function withKept<T>(pins: ReadonlyMap<T, Pin>, keptOf: (id: T) => KeptPin | undefined): ReadonlyMap<T, Pin> {
  const tripId = openTripId();
  const next = new Map<T, Pin>();
  for (const [id, pin] of pins) {
    const kept = pin.tripId === tripId ? keptOf(id) : pin.kept;
    if (kept || pin.tripId !== tripId) next.set(id, { tripId: pin.tripId, kept });
  }
  return next;
}

/**
 * Copies the lines and names of the open trip's pins, for the map to show once the trip
 * is no longer open. A pin without a line goes: its route was removed, or its recording
 * was taken off its day or never read.
 */
export function keepPins(routeKept: (id: string) => KeptPin | undefined, recordingKept: (id: number) => KeptPin | undefined): void {
  setPinnedRoutes(withKept(pinnedRoutes(), routeKept));
  setPinnedRecordings(withKept(pinnedRecordings(), recordingKept));
}

/** The copied lines of what is pinned of trips that are not open. */
export function pinnedLinesAside(): PinnedLine[] {
  const tripId = openTripId();
  return [...pinnedRoutes().values(), ...pinnedRecordings().values()].flatMap((pin) => (pin.tripId !== tripId && pin.kept ? [{ points: pin.kept.points, color: pin.kept.color }] : []));
}

/** Lets go of what is pinned of trips that are no more. */
export function unpinTrips(tripIds: readonly number[]): void {
  const stays = <T>(pins: ReadonlyMap<T, Pin>) => new Map([...pins].filter(([, pin]) => !tripIds.includes(pin.tripId)));
  setPinnedRoutes(stays(pinnedRoutes()));
  setPinnedRecordings(stays(pinnedRecordings()));
}

/** The set with the ids in it, or without them. */
function withIds<T>(set: ReadonlySet<T>, ids: readonly T[], inIt: boolean): ReadonlySet<T> {
  const next = new Set(set);
  for (const id of ids) {
    if (inIt) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** The rides pinned in their tab, in the order they were pinned. A ride is of no trip, so these pins name none and are drawn from the rides themselves. */
const [pinnedRides, setPinnedRides] = createSignal<ReadonlySet<number>>(new Set());
export { pinnedRides };

export const isRidePinned = (id: number): boolean => pinnedRides().has(id);

export const pinRides = (ids: readonly number[], pinned: boolean): void => void setPinnedRides(withIds(pinnedRides(), ids, pinned));
