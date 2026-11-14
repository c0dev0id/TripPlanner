import { batch, createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { errorMessage, fetchRides } from '../api';
import { ROUTE_PALETTE } from '../model/routeLook';
import type { LngLat } from '../model/trip';
import type { Ride } from '../recording/rides';
import { decodePolyline } from '../routing/polyline';
import { selectIn, selectionOf } from '../ui/selection';
import { showWhole } from './drawing';
import { libraryTab, libraryTrips, showTab } from './library';
import { foldPanel } from './panel';

/**
 * The rides: every recording the user keeps, read while their tab is shown, again when
 * the library is listed afresh and when one of them changes, the lines of the rides
 * selected there, which the map draws, and how what is done to them goes.
 */

/** How often rides were changed since the page was loaded: what lists them reads them again when it goes up. */
const [changes, setChanges] = createSignal(0);
export const rideChanges = changes;

/** Says that rides were added, changed, deleted, or put on or taken off a day: once for all an action did. */
export const ridesChanged = (): void => void setChanges(changes() + 1);

/** The owner of the selection among the rides, whose rows are rides by their id. */
export const RIDES = 'rides';

const rides = createRoot(() => {
  const [list] = createResource(
    () => {
      const trips = libraryTrips.error ? [] : libraryTrips();
      return libraryTab() === 'recordings' && trips && ([trips, changes()] as const);
    },
    () => fetchRides(),
  );
  const all = createMemo((): Ride[] => (list.error ? [] : (list.latest ?? [])));
  const byId = createMemo(() => new Map(all().map((ride) => [String(ride.id), ride])));
  /** The rides drawn on the map: the selected ones, the first selected first; the same while their lines are, however often they are read. */
  const drawn = createMemo(() => [...selectionOf(RIDES)].flatMap((id) => byId().get(id) ?? []), [], { equals: (a, b) => a.length === b.length && a.every((ride, i) => ride.id === b[i]!.id && ride.line === b[i]!.line) });
  /** Their lines, each in the palette's colour at its place, which starts over where the palette ends. */
  const lines = createMemo(() => drawn().map((ride, i) => ({ id: ride.id, points: decodePolyline(ride.line) as LngLat[], color: ROUTE_PALETTE[i % ROUTE_PALETTE.length]!.color })));
  // What is selected is brought into view.
  createEffect(() => {
    const points = lines().flatMap((line) => line.points);
    if (points.length > 0) showWhole(points);
  });
  return { list, all, lines };
});

/** Every ride, by when it began; none until they are read. */
export const allRides = rides.all;

/** Whether the rides are being read for the first time, and why they could not be, where they could not. */
export const ridesLoading = (): boolean => rides.list.loading && rides.all().length === 0;
export const ridesError = (): unknown => rides.list.error;

/** The lines the map draws of the rides selected. */
export const ridesOnMap = rides.lines;

/** The colour a selected ride is drawn in on the map; none for one that is not drawn. */
export const rideColor = (ride: Ride): string | undefined => rides.lines().find((line) => line.id === ride.id)?.color;

/** The ride to be brought into view among the rides, once: one shown from a day it is on. */
export const [revealedRide, revealRide] = createSignal<number>();

/** Shows the rides, in the library unfolded for them, with one of them selected and in view. */
export function showRide(id: number): void {
  batch(() => {
    foldPanel(false);
    showTab('recordings');
    selectIn(RIDES, new Set([String(id)]));
    revealRide(id);
  });
}

/** What a change to rides came to: a sentence, and what it could not do. */
export interface RidesNote {
  text: string;
  errors: string[];
}

/** How the last change to rides goes or went, said above them. */
const [note, setNote] = createSignal<RidesNote>();
export const ridesNote = note;

/** Runs a change to rides, says what came of it where it says something, or why it failed, and has the rides read again. */
export async function changeRides(work: () => Promise<RidesNote | void>): Promise<void> {
  try {
    setNote((await work()) || undefined);
  } catch (fault) {
    setNote({ text: '', errors: [errorMessage(fault)] });
  }
  ridesChanged();
}

let busy = false;

/** Runs a change to rides that takes a while and says how far it is; while one runs, another is not started. */
export async function runRidesJob(work: (onProgress: (text: string) => void) => Promise<RidesNote>): Promise<void> {
  if (busy) return;
  busy = true;
  await changeRides(() => work((text) => setNote({ text, errors: [] })));
  busy = false;
}
