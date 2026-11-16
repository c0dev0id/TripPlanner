import { routePositions } from '../routing/legs';
import { keepPinnedLines, isRecordingPinned, pinnedLinesAside, type PinnedLine } from './pins';
import { loadedTrack, recordingColor, recordingsOf, shownRecordings } from './recordings';
import { openRouteColors } from './routeColors';
import { openTrip, routeById } from './trip';

/**
 * The lines of what is pinned as the map draws them where nothing else does: the copies
 * of trips that are not open, and the open trip's pinned recordings on days that are
 * not shown. The open trip's pinned routes are drawn with its routes.
 */

/** A route of the open trip as a pinned line. */
function routeLine(id: string): PinnedLine | undefined {
  const route = routeById(id);
  return route && { points: routePositions(route), color: openRouteColors().get(id) ?? '#495057' };
}

/** The open trip's pinned recordings whose tracks are read, each once, as pinned lines by their id. */
function recordingLines(): Map<number, PinnedLine> {
  const lines = new Map<number, PinnedLine>();
  for (const recording of (openTrip()?.days ?? []).flatMap((day) => recordingsOf(day.id))) {
    const track = isRecordingPinned(recording.id) && !lines.has(recording.id) ? loadedTrack(recording) : undefined;
    if (track) lines.set(recording.id, { points: track.points, color: recordingColor(recording) });
  }
  return lines;
}

/** Copies the lines of the open trip's pins before it is left, so that they stay on the map. */
export function keepPinsOfOpenTrip(): void {
  const recordings = recordingLines();
  keepPinnedLines(routeLine, (id) => recordings.get(id));
}

/** The pinned lines the map draws beside the open trip's routes and the recordings shown. */
export function pinnedLines(): PinnedLine[] {
  const shown = new Set(shownRecordings().map((recording) => recording.id));
  return [...pinnedLinesAside(), ...[...recordingLines()].flatMap(([id, line]) => (shown.has(id) ? [] : [line]))];
}
