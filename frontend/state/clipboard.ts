import { t } from '../i18n/t';
import { createSignal } from 'solid-js';
import { changeTrip, errorMessage } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts } from '../gpx/import';
import { newId, type Day, type Stop } from '../model/trip';
import { trackGpx } from '../recording/track';
import { copiedRoute, defaultProfile, removeParts, type CopiedRoute, type PartKind } from '../routing/dayEdit';
import { decodeCached } from '../routing/polyline';
import { askConfirmation } from '../ui/confirm';
import type { MenuItem } from '../ui/menu';
import { flushSave } from './autosave';
import { addRecording, recordingAction } from './recordings';
import { moveDaysAfter, movePartsToDay, moveStopsIntoRoute, openTrip, openTripId, pasteDays, pasteRoutes, pasteStops, pasteStopsIntoRoute, selectDay } from './trip';

/**
 * What was copied or cut to be pasted: days with all they hold, routes with the stops
 * bound to them, stops, or a recording's GPX file. Kept while the app runs, from one trip
 * to another. What was cut is taken from where it was once it is pasted.
 */
type Clip = ({ days: Day[] } | { routes: CopiedRoute[] } | { stops: Stop[] } | { recording: { name: string; gpx: string } }) & {
  /** Where the parts were cut from. */
  cut?: { tripId: number; kind: PartKind; ids: string[] };
};

const [clip, setClip] = createSignal<Clip>();

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

export function copyRecording(name: string, gpx: string): void {
  setClip({ recording: { name, gpx } });
}

/** Pastes a GPX file of one track into the day as a recording, saying so under the day's recordings. */
const pasteAsRecording = (dayId: string, name: string, gpx: string) =>
  void recordingAction(dayId, async () => {
    await addRecording(dayId, gpx, { name });
    return t('“{name}” added as a recording.', { name });
  });

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
  if ('recording' in copied) return t('Paste recording “{name}”', { name: copied.recording.name });
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
 * `paste`, and what was cut from another trip is taken from it. What was cut is pasted once.
 */
function pasted(copied: Clip, move: (ids: string[]) => void, paste: () => void): () => void {
  return () => {
    const cut = copied.cut;
    if (cut && cut.tripId === openTripId()) move(cut.ids);
    else paste();
    if (!cut) return;
    setClip(undefined);
    if (cut.tripId !== openTripId()) void removeFromSource(cut);
  };
}

/**
 * The menu items that paste what is on the clipboard into a part of the open trip: into a
 * day, routes, stops and a recording, and days after it; into a route, stops, as points
 * of it. None where the clipboard holds nothing for the part. A recording also pastes as
 * a route, and a single track also as a recording.
 */
export function pasteItems(kind: PartKind, id: string): MenuItem[] {
  const copied = clip();
  if (!copied || kind === 'stop') return [];
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
  if ('recording' in copied) {
    const { name, gpx } = copied.recording;
    return [
      { label, run: shown(() => pasteAsRecording(id, name, gpx)) },
      { label: t('Paste “{name}” as a route', { name }), run: shown(() => pasteRoutes(id, recordingAsRoute(id, name, gpx))) },
    ];
  }
  const [only, ...more] = copied.routes;
  const track = more.length === 0 && only?.route.kind === 'track' ? only.route : undefined;
  return [
    { label, run: shown(pasted(copied, (ids) => movePartsToDay('route', ids, id), () => pasteRoutes(id, copied.routes))) },
    ...(track ? [{ label: t('Paste “{name}” as a recording', { name: track.name || t('track') }), run: shown(() => pasteAsRecording(id, track.name || t('Track'), trackGpx(track.name, decodeCached(track.line)))) }] : []),
  ];
}

/**
 * The menu item that hands the copied routes to `paste`, which puts them into a trip or a
 * folder of the library; once that is done, routes that were cut are taken from their
 * trip. None while no route is copied.
 */
export function routesPasteItem(paste: (routes: CopiedRoute[]) => Promise<unknown>): MenuItem[] {
  const copied = clip();
  if (!copied || !('routes' in copied)) return [];
  const run = async () => {
    await paste(copied.routes);
    if (!copied.cut) return;
    setClip(undefined);
    await removeFromSource(copied.cut);
  };
  return [{ label: pasteLabel(copied), run: () => void run() }];
}
