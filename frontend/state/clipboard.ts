import { t } from '../i18n/t';
import { createSignal } from 'solid-js';
import { changeTrip, copyMedia as copyMediaTo, errorMessage, fetchRideGpx, fetchStashGpx, fetchStashMedia, listMedia, listRecordings, moveMedia, type KeptRide, type Recording } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts } from '../gpx/import';
import { filesIn, sharesOf, takes, wholeFile, type ClipKind, type Place } from '../model/paste';
import type { CopiedFolder, StashFile, StashItem, StashPart } from '../model/stash';
import { newId, type Day, type Route, type Stop } from '../model/trip';
import { copiedRoute, defaultProfile, removeParts, stopsBoundTo, type CopiedRoute, type PartKind } from '../routing/dayEdit';
import { counted, listText } from '../ui/format';
import { askConfirmation } from '../ui/confirm';
import type { MenuItem } from '../ui/menu';
import { flushSave } from './autosave';
import { addFiles, bringMedia, mediaAction, relistMedia } from './media';
import { addedText, putOnDay, recordingAction, takeOffDay } from './recordings';
import { addParts, mergeDaysInto, moveDaysAfter, movePartsToDay, moveStopsIntoRoute, openTrip, openTripId, pasteDays, pasteRoutes, pasteStops, pasteStopsIntoRoute, removeParts as removeFromOpenTrip, selectDay } from './trip';

/**
 * What was copied or cut to be pasted: days of a trip (`tripId`) with their routes and stops, categories of a
 * list of places, routes with the stops bound to them, stops, or places with the
 * category each is of (`kinds`), rides, the files and links kept with days, trips and
 * folders of the library, files of the Stash, which are imported where they are pasted,
 * or routes, tracks, waypoints and media of such files. Kept from one trip to another
 * until it is pasted, which empties the clipboard, or until something else is copied or
 * cut. What was cut is taken from where it was once it is pasted.
 */
type Clip = (
  | { days: Day[]; tripId: number }
  | { categories: Day[] }
  | { routes: CopiedRoute[] }
  | { stops: Stop[]; kinds?: readonly string[] }
  | { recordings: KeptRide[]; cutFrom?: string }
  | { media: CopiedMedia }
  | { library: LibraryClip }
  | { files: StashFile[]; folders: CopiedFolder[] }
  | { parts: StashPart[] }
) & {
  /** Where the parts were cut from. */
  cut?: { tripId: number; kind: PartKind; ids: string[] };
};

/** Files and links kept with days of a trip, by id, with their names: copied, or cut to be moved where they are pasted. The server holds the files. */
export interface CopiedMedia {
  tripId: number;
  ids: number[];
  names: string[];
  move: boolean;
}

/** Trips and folders of the library, by id: copied, or cut to be moved where they are pasted. */
export interface LibraryClip {
  tripIds: number[];
  folderIds: number[];
  move: boolean;
}

const [clip, setClip] = createSignal<Clip>();

/** Copies trips, or cuts trips and folders, of the library. */
export function copyLibraryItems(items: LibraryClip): void {
  setClip({ library: items });
}

/** The trips and folders on the clipboard, if that is what it holds. */
export function libraryClip(): LibraryClip | undefined {
  const copied = clip();
  return copied && 'library' in copied ? copied.library : undefined;
}

/**
 * Copies files of the Stash, and folders of it with what they hold, to be imported where
 * they are pasted: among the trips a file as a trip and a folder as a trip of its files,
 * or with folders in it as a folder of trips. Files alone also go as days into a trip,
 * as routes and waypoints into a day, as places into a list.
 */
export function copyStashFiles(files: StashFile[], folders: CopiedFolder[] = []): void {
  setClip({ files, folders });
}

/** Copies routes, tracks and waypoints of files of the Stash, to be pasted into another file there, into a day, a trip or a list of places. */
export function copyStashParts(parts: StashPart[]): void {
  setClip({ parts });
}

/** The files and folders of the Stash on the clipboard, if that is what it holds. */
export function stashFilesClip(): { files: StashFile[]; folders: CopiedFolder[] } | undefined {
  const copied = clip();
  return copied && 'files' in copied ? copied : undefined;
}

