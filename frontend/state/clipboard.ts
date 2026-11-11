import { t } from '../i18n/t';
import { createSignal } from 'solid-js';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts } from '../gpx/import';
import { newId, type Day, type Route, type Stop } from '../model/trip';
import { trackGpx } from '../recording/track';
import { copiedRoute, defaultProfile, type CopiedRoute } from '../routing/dayEdit';
import { decodeCached } from '../routing/polyline';
import type { MenuItem } from '../ui/menu';
import { addRecording, recordingAction } from './recordings';
import { openTrip, pasteRoutes, pasteStop, pasteStopIntoRoute, selectDay } from './trip';

/**
 * What was copied to be pasted: routes with the stops bound to them, a stop, or a
 * recording's GPX file. Kept while the app runs, from one trip to another.
 */
type Clip = { routes: CopiedRoute[] } | { stop: Stop } | { recording: { name: string; gpx: string } };

const [clip, setClip] = createSignal<Clip>();

/** Copies routes with the stops bound to them. */
export function copyRoutes(routes: CopiedRoute[]): void {
  setClip({ routes });
}

/** Copies a route of the day, with the stops bound to it. */
export function copyRoute(day: Day, route: Route): void {
  copyRoutes([copiedRoute(day, route)]);
}

export function copyStop(stop: Stop): void {
  setClip({ stop });
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
  if ('stop' in copied) return copied.stop.name ? t('Paste stop “{name}”', { name: copied.stop.name }) : t('Paste stop');
  if ('recording' in copied) return t('Paste recording “{name}”', { name: copied.recording.name });
  if (copied.routes.length > 1) return t('Paste {n} routes', { n: copied.routes.length });
  const name = copied.routes[0]!.route.name;
  return name ? t('Paste route “{name}”', { name }) : t('Paste route');
}

/**
 * The menu items that paste what was copied into the day of the open trip and show the
 * day; none while nothing is copied. A recording also pastes as a route, and a single
 * track also as a recording.
 */
export function pasteItem(dayId: string): MenuItem[] {
  const copied = clip();
  if (!copied) return [];
  const shown = (paste: () => void) => () => {
    paste();
    selectDay(dayId);
  };
  if ('stop' in copied) return [{ label: pasteLabel(copied), run: shown(() => pasteStop(dayId, copied.stop)) }];
  if ('recording' in copied) {
    const { name, gpx } = copied.recording;
    return [
      { label: pasteLabel(copied), run: shown(() => pasteAsRecording(dayId, name, gpx)) },
      { label: t('Paste “{name}” as a route', { name }), run: shown(() => pasteRoutes(dayId, recordingAsRoute(dayId, name, gpx))) },
    ];
  }
  const [only, ...more] = copied.routes;
  const track = more.length === 0 && only?.route.kind === 'track' ? only.route : undefined;
  return [
    { label: pasteLabel(copied), run: shown(() => pasteRoutes(dayId, copied.routes)) },
    ...(track ? [{ label: t('Paste “{name}” as a recording', { name: track.name || t('track') }), run: shown(() => pasteAsRecording(dayId, track.name || t('Track'), trackGpx(track.name, decodeCached(track.line)))) }] : []),
  ];
}

/** The menu item that pastes the copied stop into the route of the open trip, as a point of it; none while no stop is copied. */
export function stopPasteItem(routeId: string): MenuItem[] {
  const copied = clip();
  return copied && 'stop' in copied ? [{ label: pasteLabel(copied), run: () => pasteStopIntoRoute(routeId, copied.stop) }] : [];
}

/** The menu item that hands the copied routes to `paste`, which puts them into a trip or a folder of the library; none while no route is copied. */
export function routesPasteItem(paste: (routes: CopiedRoute[]) => void): MenuItem[] {
  const copied = clip();
  return copied && 'routes' in copied ? [{ label: pasteLabel(copied), run: () => paste(copied.routes) }] : [];
}
