import { createEffect, createResource, createRoot, createSignal, on } from 'solid-js';
import { addRecording as postRecording, deleteRecording, errorMessage, fetchRecordingGpx, listRecordings, renameRecording as patchRecording, type Recording } from '../api';
import { asName } from '../model/trip';
import { readRecording, type RecordedTrack } from '../recording/track';
import { openTripId } from './trip';

/**
 * The open trip's recordings, loaded with the trip; changes go to the server at once.
 * Their tracks are read from their files once a day's recordings are shown.
 */

const [list, { mutate }] = createRoot(() => createResource(openTripId, async (tripId) => ({ tripId, recordings: await listRecordings(tripId) })));

/** The recordings of the open trip, in the order they were added; none until they are loaded. */
export function allRecordings(): Recording[] {
  const loaded = list();
  return loaded && loaded.tripId === openTripId() ? loaded.recordings : [];
}

export const recordingsOf = (dayId: string): Recording[] => allRecordings().filter((r) => r.dayId === dayId);

/** The colours recordings are drawn in, apart from the planned routes', by their place on their day. */
const COLORS = ['#7048e8', '#0c8599', '#c2255c', '#5c940d', '#e67700', '#3b5bdb'];

export function recordingColor(recording: Recording): string {
  return COLORS[recordingsOf(recording.dayId).findIndex((r) => r.id === recording.id) % COLORS.length]!;
}

/** The days whose recordings are shown: listed under the day and drawn on the map. */
const [shownDays, setShownDays] = createSignal<ReadonlySet<string>>(new Set());

export const recordingsShown = (dayId: string): boolean => shownDays().has(dayId);

export function showRecordings(dayId: string, shown: boolean): void {
  const next = new Set(shownDays());
  if (shown) next.add(dayId);
  else next.delete(dayId);
  setShownDays(next);
}

/** The recordings shown, of every day whose recordings are shown. */
export const shownRecordings = (): Recording[] => allRecordings().filter((r) => shownDays().has(r.dayId));

/** Each read recording's track, or why it could not be read, by recording id. */
const [tracks, setTracks] = createSignal<ReadonlyMap<number, RecordedTrack | Error>>(new Map());

export const trackOf = (recording: Recording): RecordedTrack | Error | undefined => tracks().get(recording.id);

const keep = (id: number, track: RecordedTrack | Error) => setTracks(new Map(tracks()).set(id, track));

createRoot(() => {
  // Another trip starts with nothing shown and nothing read.
  createEffect(
    on(openTripId, () => {
      setShownDays(new Set<string>());
      setTracks(new Map());
    }),
  );
  // The tracks of the recordings shown are read once.
  const reading = new Set<number>();
  createEffect(() => {
    const tripId = openTripId();
    for (const recording of shownRecordings()) {
      if (tripId === undefined || tracks().has(recording.id) || reading.has(recording.id)) continue;
      reading.add(recording.id);
      fetchRecordingGpx(tripId, recording.id)
        .then((gpx) => keep(recording.id, readRecording(gpx)))
        .catch((fault: unknown) => keep(recording.id, fault instanceof Error ? fault : new Error(String(fault))))
        .finally(() => reading.delete(recording.id));
    }
  });
});

/**
 * Adds a GPX file of one track to the day as a recording, under `name`, or else named after
 * its track or, without a name there, `fallback`; and shows the day's recordings. Throws
 * for any other file.
 */
export async function addRecording(dayId: string, gpx: string, naming: { name: string } | { fallback: string }): Promise<Recording> {
  const track = readRecording(gpx);
  const name = 'name' in naming ? naming.name : (track.name ?? naming.fallback);
  const recording = await postRecording(openTripId()!, dayId, asName(name) || 'Recording', gpx);
  // Kept before it is listed, so that it is not read again from the file just sent.
  keep(recording.id, track);
  mutate((loaded) => loaded && { ...loaded, recordings: [...loaded.recordings, recording] });
  showRecordings(dayId, true);
  return recording;
}

export async function renameRecording(recording: Recording, name: string): Promise<void> {
  await patchRecording(openTripId()!, recording.id, name);
  mutate((loaded) => loaded && { ...loaded, recordings: loaded.recordings.map((r) => (r.id === recording.id ? { ...r, name } : r)) });
}

export async function removeRecording(recording: Recording): Promise<void> {
  await deleteRecording(openTripId()!, recording.id);
  mutate((loaded) => loaded && { ...loaded, recordings: loaded.recordings.filter((r) => r.id !== recording.id) });
}

/** What the last action on a day's recordings came to, said under them. */
const [note, setNote] = createSignal<{ dayId: string; text: string; error: boolean }>();

export const recordingNote = (dayId: string) => (note()?.dayId === dayId ? note() : undefined);

/** Runs an action on a day's recordings, then says under them what it did where it says something, or why it failed, and shows them. */
export async function recordingAction(dayId: string, job: () => Promise<string | undefined>): Promise<void> {
  try {
    const text = await job();
    setNote(text ? { dayId, text, error: false } : undefined);
  } catch (fault) {
    setNote({ dayId, text: errorMessage(fault), error: true });
  }
  showRecordings(dayId, true);
}

/** The recording's GPX file as kept, for copying it. */
export const recordingGpx = (recording: Recording): Promise<string> => fetchRecordingGpx(openTripId()!, recording.id);