/** Empties the clipboard: what is on it is pasted once. */
export const clearClip = (): void => void setClip(undefined);

/** Copies routes with the stops bound to them. */
export function copyRoutes(routes: CopiedRoute[]): void {
  setClip({ routes });
}

/**
 * Copies days, routes or stops of the open trip; cut, they leave it when they are pasted.
 * Of a list of places the days are its categories, and its stops places, each copied
 * with the name of its category.
 */
export function copyParts(kind: PartKind, ids: readonly string[], cut = false): void {
  const trip = openTrip();
  if (!trip) return;
  const from = cut ? { cut: { tripId: trip.id, kind, ids: [...ids] } } : {};
  const list = trip.kind === 'collection';
  const days = trip.days.filter((d) => ids.includes(d.id));
  if (kind === 'day') setClip(list ? { categories: days, ...from } : { days, tripId: trip.id, ...from });
  else if (kind === 'route') setClip({ routes: trip.days.flatMap((d) => d.routes.filter((r) => ids.includes(r.id)).map((r) => copiedRoute(d, r))), ...from });
  else {
    const stops = trip.days.flatMap((d) => d.stops.filter((s) => ids.includes(s.id)).map((stop) => ({ stop, kind: d.name })));
    setClip({ stops: stops.map(({ stop }) => stop), ...(list ? { kinds: stops.map(({ kind: of }) => of) } : {}), ...from });
  }
}

/** Whether the part of the open trip is cut and waits to be pasted. */
export function isCut(id: string): boolean {
  const cut = clip()?.cut;
  return cut !== undefined && cut.tripId === openTripId() && cut.ids.includes(id);
}

/** Copies rides, to be put on the day they are pasted onto; cut from the day `cutFrom`, they are taken off it then. */
export function copyRecordings(recordings: KeptRide[], cutFrom?: string): void {
  setClip({ recordings, ...(cutFrom === undefined ? {} : { cutFrom }) });
}

/** Whether the recording is cut from its day and waits to be pasted. */
export function isCutRecording(recording: Recording): boolean {
  const copied = clip();
  return copied !== undefined && 'recordings' in copied && copied.cutFrom === recording.dayId && copied.recordings.some((ride) => ride.id === recording.id);
}

/** Copies or cuts files and links of days of a trip. */
export function copyMedia(media: CopiedMedia): void {
  setClip({ media });
}

/** Whether the file or link of the open trip is cut and waits to be pasted. */
export function isCutMedia(id: number): boolean {
  const copied = clip();
  return copied !== undefined && 'media' in copied && copied.media.move && copied.media.tripId === openTripId() && copied.media.ids.includes(id);
}

/** Pastes rides onto a day of the open trip: each is put on it, and what was cut is taken off the day it was cut from. */
async function pasteRecordings(dayId: string, recordings: readonly KeptRide[], cutFrom: string | undefined): Promise<void> {
  setClip(undefined);
  await recordingAction(dayId, async () => {
    for (const ride of recordings) {
      await putOnDay(ride, dayId);
      if (cutFrom !== undefined && cutFrom !== dayId) await takeOffDay(ride.id, cutFrom);
    }
    return addedText(recordings);
  });
}

/** A recording's track as a route of the day under the recording's name, with every point; its waypoints are left aside. */
function recordingAsRoute(dayId: string, name: string, gpx: string): CopiedRoute[] {
  const day = openTrip()?.days.find((d) => d.id === dayId);
  const { routes } = gpxToDayParts(parseGpx(gpx), { fileName: name, profile: day ? defaultProfile(day) : 'motorcycle', newId });
  return routes.map((route) => ({ route: { ...route, name }, stops: [], from: { date: null, name: '' } }));
}

const KINDS = ['days', 'categories', 'routes', 'stops', 'recordings', 'media', 'parts'] as const;

