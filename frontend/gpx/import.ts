import { t } from '../i18n/t';
import { lineLength } from '../geo/measure';
import { asName, asNotes, asSymbol, asWebsite, newId, type LngLat, type Profile, type Route, type RoutedLeg, type Stop } from '../model/trip';
import { newStop, routePoints } from '../routing/dayEdit';
import { legKey, roundLngLat } from '../routing/legs';
import { encodePolyline } from '../routing/polyline';
import { parseGpx, type GpxContent } from './gpx';
import { parseKml } from './kml';
import { zipEntries } from './zip';

/** What a GPX file becomes in a day: routes, and stops for its waypoints. */
export interface DayParts {
  routes: Route[];
  stops: Stop[];
}


/** Rounded positions without consecutive repeats, which would make legs of no length. */
function cleanPoints(points: readonly LngLat[]): LngLat[] {
  const rounded = points.map(roundLngLat);
  return rounded.filter((p, i) => i === 0 || p[0] !== rounded[i - 1]![0] || p[1] !== rounded[i - 1]![1]);
}

/** A leg along the given way, measured along it; its riding time is left to the assumed pace until the routing is asked. */
function legAlong(way: readonly LngLat[]): RoutedLeg {
  return { geometry: encodePolyline(way), distanceM: lineLength(way), durationS: null };
}

/**
 * The legs of a GPX route the file carries the way Garmin calculated for, each with that
 * way as its geometry, keyed as the routing keys it. The other legs are left to the
 * routing. A point that repeats the one before joins its way to the leg it lies on.
 */
function calculatedLegs(points: readonly LngLat[], ways: readonly LngLat[][], profile: Profile): Record<string, RoutedLeg> {
  const legs: Record<string, RoutedLeg> = {};
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

/**
 * Routes and stops from a GPX file. A GPX route keeps all its points and its legs are
 * routed with `profile`, except those it carries the way Garmin calculated for. A track
 * keeps its line with every point; condensing it or making a route of it is the user's
 * choice. Unnamed routes are named after the file. A waypoint becomes a stop, bound to a
 * point of a GPX route it stands on, free otherwise, with its Garmin symbol as the file
 * names it and its address and phone numbers where Garmin gave them.
 * Names and notes are fitted to what a trip holds: composed, blank runs closed up, overlong text cut.
 */
export function gpxToDayParts(gpx: GpxContent, options: { fileName: string; profile: Profile; newId: () => string }): DayParts {
  const lines = [
    ...gpx.routes.map((r) => ({ name: r.name, kind: 'routed' as const, points: r.points, ways: r.ways })),
    ...gpx.tracks.map((t) => ({ name: t.name, kind: 'track' as const, points: t.segments.flat() })),
  ].filter((l) => l.points.length > 0);
  const routes = lines.map((line, i): Route => {
    const base = { id: options.newId(), name: asName(line.name ?? (lines.length === 1 ? options.fileName : `${options.fileName} ${i + 1}`)), profile: options.profile, optional: false, color: null };
    if (line.kind === 'track') return { ...base, kind: 'track', line: encodePolyline(cleanPoints(line.points)) };
    const points = cleanPoints(line.points).map((lngLat) => ({ id: options.newId(), lngLat }));
    return { ...base, kind: 'routed', highways: 'allow', points, legs: calculatedLegs(line.points, line.ways, options.profile) };
  });
  const pointAt = new Map(routes.flatMap((r) => routePoints(r).map((p) => [p.lngLat.join(','), p.id] as const)));
  return { routes, stops: waypointStops(gpx, options.newId, (lngLat) => pointAt.get(lngLat.join(',')) ?? null) };
}

/** The host a web address leads to; none for what is no web address. */
function hostOf(link: string): string | undefined {
  try {
    return new URL(link).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The page of its own each waypoint links to, or '' for none: its last link that does not
 * lead to where the file came from. A site most of the waypoints link to, while there are
 * links to others as well, is the file's source, such as the list a place was downloaded
 * from, and not a place's own page.
 */
export function ownWebsites(waypoints: readonly { links: readonly string[] }[]): string[] {
  const linking = new Map<string, number>();
  for (const w of waypoints) for (const host of new Set(w.links.flatMap((link) => hostOf(link) ?? []))) linking.set(host, (linking.get(host) ?? 0) + 1);
  const shared = new Set([...linking].filter(([, count]) => count > waypoints.length / 2).map(([host]) => host));
  const source = shared.size < linking.size ? shared : new Set<string>();
  return waypoints.map((w) => w.links.findLast((link) => hostOf(link) !== undefined && !source.has(hostOf(link)!)) ?? '');
}

/** The file's waypoints as stops, each bound to the point `pointAt` names for its position, with the page of its own it links to. */
export function waypointStops(gpx: GpxContent, newId: () => string, pointAt: (lngLat: LngLat) => string | null = () => null): Stop[] {
  const websites = ownWebsites(gpx.waypoints);
  return gpx.waypoints.map((w, i) => {
    const lngLat = roundLngLat(w.lngLat);
    const stop = newStop(newId(), asName(w.name ?? t('Waypoint {n}', { n: i + 1 })), lngLat, pointAt(lngLat));
    return { ...stop, symbol: asSymbol(w.symbol), address: asNotes(w.address ?? ''), contact: asNotes(w.phone ?? ''), website: asWebsite(websites[i]!), notes: asNotes(w.description ?? '') };
  });
}

/** How the files routes are read from end: GPX, KML, and KMZ, which is a KML in a zip. */
export const ROUTE_FILE = /\.(gpx|kml|kmz)$/i;

/** What a file picker is told to offer for them. */
export const ROUTE_FILE_TYPES = '.gpx,.kml,.kmz,application/gpx+xml,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz';

/** What a file picker is told to offer for recordings, which are GPX files kept as they are. */
export const GPX_FILE_TYPES = '.gpx,application/gpx+xml';

/**
 * A file of routes read as what a GPX file holds. A KMZ is known by its name. Any other
 * is read as what its name says it is and, where it is not that, as the other of GPX and
 * KML: files of one are passed on under the name of the other. Throws for a file that is
 * neither, saying that it is not what its name says.
 */
export async function readRouteFile(file: File): Promise<GpxContent> {
  if (/\.kmz$/i.test(file.name)) {
    // The KML of a KMZ lies at its top; what else it packs, icons and pictures, is left.
    const kmls = (await zipEntries(file)).filter((entry) => /\.kml$/i.test(entry.path)).sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    if (!kmls[0]) throw new Error(t('This KMZ file holds no KML.'));
    return parseKml(await (await kmls[0].read()).text());
  }
  const text = await file.text();
  const [named, other] = /\.kml$/i.test(file.name) ? [parseKml, parseGpx] : [parseGpx, parseKml];
  try {
    return named(text);
  } catch (notAsNamed) {
    try {
      return other(text);
    } catch {
      throw notAsNamed;
    }
  }
}

/** A file of routes read into routes and stops, the routes named after the file where they have no name. */
export async function readDayParts(file: File, profile: Profile): Promise<DayParts> {
  return gpxToDayParts(await readRouteFile(file), { fileName: file.name.replace(ROUTE_FILE, ''), profile, newId });
}
