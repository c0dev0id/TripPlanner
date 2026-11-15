import { createMemo, createRoot, createSignal } from 'solid-js';
import type { KeptRide } from '../api';
import type { LngLat } from '../model/trip';
import { sectionOn, trackOnSection } from '../recording/section';
import type { RecordedTrack } from '../recording/track';
import { decodePolyline } from '../routing/polyline';
import { mapTab } from './library';
import { loadedTrack } from './recordings';
import { allRides } from './rides';

/**
 * The section looked up among the rides: a stretch marked on a ride by its two ends, in
 * the direction ridden. While it is marked, the rides list only those that rode it, and a
 * ride opened in their tab shows that part of itself alone. Kept for the page.
 */

/** The line of the section, from its start to its end. */
const [section, setSection] = createSignal<readonly LngLat[]>();
export { section };

/** The first end marked on a ride, where the second is still to come. */
const [sectionStart, setSectionStart] = createSignal<{ rideId: number; lngLat: LngLat; index: number }>();
export { sectionStart };

/** Marks an end of the section on a ride's points: the first waits for the second, which makes the section of the stretch between them, as the ride ran it. */
export function markSectionEnd(rideId: number, points: readonly LngLat[], index: number): void {
  const start = sectionStart();
  if (!start || start.rideId !== rideId || start.index === index) return void setSectionStart({ rideId, lngLat: points[index]!, index });
  const [from, to] = start.index < index ? [start.index, index] : [index, start.index];
  setSection(points.slice(from, to + 1));
  setSectionStart(undefined);
}

/** Lets go of the section, and of an end marked for the next. */
export function clearSection(): void {
  setSection(undefined);
  setSectionStart(undefined);
}

/** Where the section's ends lie, or the first end marked, while the rides' tab is shown. */
export const sectionEnds = (): LngLat[] => {
  if (mapTab() !== 'recordings') return [];
  const line = section();
  const start = sectionStart();
  return line ? [line[0]!, line[line.length - 1]!] : start ? [start.lngLat] : [];
};

/** The ids of the rides that rode the section, by their thinned lines, decoded for this alone and not kept; none while no section is marked. */
export const ridesOnSection = createRoot(() =>
  createMemo((): ReadonlySet<number> | undefined => {
    const line = section();
    return line && new Set(allRides().flatMap((ride) => (sectionOn(decodePolyline(ride.line), line) ? [ride.id] : [])));
  }),
);

/** Each track's part on the section, worked out once per section. */
const parts = new WeakMap<RecordedTrack, { line: readonly LngLat[]; part: RecordedTrack | undefined }>();

/** A recording's track as it is shown, once read: in the rides' tab, its part on the section while one is marked and it rode it; else whole. */
export function shownTrack(recording: KeptRide): RecordedTrack | undefined {
  const track = loadedTrack(recording);
  const line = section();
  if (!track || !line || mapTab() !== 'recordings') return track;
  let cached = parts.get(track);
  if (cached?.line !== line) {
    cached = { line, part: trackOnSection(track, line) };
    parts.set(track, cached);
  }
  return cached.part ?? track;
}
