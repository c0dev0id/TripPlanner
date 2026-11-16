import { t } from '../i18n/t';
import { createSignal } from 'solid-js';
import { changeTrip, errorMessage, fetchRideGpx, fetchStashGpx, fetchStashMedia, type KeptRide, type Recording } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts } from '../gpx/import';
import type { StashFile, StashItem, StashPart } from '../model/stash';
import { newId, type Day, type Route, type Stop } from '../model/trip';
import { copiedRoute, defaultProfile, removeParts, stopsBoundTo, type CopiedRoute, type PartKind } from '../routing/dayEdit';
import { counted, listText } from '../ui/format';
import { askConfirmation } from '../ui/confirm';
import type { MenuItem } from '../ui/menu';
import { flushSave } from './autosave';
import { isPlaceList } from './library';
import { addFiles, bringMedia, mediaAction } from './media';
import { addedText, putOnDay, recordingAction, takeOffDay } from './recordings';
import { addParts, moveDaysAfter, movePartsToDay, moveStopsIntoRoute, openTrip, openTripId, pasteDays, pasteRoutes, pasteStops, pasteStopsIntoRoute, selectDay } from './trip';

/**
 * What was copied or cut to be pasted: days with all they hold, routes with the stops
 * bound to them, stops, rides, the files and links kept with
 * days, trips and folders of the library, files of the Stash, which are imported
 * where they are pasted, or routes, tracks and waypoints of such files. Kept from one trip to another until it is pasted, which empties the
 * clipboard, or until something else is copied or cut. What was cut is taken from where
 * it was once it is pasted.
 */
