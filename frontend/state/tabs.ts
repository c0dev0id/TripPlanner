import { routePositions } from '../routing/legs';
import { isTreeTab, libraryTrips, mapTab, openTree, showTab, tripShown, type LibraryTab, type TreeTab } from './library';
import { isRecordingPinned, isRoutePinned, setPinsAside, type PinnedLine } from './pins';
import { openRecording } from './recordingView';
import { activeRecordingId, loadedTrack, recordingColor, shownRecordings } from './recordings';
import { openRouteColors } from './routeColors';
import { activeRouteId, openTrip, openTripId, selectedDayId, takeUpRoute } from './trip';

/**
 * The library's tabs as views of their own: what a tab with a tree had open when the user
 * left it by its button (the trip or list, its day, the route taken up, the recording
 * opened), opened again when the user comes back to it. Only one trip is open at a time,
 * so coming back to a tab whose trip is not the open one opens it again, saved, as
 * picking it would. A trip left while another tab's things are shown keeps its pins
 * aside.
 */

interface LeftOpen {
  tripId: number;
  dayId?: string;
  routeId?: string;
  recordingId?: number;
}

const leftOpen: Partial<Record<TreeTab, LeftOpen>> = {};

/** The open trip's pinned routes and recordings as the map draws them. */
function pinnedLines(): PinnedLine[] {
  const routes = (openTrip()?.days ?? []).flatMap((day) => day.routes.filter((route) => isRoutePinned(route.id)));
  const recordings = shownRecordings().filter((recording) => isRecordingPinned(recording.id));
  return [
    ...routes.map((route) => ({ points: routePositions(route), color: openRouteColors().get(route.id) ?? '#495057' })),
    ...recordings.flatMap((recording) => {
      const track = loadedTrack(recording);
      return track ? [{ points: track.points, color: recordingColor(recording) }] : [];
    }),
  ];
}

/** Keeps the open trip's pins aside, with their lines on the map, where the trip is left while the map follows another tab. */
export function setPinsAsideIfHidden(): void {
  const tripId = openTripId();
  if (tripId !== undefined && !tripShown()) setPinsAside(tripId, pinnedLines());
}

/**
 * Shows the tab the user picked: what the tab left had open is kept for it and let go
 * of on the map, and what the tab picked had open comes back; `open` opens a trip at a
 * day with a route taken up, as the library does.
 */
export function switchTab(to: LibraryTab, open: (id: number, dayId?: string, routeId?: string) => Promise<void>): void {
  const from = mapTab();
  if (to === 'settings' || to === from) return showTab(to);
  const tripId = openTripId();
  if (isTreeTab(from)) leftOpen[from] = tripId !== undefined && openTree() === from ? { tripId, dayId: selectedDayId(), routeId: activeRouteId(), recordingId: activeRecordingId() } : undefined;
  takeUpRoute(undefined);
  openRecording(undefined);
  showTab(to);
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