/** What kind of clipboard it is, as the places tell them apart; none for trips, lists and folders, which go by their trees. */
const kindOf = (copied: Clip): ClipKind | undefined => ('files' in copied ? (copied.folders.length > 0 ? 'folders' : 'files') : KINDS.find((kind) => kind in copied));

/** What the clipboard holds of the Stash, each file as all of it; none where it holds something else. */
const stashParts = (copied: Clip): StashPart[] | undefined =>
  'parts' in copied ? copied.parts : 'files' in copied ? [...copied.files, ...copied.folders.flatMap(filesIn)].map(wholeFile) : undefined;

/** Whether the place takes what is on the clipboard. */
function taken(place: Place, copied: Clip): boolean {
  const kind = kindOf(copied);
  return kind !== undefined && takes(place, kind, stashParts(copied));
}

/** The places of copied categories, each with the name of its category. */
const placesOf = (categories: readonly Day[]): { stops: Stop[]; kinds: string[] } => ({ stops: categories.flatMap((of) => of.stops), kinds: categories.flatMap((of) => of.stops.map(() => of.name)) });

/**
 * What a paste menu item says it pastes into the place, by kind and number and never by
 * name, which may be long: Paste 1 route, Paste 3 places. Of parts of files of the Stash
 * it counts what the place takes.
 */
function pasteLabel(copied: Clip, place: Place): string {
  const some = (n: number, noun: string) => n > 0 && counted(n, noun);
  const what = (...parts: (string | false)[]) => t('Paste {what}', { what: listText(parts) });
  if ('files' in copied) return what(some(copied.folders.length, 'folder'), some(copied.files.length, 'file'));
  if ('parts' in copied) {
    const parts = sharesOf(place, copied.parts);
    const items = (kind: StashItem['kind']) => parts.reduce((sum, part) => sum + part.items.filter((item) => item.kind === kind).length, 0);
    const waypoints = parts.reduce((sum, part) => sum + (part.waypoints ? part.file.waypoints : 0), 0);
    const media = parts.reduce((sum, part) => sum + (part.media ? part.file.media.length : 0), 0);
    return what(some(items('route'), 'route'), some(items('track'), 'track'), some(waypoints, 'waypoint'), some(media, 'attachment'));
  }
  if ('recordings' in copied) return what(some(copied.recordings.length, 'recording'));
  if ('media' in copied) return what(some(copied.media.names.length, 'attachment'));
  if ('days' in copied) return what(some(copied.days.length, 'day'));
  if ('categories' in copied) return what(some(copied.categories.length, 'category'));
  if ('stops' in copied) return what(some(copied.stops.length, copied.kinds ? 'place' : 'stop'));
  if (!('routes' in copied)) return t('Paste');
  const tracks = copied.routes.filter(({ route }) => route.kind === 'track').length;
  return what(some(copied.routes.length - tracks, 'route'), some(tracks, 'track'));
}

/**
 * Imports parts of files of the Stash into a day of the open trip, as a file picked for
 * the day is read: the routes and tracks taken, with the waypoints on their points, and
 * with a file's waypoints the others as free stops. A file's media, where they are
 * taken, are kept with the day.
 */
async function pastePartsIntoDay(dayId: string, parts: readonly StashPart[]): Promise<void> {
  const tripId = openTripId();
  const day = openTrip()?.days.find((d) => d.id === dayId);
  if (!day) return;
  try {
    const added = { routes: [] as Route[], stops: [] as Stop[] };
    for (const { file, items, waypoints } of parts) {
      const gpx = parseGpx(await fetchStashGpx(file.id));
      const taken = (kind: StashItem['kind']) => (_: unknown, position: number) => items.some((item) => item.kind === kind && item.position === position);
      const read = gpxToDayParts({ ...gpx, routes: gpx.routes.filter(taken('route')), tracks: gpx.tracks.filter(taken('track')) }, { fileName: file.name, profile: defaultProfile(day), newId });
      added.routes.push(...read.routes);
      added.stops.push(...(waypoints ? read.stops : read.routes.flatMap((route) => stopsBoundTo(route, read.stops))));
    }
    if (openTripId() !== tripId) return;
    selectDay(dayId);
    addParts(added);
    // The media taken are kept with the day, as files added to it are, one after the other.
    for (const part of parts.filter((taken) => taken.media)) {
      for (const one of part.file.media) await addFiles(dayId, [await fetchStashMedia(part.file.id, one)]);
    }
  } catch (error) {
    await askConfirmation(errorMessage(error), t('OK'));
  }
}

