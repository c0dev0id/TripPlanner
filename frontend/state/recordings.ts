import { t } from '../i18n/t';
import { createEffect, createMemo, createResource, createRoot, createSignal, on } from 'solid-js';
import { errorMessage, fetchRideGpx, keepRide, listRecordings, lookUpRides, putRideOnDay, renameRide, takeRideOffDay, type FoundRidingDay, type KeptRide, type Recording } from '../api';
import { asName, type Day, type LngLat } from '../model/trip';
import { readRecording, type RecordedTrack } from '../recording/track';
import { decodeCached } from '../routing/polyline';
import { flushSave } from './autosave';
import { showWhole } from './drawing';
import { isRecordingPinned, pinRecordings } from './pins';
import { allRides, rideChanges, ridesChanged } from './rides';
import { openTripId, selectedDayId } from './trip';

/**
 * The rides on the open trip's days, loaded with the trip and again when rides change,
 * wherever that was done; changes go to the server at once. A ride is kept for itself
 * and is on a day by a link, so it may be on several. Its track is read from its file
 * once it is on the map.
 */

const [list, { mutate }] = createRoot(() =>
  createResource(
    () => openTripId() !== undefined && ([openTripId()!, rideChanges()] as const),
    async ([tripId]) => ({ tripId, recordings: await listRecordings(tripId) }),
  ),
);

/** The recordings of the open trip, once for each day a ride is on, by when they began; none until they are loaded. */
function allRecordings(): Recording[] {
  const loaded = list();
  return loaded && loaded.tripId === openTripId() ? loaded.recordings : [];
}

