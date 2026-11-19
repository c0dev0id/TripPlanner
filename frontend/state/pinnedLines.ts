import type { Recording } from '../api';
import { t } from '../i18n/t';
import type { Day } from '../model/trip';
import { dayOfRoute } from '../routing/dayEdit';
import { routeLine as lineOf } from '../routing/legs';
import { routeLabel } from '../trip/labels';
import { mapTab } from './library';
import { keepPins, isRecordingPinned, pinnedLinesAside, pinnedRecordings, pinnedRoutes, pinRecordings, pinRides, pinRoutes, type KeptPin, type PinName, type PinnedLine } from './pins';
import { loadedTrack, recordingColor, recordingsOf, ridesPinned, shownRecordings } from './recordings';
import { openRouteColors } from './routeColors';
import { openTrip, routeById } from './trip';

/**
 * What is pinned as the map shows it: the lines nothing else draws, which are the copies
 * of trips that are not open and the open trip's pinned recordings on days that are not
 * shown (its pinned routes are drawn with its routes), and the list of all that is
 * pinned.
 */

/** A pin of the open trip as it is called and the colour of its line. */
type OpenPin = PinName & { color: string };

/** Where a day of the open trip is found: the trip, then the day by its name or its number. */
function whereOf(day: Day): string[] {
  const trip = openTrip()!;
  return [trip.name, day.name || t('Day {n}', { n: trip.days.indexOf(day) + 1 })];
}

/** A pinned route of the open trip; none of a route the trip no longer holds. */
function openRoute(id: string): OpenPin | undefined {
  const route = routeById(id);
  const day = route && dayOfRoute(openTrip()!, id);
  return day && { name: routeLabel(route, day), where: whereOf(day), color: openRouteColors().get(id) ?? '#495057' };
}

/** A route of the open trip as its pin keeps it; none of a route that has no line yet. */
function keptRoute(id: string): KeptPin | undefined {
  const pin = openRoute(id);
  const points = pin ? lineOf(routeById(id)!) : [];
  return pin && points.length > 1 ? { name: pin.name, where: pin.where, line: { points, color: pin.color } } : undefined;
}

/** The open trip's pinned recordings, each once with the first of its days, by their id. */
function openRecordings(): Map<number, { recording: Recording; day: Day }> {
  const found = new Map<number, { recording: Recording; day: Day }>();
  for (const day of openTrip()?.days ?? []) {
    for (const recording of recordingsOf(day.id)) if (isRecordingPinned(recording.id) && !found.has(recording.id)) found.set(recording.id, { recording, day });
  }
  return found;
}

/** The open trip's pinned recordings whose tracks are read, as their pins keep them, by their id. */
function keptRecordings(): Map<number, KeptPin> {
  const kept = new Map<number, KeptPin>();
  for (const [id, { recording, day }] of openRecordings()) {
    const track = loadedTrack(recording);
    if (track) kept.set(id, { name: recording.name, where: whereOf(day), line: { points: track.points, color: recordingColor(recording) } });
  }
  return kept;
}

/** Copies the lines and names of the open trip's pins before it is left, so that they stay on the map. */
export function keepPinsOfOpenTrip(): void {
  const recordings = keptRecordings();
  keepPins(keptRoute, (id) => recordings.get(id));
}

/** The pinned lines the map draws beside the open trip's routes and the recordings shown. */
export function pinnedLines(): PinnedLine[] {
  const shown = new Set(shownRecordings().map((recording) => recording.id));
  return [...pinnedLinesAside(), ...[...keptRecordings()].flatMap(([id, kept]) => (shown.has(id) ? [] : [kept.line]))];
}

/** A pinned thing as the list over the map has it: what it is called, the colour of its line and how it is let go of. */
export type PinnedRow = OpenPin & { unpin: () => void };

/**
 * All that is pinned to the map, in the order it was pinned: the routes, then the
 * recordings on days, then, while the map follows the rides' tab, the rides pinned there.
 */
export function pinnedRows(): PinnedRow[] {
  const tripId = openTrip()?.id;
  const recordings = openRecordings();
  const asRow = (pin: KeptPin | undefined): OpenPin | undefined => pin && { name: pin.name, where: pin.where, color: pin.line.color };
  const openRecording = (id: number): OpenPin | undefined => {
    const found = recordings.get(id);
    return found && { name: found.recording.name, where: whereOf(found.day), color: recordingColor(found.recording) };
  };
  return [
    ...[...pinnedRoutes()].flatMap(([id, pin]) => {
      const row = pin.tripId === tripId ? openRoute(id) : asRow(pin.kept);
      return row ? [{ ...row, unpin: () => pinRoutes([id], false) }] : [];
    }),
    ...[...pinnedRecordings()].flatMap(([id, pin]) => {
      const row = pin.tripId === tripId ? openRecording(id) : asRow(pin.kept);
      return row ? [{ ...row, unpin: () => pinRecordings([id], false) }] : [];
    }),
    ...(mapTab() === 'recordings' ? ridesPinned() : []).map((ride) => ({ name: ride.name, where: [], color: recordingColor(ride), unpin: () => pinRides([ride.id], false) })),
  ];
}