/**
 * Takes what was cut from the trip it was cut from, once it is pasted elsewhere: from
 * the open trip as an edit of it, from another on the server, after the open one is
 * saved: the parts are then in both trips for a moment, never in neither.
 */
async function removeFromSource(cut: NonNullable<Clip['cut']>): Promise<void> {
  try {
    if (cut.tripId === openTripId()) return removeFromOpenTrip(cut.kind, cut.ids);
    await flushSave();
    await changeTrip(cut.tripId, (trip) => removeParts(trip, cut.kind, cut.ids));
  } catch (error) {
    await askConfirmation(t('The items were pasted here but could not be removed from the trip they were cut from: {error}', { error: errorMessage(error) }), t('OK'));
  }
}

/**
 * Brings what the days of a trip hold beside their routes and stops to the days pasted
 * of them (`made`, in their order), which the server knows by then: their media, moved
 * where the days were cut and copied otherwise, and the rides they are on.
 */
export async function bringWithDays(tripId: number, days: readonly Day[], made: readonly string[], move: boolean): Promise<void> {
  const [media, recordings] = await Promise.all([listMedia(tripId), listRecordings(tripId)]);
  for (const [n, day] of days.entries()) {
    for (const entry of media.filter((kept) => kept.dayId === day.id)) await (move ? moveMedia(tripId, entry.id, made[n]!) : copyMediaTo(tripId, entry.id, made[n]!));
    for (const ride of recordings.filter((on) => on.dayId === day.id)) await putOnDay(ride, made[n]!);
  }
  relistMedia();
}

/**
 * Pastes days of whichever trip after a day of the open one, with their media and the
 * rides they are on, and takes those that were cut from their trip once all of it has
 * arrived.
 */
async function pasteDaysAfter(afterId: string, days: readonly Day[], tripId: number, cut: Clip['cut']): Promise<void> {
  try {
    const made = pasteDays(days, afterId);
    await flushSave();
    await bringWithDays(tripId, days, made, cut !== undefined);
  } catch (error) {
    await askConfirmation(errorMessage(error), t('OK'));
    return;
  }
  if (cut) await removeFromSource(cut);
}

/**
 * Pastes what is on the clipboard: cut from the open trip the parts move, with `move`,
 * and keep their ids, and with them their journal; otherwise copies are made, with
 * `paste`, and what was cut from another trip is taken from it.
 */
function pasted(copied: Clip, move: (ids: string[]) => void, paste: () => void): () => void {
  return () => {
    const cut = copied.cut;
    setClip(undefined);
    if (cut && cut.tripId === openTripId()) move(cut.ids);
    else paste();
    if (cut && cut.tripId !== openTripId()) void removeFromSource(cut);
  };
}

/**
 * The menu items that paste what is on the clipboard into a part of the open trip, as
 * `model/paste.ts` says what a day, a category of a list of places and a route take.
 * None where the clipboard holds nothing for the part, or was cut from it. A recording
 * also pastes as a route.
 */
