import { t } from '../i18n/t';
import { createEffect, createResource, createRoot, createSignal, on } from 'solid-js';
import {
  addRecording as postRecording,
  deleteRecording,
  errorMessage,
  fetchRecordingGpx,
  listRecordings,
  lookUpRecordings,
  moveRecording as putOnDay,
  renameRecording as patchRecording,
  type Recording,
  type WaitingRecording,
} from '../api';
import { asName, type Day, type LngLat } from '../model/trip';
import { readRecording, type RecordedTrack } from '../recording/track';
import { decodePolyline } from '../routing/polyline';
import { flushSave } from './autosave';
import { showWhole } from './drawing';
import { recordingOnMap, setRecordingEyes } from './eyes';
import { openTripId, selectedDayId } from './trip';

/**
 * The open trip's recordings, loaded with the trip; changes go to the server at once.
 * A recording's track is read from its file once it is on the map.
 */

const [list, { mutate }] = createRoot(() => createResource(openTripId, async (tripId) => ({ tripId, recordings: await listRecordings(tripId) })));

/** The recordings of the open trip, in the order they were added; none until they are loaded. */
function allRecordings(): Recording[] {
  const loaded = list();
  return loaded && loaded.tripId === openTripId() ? loaded.recordings : [];
}

export const recordingsOf = (dayId: string): Recording[] => allRecordings().filter((r) => r.dayId === dayId);

/** The colours recordings are drawn in, apart from the planned routes', by their place on their day. */
const COLORS = ['#7048e8', '#0c8599', '#c2255c', '#5c940d', '#e67700', '#3b5bdb'];

export function recordingColor(recording: Recording): string {
  return COLORS[recordingsOf(recording.dayId).findIndex((r) => r.id === recording.id) % COLORS.length]!;
}

/** The recording opened for its figures, which is on the map whatever its eye says. */
const [activeRecordingId, setActiveRecordingId] = createSignal<number>();
export { activeRecordingId, setActiveRecordingId };

/** The recordings on the map: of the day shown, those whose eye and whose group's are open, and the one opened. */
export function shownRecordings(): Recording[] {
  const dayId = selectedDayId();
  const active = activeRecordingId();
  return allRecordings().filter((r) => r.dayId === dayId && (r.id === active || recordingOnMap(r.id)));
}

/** Each read recording's track, or why it could not be read, by recording id. */
const [tracks, setTracks] = createSignal<ReadonlyMap<number, RecordedTrack | Error>>(new Map());

export const trackOf = (recording: Recording): RecordedTrack | Error | undefined => tracks().get(recording.id);

/** The recording's track once read; nothing while it is read or where it could not be. */
export function loadedTrack(recording: Recording): RecordedTrack | undefined {
  const track = trackOf(recording);
  return track instanceof Error ? undefined : track;
}

const keep = (id: number, track: RecordedTrack | Error) => setTracks(new Map(tracks()).set(id, track));

/** What was looked up for a day among the recordings that wait for theirs: `found` once the answer is there, and the one of them shown on the map. */
const [lookup, setLookup] = createSignal<{ dayId: string; found?: WaitingRecording[]; previewedId?: number }>();

createRoot(() => {
  // Another trip starts with nothing opened, nothing read and nothing looked up.
  createEffect(
    on(openTripId, () => {
      setActiveRecordingId(undefined);
      setTracks(new Map());
      setLookup(undefined);
    }),
  );
  // The tracks of the recordings on the map are read once; the one opened is shown whole when it arrives.
  const reading = new Set<number>();
  createEffect(() => {
    const tripId = openTripId();
    for (const recording of shownRecordings()) {
      if (tripId === undefined || tracks().has(recording.id) || reading.has(recording.id)) continue;
      reading.add(recording.id);
      fetchRecordingGpx(tripId, recording.id)
        .then((gpx) => {
          const track = readRecording(gpx);
          keep(recording.id, track);
          if (recording.id === activeRecordingId()) showWhole(track.points);
        })
        .catch((fault: unknown) => keep(recording.id, fault instanceof Error ? fault : new Error(String(fault))))
        .finally(() => reading.delete(recording.id));
    }
  });
});

/**
 * Adds a GPX file of one track to the day as a recording, under `name`, or else named after
 * its track or, without a name there, `fallback`; and opens its eye. Throws for any other
 * file.
 */
