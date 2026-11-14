import { t } from '../i18n/t';
import { createSignal } from 'solid-js';
import { changeTrip, errorMessage, fetchRideGpx, type KeptRide, type Recording } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts } from '../gpx/import';
import { newId, type Day, type Stop } from '../model/trip';
import { copiedRoute, defaultProfile, removeParts, type CopiedRoute, type PartKind } from '../routing/dayEdit';
import { askConfirmation } from '../ui/confirm';
import type { MenuItem } from '../ui/menu';
import { flushSave } from './autosave';
import { bringMedia, mediaAction } from './media';
import { addedText, putOnDay, recordingAction, takeOffDay } from './recordings';
import { moveDaysAfter, movePartsToDay, moveStopsIntoRoute, openTrip, openTripId, pasteDays, pasteRoutes, pasteStops, pasteStopsIntoRoute, selectDay } from './trip';

/**
 * What was copied or cut to be pasted: days with all they hold, routes with the stops
 * bound to them, stops, rides, the files and links kept with
 * days, or trips and folders of the library. Kept from one trip to another until it is pasted, which empties the
 * clipboard, or until something else is copied or cut. What was cut is taken from where
 * it was once it is pasted.
 */
type Clip = ({ days: Day[] } | { routes: CopiedRoute[] } | { stops: Stop[] } | { recordings: KeptRide[]; cutFrom?: string } | { media: CopiedMedia } | { library: LibraryClip }) & {
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

/** Empties the clipboard: what is on it is pasted once. */
export const clearClip = (): void => void setClip(undefined);

/** Copies routes with the stops bound to them. */
export function copyRoutes(routes: CopiedRoute[]): void {
  setClip({ routes });
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

/** What a paste menu item says it pastes: Paste route “Loop”, Paste 3 routes, Paste stop “Café”. */
function pasteLabel(copied: Clip): string {
  const of = (named: string, unnamed: string, several: string, names: string[]) =>
    names.length > 1 ? t(several, { n: names.length }) : names[0] ? t(named, { name: names[0] }) : t(unnamed);
  if ('library' in copied) return t('Paste');
  if ('recordings' in copied) return of('Paste recording “{name}”', 'Paste recording', 'Paste {n} recordings', copied.recordings.map((r) => r.name));
  if ('media' in copied) return of('Paste “{name}”', 'Paste file', 'Paste {n} files and links', copied.media.names);
  if ('days' in copied) return of('Paste day “{name}”', 'Paste day', 'Paste {n} days', copied.days.map((d) => d.name));
  if ('stops' in copied) return of('Paste stop “{name}”', 'Paste stop', 'Paste {n} stops', copied.stops.map((s) => s.name));
  return of('Paste route “{name}”', 'Paste route', 'Paste {n} routes', copied.routes.map((c) => c.route.name));
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
    await askConfirmation(t('The parts are pasted here, but could not be taken from the trip they were cut from: {error}', { error: errorMessage(error) }), t('OK'));
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
      ...(only && more.length === 0 && cutFrom === undefined ? [{ label: t('Paste “{name}” as a route', { name: only.name }), run: shown(() => {
              setClip(undefined);
              void recordingAction(id, async () => pasteRoutes(id, recordingAsRoute(id, only.name, await fetchRideGpx(only.id))));
            }) }] : []),
    ];
  }
  return [{ label, run: shown(pasted(copied, (ids) => movePartsToDay('route', ids, id), () => pasteRoutes(id, copied.routes))) }];
}

/**
 * The menu item that hands the copied routes to `routes`, or the copied days to `days`,
 * which put them into a trip or a folder of the library; once that is done, what was cut
 * is taken from its trip. None where the clipboard holds neither, or what it holds has
 * nowhere to go.
 */
export function libraryPasteItem(into: { routes?: (routes: CopiedRoute[]) => Promise<unknown>; days?: (days: Day[]) => Promise<unknown> }): MenuItem[] {
  const copied = clip();
  if (!copied) return [];
  const paste = 'routes' in copied && into.routes ? () => into.routes!(copied.routes) : 'days' in copied && into.days ? () => into.days!(copied.days) : undefined;
  if (!paste) return [];
  const run = async () => {
    await paste();
    setClip(undefined);
    if (copied.cut) await removeFromSource(copied.cut);
  };
  return [{ label: pasteLabel(copied), run: () => void run() }];
}