export function pasteItems(kind: PartKind, id: string): MenuItem[] {
  const copied = clip();
  const trip = openTrip();
  if (!copied || !trip || kind === 'stop') return [];
  const place: Place = kind === 'route' ? 'route' : trip.kind === 'collection' ? 'category' : 'day';
  if (!taken(place, copied) || copied.cut?.ids.includes(id)) return [];
  const label = pasteLabel(copied, place);
  if (place === 'route') return 'stops' in copied ? [{ label, run: pasted(copied, (ids) => moveStopsIntoRoute(ids, id), () => pasteStopsIntoRoute(id, copied.stops)) }] : [];
  const shown = (paste: () => void) => () => {
    paste();
    selectDay(id);
  };
  const parts = stashParts(copied);
  if (parts) {
    return [{ label, run: () => {
          setClip(undefined);
          void pastePartsIntoDay(id, sharesOf(place, parts));
        } }];
  }
  if ('days' in copied) {
    // Within the open trip cut days move and keep all that hangs on them; anything else is pasted as copies, which their media and rides follow.
    return [{ label, run: () => {
          const { cut } = copied;
          setClip(undefined);
          if (cut && cut.tripId === openTripId()) moveDaysAfter(cut.ids, id);
          else void pasteDaysAfter(id, copied.days, copied.tripId, cut);
        } }];
  }
  // The places of a category join the day or the category it is pasted onto; cut within its list, the category goes.
  if ('categories' in copied) return [{ label, run: shown(pasted(copied, (ids) => mergeDaysInto(ids, id), () => pasteStops(id, placesOf(copied.categories).stops))) }];
  if ('stops' in copied) return [{ label, run: shown(pasted(copied, (ids) => movePartsToDay('stop', ids, id), () => pasteStops(id, copied.stops))) }];
  if ('media' in copied) {
    const { media } = copied;
    return [{ label, run: shown(() => {
          setClip(undefined);
          void mediaAction(id, () => bringMedia(media, id, media.move));
        }) }];
  }
  if ('recordings' in copied) {
    const { recordings, cutFrom } = copied;
    const [only, ...more] = recordings;
    return [
      { label, run: shown(() => void pasteRecordings(id, recordings, cutFrom)) },
      ...(only && more.length === 0 && cutFrom === undefined ? [{ label: t('Paste as route'), run: shown(() => {
              setClip(undefined);
              void recordingAction(id, async () => pasteRoutes(id, recordingAsRoute(id, only.name, await fetchRideGpx(only.id))));
            }) }] : []),
    ];
  }
  return 'routes' in copied ? [{ label, run: shown(pasted(copied, (ids) => movePartsToDay('route', ids, id), () => pasteRoutes(id, copied.routes))) }] : [];
}

/** How a row of the library takes what is pasted onto it: routes, days with the trip they are of and whether they were cut from it, places with the category of each, files of the Stash with the folders copied beside them, or parts of such files. */
export interface PasteInto {
  routes?: (routes: CopiedRoute[]) => Promise<unknown>;
  days?: (days: Day[], from: { tripId: number; cut: boolean }) => Promise<unknown>;
  places?: (stops: Stop[], kinds: readonly string[]) => Promise<unknown>;
  files?: (files: StashFile[], folders: CopiedFolder[]) => Promise<unknown>;
  parts?: (parts: StashPart[]) => Promise<unknown>;
}

/**
 * The menu item that pastes what is on the clipboard into a place of the library, where
 * `model/paste.ts` says the place takes it: handed to `into`, which puts it there; of
 * parts of files of the Stash, what the place takes of them. Once that is done, what was
 * cut is taken from its trip. None where the place takes nothing of the clipboard, and
 * none for the trip `tripId` of what was cut from it; the item says what will be pasted.
 */
export function libraryPasteItem(place: Place, into: PasteInto, tripId?: number): MenuItem[] {
  const copied = clip();
  if (!copied || !taken(place, copied) || (copied.cut && copied.cut.tripId === tripId)) return [];
  const paste = async (): Promise<unknown> => {
    if ('routes' in copied) return into.routes?.(copied.routes);
    if ('days' in copied) return into.days?.(copied.days, { tripId: copied.tripId, cut: copied.cut !== undefined });
    if ('categories' in copied) return into.places?.(placesOf(copied.categories).stops, placesOf(copied.categories).kinds);
    if ('stops' in copied) return into.places?.(copied.stops, copied.kinds ?? []);
    if ('files' in copied) return into.files?.(copied.files, copied.folders);
    return 'parts' in copied ? into.parts?.(sharesOf(place, copied.parts)) : undefined;
  };
  const run = async () => {
    await paste();
    setClip(undefined);
    if (copied.cut) await removeFromSource(copied.cut);
  };
  return [{ label: pasteLabel(copied, place), run: () => void run() }];
}
