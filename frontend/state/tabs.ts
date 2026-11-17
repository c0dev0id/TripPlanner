import { batch } from 'solid-js';
import type { KeptRide } from '../api';
import { selectIn } from '../ui/selection';
import { isTreeTab, type LibraryTab, type TreeTab } from '../model/library';
import { libraryTrips, mapTab, openTree, setQuery, showTab } from './library';
import { fold } from './panel';
import { revealRide, RIDES } from './rides';
import { openRecording, toggleRecording } from './recordingView';
import { activeRecordingId } from './recordings';
import { activeRouteId, openTripId, selectedDayId, takeUpRoute } from './trip';

/**
 * The library's tabs as views of their own: what a tab with a tree had open when the user
 * left it by its button (the trip or list, its day, the route taken up, the recording
 * opened), opened again when the user comes back to it. Only one trip is open at a time,
 * so coming back to a tab whose trip is not the open one opens it again, saved, as
 * picking it would.
 */

interface LeftOpen {
  tripId: number;
  dayId?: string;
  routeId?: string;
  recordingId?: number;
}

const leftOpen: Partial<Record<TreeTab, LeftOpen>> = {};

/** Leaves the tab the map follows for another, which is shown: what it had open is kept for it and let go of on the map. */
function leaveFor(to: Exclude<LibraryTab, 'settings'>): void {
  const from = mapTab();
  const tripId = openTripId();
  if (isTreeTab(from)) leftOpen[from] = tripId !== undefined && openTree() === from ? { tripId, dayId: selectedDayId(), routeId: activeRouteId(), recordingId: activeRecordingId() } : undefined;
  takeUpRoute(undefined);
  openRecording(undefined);
  showTab(to);
}

/** Shows a recording of a day among the rides: the day's tab is left as its button leaves it, and the ride is opened there, selected and in view, with the library unfolded and not searched. */
export function showInRides(ride: KeptRide): void {
  batch(() => {
    fold('library', false);
    leaveFor('recordings');
    setQuery('');
    selectIn(RIDES, new Set([String(ride.id)]));
    revealRide(ride.id);
  });
  toggleRecording(ride);
}

/**
 * Shows the tab the user picked: what the tab left had open is kept for it and let go
 * of on the map, and what the tab picked had open comes back; `open` opens a trip at a
 * day with a route taken up, as the library does.
 */
export function switchTab(to: LibraryTab, open: (id: number, dayId?: string, routeId?: string) => Promise<void>): void {
  if (to === 'settings' || to === mapTab()) return showTab(to);
  leaveFor(to);
  const tripId = openTripId();
  const back = isTreeTab(to) ? leftOpen[to] : undefined;
  if (!back) return;
  if (back.tripId === tripId) {
    if (back.dayId === selectedDayId()) {
      takeUpRoute(back.routeId);
      openRecording(back.recordingId);
    }
    return;
  }
  if (!libraryTrips()?.some((trip) => trip.id === back.tripId)) return;
  void open(back.tripId, back.dayId, back.routeId).then(() => openTripId() === back.tripId && openRecording(back.recordingId));
}