/** The order the server lists them in: by when they began, those without times first. */
const byStart = (a: Recording, b: Recording): number => (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.id - b.id;

/** Changes the list of the open trip's recordings as the server will list them, ahead of its answer. */
const change = (to: (recordings: Recording[]) => Recording[]): void => void mutate((loaded) => loaded && { ...loaded, recordings: to(loaded.recordings) });

const isOn = (dayId: string, id: number) => (r: Recording): boolean => r.id === id && r.dayId === dayId;

export const recordingsOf = (dayId: string): Recording[] => allRecordings().filter((r) => r.dayId === dayId);

/** The day's recordings among the ids, as a selection names them. */
export const recordingsAmong = (dayId: string, ids: readonly string[]): Recording[] => recordingsOf(dayId).filter((r) => ids.includes(String(r.id)));

/** The colours recordings are drawn in, apart from the planned routes', by their place on their day; one on no day in the first. */
const COLORS = ['#7048e8', '#0c8599', '#c2255c', '#5c940d', '#e67700', '#3b5bdb'];

export function recordingColor(recording: Recording): string {
  return COLORS[Math.max(0, recordingsOf(recording.dayId).findIndex((r) => r.id === recording.id)) % COLORS.length]!;
}

/** The recording opened for its figures. */
const [activeRecordingId, setActiveRecordingId] = createSignal<number>();
export { activeRecordingId, setActiveRecordingId };

/** The ride opened where it is none of the day shown: one opened in the list of rides, as a recording on no day. */
const listedRide = createRoot(() =>
  createMemo((): Recording | undefined => {
    const active = activeRecordingId();
    if (active === undefined || recordingsOf(selectedDayId() ?? '').some((r) => r.id === active)) return undefined;
    const ride = allRides().find((kept) => kept.id === active);
    return ride && { id: ride.id, dayId: '', name: ride.name, distanceM: ride.distanceM, startedAt: ride.startedAt };
  }),
);

/** The recordings on the map: of the day shown, the pinned ones and the one opened, and a ride opened in the list of rides. */
export function shownRecordings(): Recording[] {
  const dayId = selectedDayId();
  const active = activeRecordingId();
  const listed = listedRide();
  return [...allRecordings().filter((r) => r.dayId === dayId && (r.id === active || isRecordingPinned(r.id))), ...(listed ? [listed] : [])];
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

/** What was looked up for a day among the user's rides: `found` once the answer is there, and the day of riding among them shown on the map. */
const [lookup, setLookup] = createSignal<{ dayId: string; found?: FoundRidingDay[]; previewed?: FoundRidingDay }>();

createRoot(() => {
  // Another trip starts with nothing read and nothing looked up.
  createEffect(
    on(openTripId, () => {
      setTracks(new Map());
      setLookup(undefined);
    }),
  );
  // The tracks of the recordings on the map are read once; the one opened is shown whole when it arrives.
  const reading = new Set<number>();
  createEffect(() => {
    for (const recording of shownRecordings()) {
      if (tracks().has(recording.id) || reading.has(recording.id)) continue;
      reading.add(recording.id);
      fetchRideGpx(recording.id)
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

createRoot(() => {
  // A ride opened in the list keeps its track only while it is shown: the list is long, and a track is megabytes.
  createEffect(() => {
    const held = new Set([...allRecordings(), ...shownRecordings()].map((r) => r.id));
    const kept = [...tracks()].filter(([id]) => held.has(id));
    if (kept.length < tracks().size) setTracks(new Map(kept));
  });
});

/** Lists a ride as on a day of the open trip, where it is not yet, and pins it to the map, where it is to be seen. */
function listOnDay({ id, name, distanceM, startedAt }: KeptRide, dayId: string): void {
  change((recordings) => (recordings.some(isOn(dayId, id)) ? recordings : [...recordings, { id, dayId, name, distanceM, startedAt }].sort(byStart)));
  pinRecordings([id], true);
}

/** Puts a ride on a day of the open trip, which leaves it on the days it is on. */
export async function putOnDay(ride: KeptRide, dayId: string): Promise<void> {
  await putRideOnDay(ride.id, dayId);
  listOnDay(ride, dayId);
}

/** Takes a ride off a day, of the open trip or another; it stays a ride. */
export async function takeOffDay(id: number, dayId: string): Promise<void> {
  await takeRideOffDay(id, dayId);
  change((recordings) => recordings.filter((r) => !isOn(dayId, id)(r)));
}

/**
 * Keeps a GPX file of one track as a ride on the day, named after its track or, without
 * a name there, `fallback`; a file kept already is put on the day as the ride it is.
 * Throws for any other file.
 */
export async function addRecording(dayId: string, gpx: string, fallback: string): Promise<Recording> {
  const track = readRecording(gpx);
  const { ride } = await keepRide(asName(track.name ?? fallback) || t('Recording'), gpx, dayId);
  // Kept before it is listed, so that it is not read again from the file just sent.
  keep(ride.id, track);
  listOnDay(ride, dayId);
  return { ...ride, dayId };
}

/** Renames the ride, on every day it is on. */
export async function renameRecording(recording: Recording, name: string): Promise<void> {
  await renameRide(recording.id, name);
  change((recordings) => recordings.map((r) => (r.id === recording.id ? { ...r, name } : r)));
}

/** Puts the recording on another day of the open trip instead of the one it is on. */
export async function moveRecording(recording: Recording, dayId: string): Promise<void> {
  await putOnDay(recording, dayId);
  await takeOffDay(recording.id, recording.dayId);
}

export const lookupOf = (dayId: string) => (lookup()?.dayId === dayId ? lookup() : undefined);

export const closeLookup = (): void => void setLookup(undefined);

/** Looks up the days of riding that may be the day's, by the day as it is saved: begun on its date, or ridden along its routes. */
export async function lookUp(day: Day): Promise<void> {
  setLookup({ dayId: day.id });
  try {
    await flushSave();
    // The date a ride began on is the one on the user's clock; the offset is that of the day's noon.
    const found = await lookUpRides(openTripId()!, day.id, day.date ? -new Date(`${day.date}T12:00`).getTimezoneOffset() : 0);
    if (lookup()?.dayId === day.id) setLookup({ dayId: day.id, found });
  } catch (fault) {
    closeLookup();
    throw fault;
  }
}

/** Shows a found day of riding on the map, whole. */
export function preview(ridingDay: FoundRidingDay): void {
  setLookup((looked) => looked && { ...looked, previewed: ridingDay });
  showWhole(ridingDay.rides.flatMap((ride) => decodeCached(ride.line)));
}

export const isPreviewed = (ridingDay: FoundRidingDay): boolean => lookup()?.previewed === ridingDay;

/** The lines of the found day of riding shown on the map, in the colours its rides would have on the day. */
export function previewedLines(): { id: number; points: LngLat[]; color: string }[] {
  const looked = lookup();
  if (!looked?.previewed) return [];
  const taken = recordingsOf(looked.dayId).length;
  return looked.previewed.rides.map((ride, i) => ({ id: ride.id, points: decodeCached(ride.line), color: COLORS[(taken + i) % COLORS.length]! }));
}

/** Puts the rides of a found day of riding on the day of the open trip and pins them to the map; it is found no longer. */
export async function assignRidingDay(dayId: string, ridingDay: FoundRidingDay): Promise<void> {
  for (const ride of ridingDay.rides) await putOnDay(ride, dayId);
  setLookup((looked) => looked && { dayId: looked.dayId, found: looked.found?.filter((found) => found !== ridingDay) });
}

/** What the last action on a day's recordings came to, said under them. */
const [note, setNote] = createSignal<{ dayId: string; text: string; error: boolean }>();

export const recordingNote = (dayId: string) => (note()?.dayId === dayId ? note() : undefined);

/** Runs an action on a day's recordings, then says under them what it did where it says something, or why it failed; the rides are read again once for all it did. */
export async function recordingAction(dayId: string, job: () => Promise<string | void>): Promise<void> {
  try {
    const text = await job();
    setNote(text ? { dayId, text, error: false } : undefined);
  } catch (fault) {
    setNote({ dayId, text: errorMessage(fault), error: true });
  }
  ridesChanged();
}

/** What is said when rides were put on a day. */
export const addedText = (rides: readonly KeptRide[]): string => (rides.length === 1 ? t('“{name}” added as a recording.', { name: rides[0]!.name }) : t('{n} recordings added.', { n: rides.length }));
