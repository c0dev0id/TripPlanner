import { t } from '../i18n/t';
import { lineLength } from '../geo/measure';
import { asName, asNotes, asSymbol, asWebsite, newId, type LngLat, type Profile, type Route, type RoutedLeg, type RoutePoint, type Stop } from '../model/trip';
import { asStopsOf, newStop, routePoints } from '../routing/dayEdit';
import type { StashPart } from '../model/stash';
import { legKey, roundLngLat } from '../routing/legs';
import { encodePolyline } from '../routing/polyline';
import { parseGpx, type GpxContent, type GpxVia } from './gpx';
import { parseKml } from './kml';
import { zipEntries } from './zip';

/** What a GPX file becomes in a day: routes, each with its own stops for the file's waypoints; of a file of waypoints alone, stops of no route. */
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
 * choice. Unnamed routes are named after the file. A GPX file's waypoints are of none of
 * its routes and tracks, so each route and track gets every waypoint as a stop of its
 * own: on a point of the route it stands on, beside the route or track otherwise, with
 * its Garmin symbol as the file names it and its address and phone numbers where Garmin
 * gave them. A point Garmin's trip planning marks a via point becomes a stop on that
 * point as well, unless a waypoint stands there already. A file without a route or a
 * track gives its waypoints as stops of no route. With `waypoints` false, the waypoints
 * that stand on no route point are left out.
 * Names and notes are fitted to what a trip holds: composed, blank runs closed up, overlong text cut.
 */
export function gpxToDayParts(gpx: GpxContent, options: { fileName: string; profile: Profile; newId: () => string; waypoints?: boolean }): DayParts {
  const keep = (stop: Stop) => options.waypoints !== false || stop.pointId !== null;
  const lines = [
    ...gpx.routes.map((r) => ({ name: r.name, kind: 'routed' as const, points: r.points, ways: r.ways, vias: r.vias })),
    ...gpx.tracks.map((t) => ({ name: t.name, kind: 'track' as const, points: t.segments.flat() })),
  ].filter((l) => l.points.length > 0);
  const routes = lines.map((line, i): Route => {
    const base = { id: options.newId(), name: asName(line.name ?? (lines.length === 1 ? options.fileName : `${options.fileName} ${i + 1}`)), profile: options.profile, optional: false, color: null };
    if (line.kind === 'track') return { ...base, kind: 'track', line: encodePolyline(cleanPoints(line.points)) };
    const points = cleanPoints(line.points).map((lngLat) => ({ id: options.newId(), lngLat }));
    return { ...base, kind: 'routed', highways: 'allow', points, legs: calculatedLegs(line.points, line.ways, options.profile) };
  });
  const waypoints = waypointStops(gpx, options.newId);
  if (routes.length === 0) return { routes, stops: waypoints.filter(keep) };
  const stops = routes.flatMap((route, i) => {
    const own = asStopsOf(route, waypoints, options.newId).filter(keep);
    const line = lines[i]!;
    return line.kind === 'routed' ? [...own, ...viaStops(route.id, routePoints(route), line.points, line.vias, own, options.newId)] : own;
  });
  return { routes, stops };
}

/**
 * The via points of a route as stops, each on its point: `listed` are the route's points
 * as the file lists them and `vias` what makes each a via point, `points` the points
 * kept of them, which are without those that repeat the one before (see cleanPoints).
 * None for a point that holds one of `taken`, or a via point before it, already.
 */
function viaStops(routeId: string, points: readonly RoutePoint[], listed: readonly LngLat[], vias: readonly (GpxVia | undefined)[], taken: readonly Stop[], newId: () => string): Stop[] {
  const held = new Set(taken.map((stop) => stop.pointId));
  const rounded = listed.map(roundLngLat);
  const stops: Stop[] = [];
  let kept = -1;
  for (const [i, lngLat] of rounded.entries()) {
    const before = rounded[i - 1];
    if (!before || before[0] !== lngLat[0] || before[1] !== lngLat[1]) kept++;
    const [via, point] = [vias[i], points[kept]];
    if (!via || !point || held.has(point.id)) continue;
    held.add(point.id);
    stops.push({ ...newStop(newId(), asName(via.name ?? t('Waypoint {n}', { n: stops.length + 1 })), point.lngLat, routeId, point.id), symbol: asSymbol(via.symbol) });
  }
  return stops;
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

/** The file's waypoints as stops of no route, each with the page of its own it links to. */
export function waypointStops(gpx: GpxContent, newId: () => string): Stop[] {
  const websites = ownWebsites(gpx.waypoints);
  return gpx.waypoints.map((w, i) => {
    const lngLat = roundLngLat(w.lngLat);
    const stop = newStop(newId(), asName(w.name ?? t('Waypoint {n}', { n: i + 1 })), lngLat, null, null);
    return { ...stop, symbol: asSymbol(w.symbol), address: asNotes(w.address ?? ''), contact: asNotes(w.phone ?? ''), website: asWebsite(websites[i]!), notes: asNotes(w.description ?? '') };
  });
}

/** What is taken of a file of the Stash, read as an import reads the file: the routes and tracks taken, and its waypoints where they are taken, else those on route points alone. */
export function stashPartToDayParts(gpx: GpxContent, part: Pick<StashPart, 'file' | 'items' | 'waypoints'>, profile: Profile, newId: () => string): DayParts {
  const taken = (kind: 'route' | 'track') => (_: unknown, position: number) => part.items.some((item) => item.kind === kind && item.position === position);
  return gpxToDayParts({ ...gpx, routes: gpx.routes.filter(taken('route')), tracks: gpx.tracks.filter(taken('track')) }, { fileName: part.file.name, profile, newId, waypoints: part.waypoints });
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
    if (!kmls[0]) throw new Error(t('This KMZ file contains no KML.'));
    return parseKml(await (await kmls[0].read()).text());
  }
  const text = await file.text();
  const [named, other] = /\.kml$/i.test(file.name) ? [parseKml, parseGpx] : [parseGpx, parseKml];
  try {
    return await named(text);
  } catch (notAsNamed) {
    try {
      return await other(text);
    } catch {
      throw notAsNamed;
    }
  }
}

/** A file of routes read into routes and stops, the routes named after the file where they have no name. */
export async function readDayParts(file: File, profile: Profile): Promise<DayParts> {
  return gpxToDayParts(await readRouteFile(file), { fileName: file.name.replace(ROUTE_FILE, ''), profile, newId });
}
