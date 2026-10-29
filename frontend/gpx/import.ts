import { distanceBetween } from '../geo/measure';
import { MAX_NAME, MAX_TEXT, newId, STOP_KINDS, type LngLat, type Profile, type Route, type Stop, type StopKind } from '../model/trip';
import { newStop } from '../routing/dayEdit';
import { legKey, roundLngLat } from '../routing/legs';
import { encodePolyline } from '../routing/polyline';
import { parseGpx, type GpxContent } from './gpx';

/** What a GPX file becomes in a day: routes, and stops for its waypoints. */
export interface DayParts {
  routes: Route[];
  stops: Stop[];
}


/** At most `max` characters of the text. */
function clipped(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length > max ? characters.slice(0, max).join('') : text;
}

/** Text from a file as a name: composed (NFC), one line, at most MAX_NAME characters. */
const asName = (text: string): string => clipped(text.normalize('NFC').replace(/\s+/g, ' ').trim(), MAX_NAME);

/** Text from a file as notes: composed (NFC), no blanks at the ends of lines, no more than one empty line in a row, at most MAX_TEXT characters. */
const asNotes = (text: string): string => clipped(text.normalize('NFC').replace(/[^\S\n]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim(), MAX_TEXT);

/** Rounded positions without consecutive repeats, which would make legs of no length. */
function cleanPoints(points: readonly LngLat[]): LngLat[] {
  const rounded = points.map(roundLngLat);
  return rounded.filter((p, i) => i === 0 || p[0] !== rounded[i - 1]![0] || p[1] !== rounded[i - 1]![1]);
}

/** A leg along the given way, measured along it; its riding time is left to the assumed pace until the routing is asked. */
function legAlong(way: readonly LngLat[]): Route['legs'][string] {
  let distanceM = 0;
  for (let i = 1; i < way.length; i++) distanceM += distanceBetween(way[i - 1]!, way[i]!);
  return { geometry: encodePolyline(way), distanceM, durationS: null };
}

/**
 * The legs of a GPX route the file carries the way Garmin calculated for, each with that
 * way as its geometry, keyed as the routing keys it. The other legs are left to the
 * routing. A point that repeats the one before joins its way to the leg it lies on.
 */
function calculatedLegs(points: readonly LngLat[], ways: readonly LngLat[][], profile: Profile): Route['legs'] {
  const legs: Route['legs'] = {};
  const rounded = points.map(roundLngLat);
  let way: LngLat[] = [];
  for (let i = 0; i < rounded.length; i++) {
    const from = rounded[i - 1];
    const to = rounded[i]!;
    if (from && (from[0] !== to[0] || from[1] !== to[1])) {
      if (way.length > 0) legs[legKey({ profile, highways: 'allow' }, from, to)] = legAlong(cleanPoints([from, ...way, to]));
      way = [];
    }
    way = way.concat(ways[i]!);
  }
  return legs;
}

/** The Garmin symbols that name one of our kinds exactly. */
const GARMIN_SYMBOLS = new Map<string, StopKind>([
  ['Information', 'info'],
  ['Restaurant', 'restaurant'],
  ['Gas Station', 'fuel'],
]);

/** A waypoint's kind: its type where that is one of ours, else its Garmin symbol where that names one exactly, else a plain stop. */
function kindOf(waypoint: GpxContent['waypoints'][number]): StopKind {
  if (STOP_KINDS.some((k) => k.value === waypoint.type)) return waypoint.type as StopKind;
  return GARMIN_SYMBOLS.get(waypoint.symbol ?? '') ?? 'other';
}

/**
 * Routes and stops from a GPX file. A GPX route keeps all its points and its legs are
 * routed with `profile`, except those it carries the way Garmin calculated for. A track
 * becomes a route of kind `track`: every one of its points, joined by straight legs, so
 * that it keeps its shape; condensing it or making a route of it is the user's choice. Unnamed routes are named after the
 * file. A waypoint becomes a stop, bound to a route point it stands on, free otherwise,
 * of the kind kindOf reads from it, with its address and phone numbers where Garmin gave them.
 * Names and notes are fitted to what a trip holds: composed, blank runs closed up, overlong text cut.
 */
export function gpxToDayParts(gpx: GpxContent, options: { fileName: string; profile: Profile; newId: () => string }): DayParts {
  const lines = [
    ...gpx.routes.map((r) => ({ name: r.name, kind: 'routed' as const, points: r.points, legs: calculatedLegs(r.points, r.ways, options.profile) })),
    ...gpx.tracks.map((t) => ({ name: t.name, kind: 'track' as const, points: t.segments.flat(), legs: {} })),
  ].filter((l) => l.points.length > 0);
  const routes: Route[] = lines.map((line, i) => ({
    id: options.newId(),
    name: asName(line.name ?? (lines.length === 1 ? options.fileName : `${options.fileName} ${i + 1}`)),
    kind: line.kind,
    profile: options.profile,
    highways: 'allow',
    optional: false,
    points: cleanPoints(line.points).map((lngLat, j) => (line.kind === 'track' && j > 0 ? { id: options.newId(), lngLat, straight: true } : { id: options.newId(), lngLat })),
    legs: line.legs,
  }));
  const pointAt = new Map(routes.flatMap((r) => r.points.map((p) => [p.lngLat.join(','), p.id] as const)));
  const stops = gpx.waypoints.map((w, i) => {
    const lngLat = roundLngLat(w.lngLat);
    const stop = newStop(options.newId(), asName(w.name ?? `Waypoint ${i + 1}`), lngLat, pointAt.get(lngLat.join(',')) ?? null);
    return { ...stop, kind: kindOf(w), address: asNotes(w.address ?? ''), contact: asNotes(w.phone ?? ''), notes: asNotes(w.description ?? '') };
  });
  return { routes, stops };
}

/** A GPX file read into routes and stops, the routes named after the file where they have no name. */
export async function readGpxFile(file: File, profile: Profile): Promise<DayParts> {
  return gpxToDayParts(parseGpx(await file.text()), { fileName: file.name.replace(/\.gpx$/i, ''), profile, newId });
}