type Clip = ({ days: Day[] } | { routes: CopiedRoute[] } | { stops: Stop[]; kinds?: readonly string[] } | { recordings: KeptRide[]; cutFrom?: string } | { media: CopiedMedia } | { library: LibraryClip } | { files: StashFile[] } | { parts: StashPart[] }) & {
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

/** Copies files of the Stash, to be imported where they are pasted: as trips into a folder, as days into a trip, their routes and waypoints into a day, their waypoints into a list of places. */
export function copyStashFiles(files: StashFile[]): void {
  setClip({ files });
}

/** Copies routes, tracks and waypoints of files of the Stash, to be pasted into another file there, into a day, a trip or a list of places. */
export function copyStashParts(parts: StashPart[]): void {
  setClip({ parts });
}

/** The files of the Stash on the clipboard, if that is what it holds. */
export function stashFilesClip(): StashFile[] | undefined {
  const copied = clip();
  return copied && 'files' in copied ? copied.files : undefined;
}

/** Empties the clipboard: what is on it is pasted once. */
export const clearClip = (): void => void setClip(undefined);

/** Copies routes with the stops bound to them. */
export function copyRoutes(routes: CopiedRoute[]): void {
  setClip({ routes });
}

/** Copies stops that stand free, with the kind of place each is of. */
export function copyStops(stops: Stop[], kinds: readonly string[]): void {
  setClip({ stops, kinds });
}

/** Copies days, routes or stops of the open trip; cut, they leave it when they are pasted. */
export function copyParts(kind: PartKind, ids: readonly string[], cut = false): void {
  const trip = openTrip();
  if (!trip) return;
  const from = cut ? { cut: { tripId: trip.id, kind, ids: [...ids] } } : {};
  if (kind === 'day') setClip({ days: trip.days.filter((d) => ids.includes(d.id)), ...from });
  else if (kind === 'route') setClip({ routes: trip.days.flatMap((d) => d.routes.filter((r) => ids.includes(r.id)).map((r) => copiedRoute(d, r))), ...from });
  else setClip({ stops: trip.days.flatMap((d) => d.stops.filter((s) => ids.includes(s.id))), ...from });
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

/** What a paste menu item says it pastes, by kind and number and never by name, which may be long: Paste 1 route, Paste 3 stops. */
function pasteLabel(copied: Clip): string {
  const of = (n: number, noun: string) => t('Paste {what}', { what: counted(n, noun) });
  if ('library' in copied) return t('Paste');
  if ('files' in copied) return of(copied.files.length, 'file');
  if ('parts' in copied) {
    const items = copied.parts.reduce((sum, part) => sum + part.items.length, 0);
    const waypoints = copied.parts.reduce((sum, part) => sum + (part.waypoints ? part.file.waypoints : 0), 0);
    const media = copied.parts.reduce((sum, part) => sum + (part.media ? part.file.media.length : 0), 0);
    return t('Paste {what}', { what: listText([items > 0 && counted(items, 'route'), waypoints > 0 && counted(waypoints, 'waypoint'), media > 0 && counted(media, 'attachment')]) });
  }
  if ('recordings' in copied) return of(copied.recordings.length, 'recording');
  if ('media' in copied) return of(copied.media.names.length, 'attachment');
  if ('days' in copied) return of(copied.days.length, 'day');
  if ('stops' in copied) return of(copied.stops.length, 'stop');
  return of(copied.routes.length, 'route');
}

/** A file of the Stash as all of it: its routes, tracks, waypoints and media. */
const wholeFile = (file: StashFile): StashPart => ({ file, items: file.items, waypoints: true, media: true });

/**
 * Imports parts of files of the Stash into a day of the open trip, as a file picked for
 * the day is read: the routes and tracks taken, with the waypoints on their points, and
 * with a file's waypoints the others as free stops; into a kind of a list of places, the
 * waypoints alone. A file's media, where they are taken, are kept with the day.
 */
async function pastePartsIntoDay(dayId: string, parts: readonly StashPart[]): Promise<void> {
  const tripId = openTripId();
  const day = openTrip()?.days.find((d) => d.id === dayId);
  if (!day) return;
  try {
    const added = { routes: [] as Route[], stops: [] as Stop[] };
    const places = isPlaceList(tripId);
    for (const { file, items, waypoints } of parts) {
      const gpx = parseGpx(await fetchStashGpx(file.id));
      const taken = (kind: StashItem['kind']) => (_: unknown, position: number) => items.some((item) => item.kind === kind && item.position === position);
      const read = gpxToDayParts({ ...gpx, routes: gpx.routes.filter(taken('route')), tracks: gpx.tracks.filter(taken('track')) }, { fileName: file.name, profile: defaultProfile(day), newId });
      const stops = waypoints ? read.stops : read.routes.flatMap((route) => stopsBoundTo(route, read.stops));
      added.routes.push(...(places ? [] : read.routes));
      added.stops.push(...(places ? stops.map((stop) => ({ ...stop, pointId: null })) : stops));
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
 * Takes what was cut from the trip it was cut from, once it is pasted into the open one,
 * which is saved first: the parts are then in both trips for a moment, never in neither.
 */
async function removeFromSource(cut: NonNullable<Clip['cut']>): Promise<void> {
  try {
    await flushSave();
    await changeTrip(cut.tripId, (trip) => removeParts(trip, cut.kind, cut.ids));
  } catch (error) {
    await askConfirmation(t('The items were pasted here but could not be removed from the trip they were cut from: {error}', { error: errorMessage(error) }), t('OK'));
  }
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
 * The menu items that paste what is on the clipboard into a part of the open trip: into a
 * day, routes, stops, rides and a day's files and links, and days after it; into a route, stops, as points
 * of it. None where the clipboard holds nothing for the part. A recording also pastes as
 * a route.
 */
export function pasteItems(kind: PartKind, id: string): MenuItem[] {
  const copied = clip();
  if (!copied || kind === 'stop' || 'library' in copied) return [];
  const label = pasteLabel(copied);
  if (kind === 'route') {
    return 'stops' in copied ? [{ label, run: pasted(copied, (ids) => moveStopsIntoRoute(ids, id), () => pasteStopsIntoRoute(id, copied.stops)) }] : [];
  }
  const shown = (paste: () => void) => () => {
    paste();
    selectDay(id);
  };
  if ('files' in copied || 'parts' in copied) {
    const parts = 'files' in copied ? copied.files.map(wholeFile) : copied.parts;
    return [{ label, run: () => {
          setClip(undefined);
          void pastePartsIntoDay(id, parts);
        } }];
  }
  if ('days' in copied) return [{ label, run: pasted(copied, (ids) => moveDaysAfter(ids, id), () => pasteDays(copied.days, id)) }];
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
  return [{ label, run: shown(pasted(copied, (ids) => movePartsToDay('route', ids, id), () => pasteRoutes(id, copied.routes))) }];
}

/** A place that takes parts of files of the Stash: what it takes of them, their routes and tracks, their waypoints or their media, and how they are pasted there. */
export interface PartsTaker {
  takes: readonly ('items' | 'waypoints' | 'media')[];
  paste: (parts: StashPart[]) => Promise<unknown>;
}

/** The parts as a place takes them: of each what the place takes of it, and none of a part it takes nothing of. */
const takenBy = ({ takes }: PartsTaker, parts: readonly StashPart[]): StashPart[] =>
  parts
    .map((part) => ({ file: part.file, items: takes.includes('items') ? part.items : [], waypoints: takes.includes('waypoints') && part.waypoints, media: takes.includes('media') && part.media }))
    .filter((part) => part.items.length > 0 || part.waypoints || part.media);

/**
 * The menu item that hands the copied routes to `routes`, the copied days to `days`,
 * the copied stops, with the kind of each, to `stops`, the copied files of the Stash
 * to `files`, or of the copied parts of such files what `parts` takes to it, which put
 * them into a trip, a folder of the library or a file of the Stash; once that is done,
 * what was cut is taken from its trip. None where the clipboard holds none of them, or
 * what it holds has nowhere to go; the item says what will be pasted there.
 */
export function libraryPasteItem(into: {
  routes?: (routes: CopiedRoute[]) => Promise<unknown>;
  days?: (days: Day[]) => Promise<unknown>;
  stops?: (stops: Stop[], kinds: readonly string[]) => Promise<unknown>;
  files?: (files: StashFile[]) => Promise<unknown>;
  parts?: PartsTaker;
}): MenuItem[] {
  const copied = clip();
  if (!copied) return [];
  const parts = 'parts' in copied && into.parts ? takenBy(into.parts, copied.parts) : [];
  const paste =
    'routes' in copied && into.routes
      ? () => into.routes!(copied.routes)
      : 'days' in copied && into.days
        ? () => into.days!(copied.days)
        : 'stops' in copied && into.stops
          ? () => into.stops!(copied.stops, copied.kinds ?? [])
          : 'files' in copied && into.files
            ? () => into.files!(copied.files)
            : parts.length > 0
              ? () => into.parts!.paste(parts)
              : undefined;
  if (!paste) return [];
  const run = async () => {
    await paste();
    setClip(undefined);
    if (copied.cut) await removeFromSource(copied.cut);
  };
  return [{ label: pasteLabel('parts' in copied ? { ...copied, parts } : copied), run: () => void run() }];
}
