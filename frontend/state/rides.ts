import { batch, createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { fetchRides } from '../api';
import { ROUTE_PALETTE } from '../model/routeLook';
import type { LngLat } from '../model/trip';
import type { Ride } from '../recording/rides';
import { decodePolyline } from '../routing/polyline';
import { selectIn, selectionOf } from '../ui/selection';
import { showWhole } from './drawing';
import { libraryTrips, shownReport, showReport } from './library';

/**
 * The rides: every recording the user keeps, read while their pane is shown and again
 * when the library is listed afresh, and the lines of the rides selected there, which
 * the map draws.
 */

/** The owner of the pane's selection, whose rows are rides by their id. */
export const RIDES = 'rides';

const rides = createRoot(() => {
  const [list] = createResource(
    () => shownReport() === 'rides' && (libraryTrips.error ? [] : libraryTrips()),
    () => fetchRides(),
  );
  const all = createMemo((): Ride[] => (list.error ? [] : (list.latest ?? [])));
  const byId = createMemo(() => new Map(all().map((ride) => [String(ride.id), ride])));
  /** The rides drawn on the map: the selected ones, the first selected first. */
  const drawn = createMemo(() => [...selectionOf(RIDES)].flatMap((id) => byId().get(id) ?? []), [], { equals: (a, b) => a.length === b.length && a.every((ride, i) => ride === b[i]) });
  /** Their lines, each in the palette's colour at its place, which starts over where the palette ends. */
  const lines = createMemo(() => drawn().map((ride, i) => ({ id: ride.id, points: decodePolyline(ride.line) as LngLat[], color: ROUTE_PALETTE[i % ROUTE_PALETTE.length]!.color })));
  // What is selected is brought into view.
  createEffect(() => {
    const points = lines().flatMap((line) => line.points);
    if (points.length > 0) showWhole(points);
  });
  return { list, all, drawn, lines };
});

/** Every ride, by when it began; none until they are read. */
export const allRides = rides.all;

/** Whether the rides are being read for the first time, and why they could not be, where they could not. */
export const ridesLoading = (): boolean => rides.list.loading && rides.all().length === 0;
export const ridesError = (): unknown => rides.list.error;

/** The lines the map draws of the rides selected. */
export const ridesOnMap = rides.lines;

/** The colour a selected ride is drawn in on the map; none for one that is not drawn. */
export const rideColor = (ride: Ride): string | undefined => rides.lines()[rides.drawn().indexOf(ride)]?.color;

/** The ride to be brought into view in the pane, once: one shown from where it is kept. */
export const [revealedRide, revealRide] = createSignal<number>();

/** Shows the rides with one of them selected and in view. */
export function showRide(id: number): void {
  batch(() => {
    showReport('rides');
    selectIn(RIDES, new Set([String(id)]));
    revealRide(id);
  });
}