export async function addRecording(dayId: string, gpx: string, naming: { name: string } | { fallback: string }): Promise<Recording> {
  const track = readRecording(gpx);
  const name = 'name' in naming ? naming.name : (track.name ?? naming.fallback);
  const recording = await postRecording(openTripId()!, dayId, asName(name) || t('Recording'), gpx);
  // Kept before it is listed, so that it is not read again from the file just sent.
  keep(recording.id, track);
  mutate((loaded) => loaded && { ...loaded, recordings: [...loaded.recordings, recording] });
  setRecordingEyes([recording.id], true);
  return recording;
}

export async function renameRecording(recording: Recording, name: string): Promise<void> {
  await patchRecording(openTripId()!, recording.id, name);
  mutate((loaded) => loaded && { ...loaded, recordings: loaded.recordings.map((r) => (r.id === recording.id ? { ...r, name } : r)) });
}

/** Puts the recording on another day of the open trip. */
export async function moveRecording(recording: Recording, dayId: string): Promise<void> {
  await putOnDay(openTripId()!, recording.id, dayId);
  mutate((loaded) => loaded && { ...loaded, recordings: loaded.recordings.map((r) => (r.id === recording.id ? { ...r, dayId } : r)) });
}

export const lookupOf = (dayId: string) => (lookup()?.dayId === dayId ? lookup() : undefined);

export const closeLookup = (): void => void setLookup(undefined);

/** Looks up the waiting recordings that may be the day's, by the day as it is saved: began on its date, or ran along its routes. */
export async function lookUp(day: Day): Promise<void> {
  setLookup({ dayId: day.id });
  try {
    await flushSave();
    // The date a ride began on is the one on the user's clock; the offset is that of the day's noon.
    const found = await lookUpRecordings(openTripId()!, day.id, day.date ? -new Date(`${day.date}T12:00`).getTimezoneOffset() : 0);
    if (lookup()?.dayId === day.id) setLookup({ dayId: day.id, found });
  } catch (fault) {
    closeLookup();
    throw fault;
  }
}

/** Shows a found recording on the map, whole. */
export function preview(waiting: WaitingRecording): void {
  setLookup((looked) => looked && { ...looked, previewedId: waiting.id });
  showWhole(decodePolyline(waiting.line));
}

export const isPreviewed = (waiting: WaitingRecording): boolean => lookup()?.previewedId === waiting.id;

/** The colour the next recording of the day is drawn in. */
const nextColor = (dayId: string): string => COLORS[recordingsOf(dayId).length % COLORS.length]!;

/** The line of the found recording shown on the map, in the colour it would have on its day. */
export function previewedLines(): { id: number; points: LngLat[]; color: string }[] {
  const looked = lookup();
  const waiting = looked?.found?.find((r) => r.id === looked.previewedId);
  return waiting ? [{ id: waiting.id, points: decodePolyline(waiting.line), color: nextColor(looked!.dayId) }] : [];
}

/** Puts a found recording on its day of the open trip, as it is, its eye open: it waits no longer. */
export async function assignRecording(dayId: string, waiting: WaitingRecording): Promise<void> {
  await putOnDay(waiting.tripId, waiting.id, dayId);
  const { id, name, distanceM, startedAt } = waiting;
  mutate((loaded) => loaded && { ...loaded, recordings: [...loaded.recordings, { id, dayId, name, distanceM, startedAt }].sort((a, b) => a.id - b.id) });
  setLookup((looked) => looked && { ...looked, found: looked.found?.filter((r) => r.id !== id) });
  setRecordingEyes([id], true);
}

/** The open trip's recording of the id. */
export const recordingById = (id: number): Recording | undefined => allRecordings().find((r) => r.id === id);

export async function removeRecording(recording: Recording): Promise<void> {
  await deleteRecording(openTripId()!, recording.id);
  mutate((loaded) => loaded && { ...loaded, recordings: loaded.recordings.filter((r) => r.id !== recording.id) });
}

/** What the last action on a day's recordings came to, said under them. */
const [note, setNote] = createSignal<{ dayId: string; text: string; error: boolean }>();

export const recordingNote = (dayId: string) => (note()?.dayId === dayId ? note() : undefined);

/** Runs an action on a day's recordings, then says under them what it did where it says something, or why it failed. */
export async function recordingAction(dayId: string, job: () => Promise<string | void>): Promise<void> {
  try {
    const text = await job();
    setNote(text ? { dayId, text, error: false } : undefined);
  } catch (fault) {
    setNote({ dayId, text: errorMessage(fault), error: true });
  }
}

/** The recording's GPX file as kept, for copying it. */
export const recordingGpx = (recording: Recording): Promise<string> => fetchRecordingGpx(openTripId()!, recording.id);
