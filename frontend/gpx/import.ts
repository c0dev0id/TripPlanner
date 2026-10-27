import { distanceBetween } from '../geo/measure';
import { simplifyToCount } from '../geo/simplify';
import { STOP_KINDS, type LngLat, type Profile, type Route, type Stop, type StopKind } from '../model/trip';
import { newStop } from '../routing/dayEdit';
import { ASSUMED_SPEED_MPS, legKey, roundLngLat, withoutRepeats } from '../routing/legs';
import { encodePolyline } from '../routing/polyline';
import type { GpxContent } from './gpx';

/** What a GPX file becomes in a day: routes, and stops for its waypoints. */
export interface DayParts {
  routes: Route[];
  stops: Stop[];
}

/** A track is simplified to at most this many points, each a marker while the route is edited. */
export const MAX_TRACK_POINTS = 500;

/** Rounded positions without consecutive repeats, which would make legs of no length. */
const cleanPoints = (points: readonly LngLat[]) => withoutRepeats(points.map(roundLngLat));

/** A leg along the given way, measured along it and timed at the assumed pace; the routing would route it over again only on request. */
function legAlong(way: readonly LngLat[]): Route['legs'][string] {
  let distanceM = 0;
  for (let i = 1; i < way.length; i++) distanceM += distanceBetween(way[i - 1]!, way[i]!);
  return { geometry: encodePolyline(way), distanceM, durationS: distanceM / ASSUMED_SPEED_MPS };
}

/**
 * The legs of a GPX route the file carries the way Garmin calculated for, each with that
 * way as its geometry, keyed as the routing keys it. The other legs are left to the
 * routing. A point that repeats the one before joins its way to the leg it lies on.
 */
function calculatedLegs(points: readonly LngLat[], ways: readonly LngLat[][], profile: Profile): Route['legs'] {
  const legs: Route['legs'] = {};
  let way: LngLat[] = [];
  points.map(roundLngLat).forEach((to, i, rounded) => {
    const from = rounded[i - 1];
    if (from && (from[0] !== to[0] || from[1] !== to[1])) {
      if (way.length > 0) legs[legKey(profile, from, to)] = legAlong(cleanPoints([from, ...way, to]));
      way = [];
    }
    way = way.concat(ways[i]!);
  });
  return legs;
}

/**
 * Routes and stops from a GPX file. A GPX route keeps all its points and its legs are
 * routed with `profile`, except those it carries the way Garmin calculated for. A track
 * becomes a route of kind `track`: its points simplified to at most MAX_TRACK_POINTS,
 * joined by straight legs, so that it keeps its shape. Unnamed routes are named after the
 * file. A waypoint becomes a stop, bound to a route point it stands on, free otherwise,
 * with its `type` as the kind where that is one of ours.
 */
export function gpxToDayParts(gpx: GpxContent, options: { fileName: string; profile: Profile; newId: () => string }): DayParts {
  const lines = [
    ...gpx.routes.map((r) => ({ name: r.name, kind: 'routed' as const, points: r.points, legs: calculatedLegs(r.points, r.ways, options.profile), straight: false })),
    ...gpx.tracks.map((t) => ({ name: t.name, kind: 'track' as const, points: simplifyToCount(cleanPoints(t.segments.flat()), MAX_TRACK_POINTS), legs: {}, straight: true })),
  ].filter((l) => l.points.length > 0);
  const routes: Route[] = lines.map((line, i) => ({
    id: options.newId(),
    name: line.name ?? (lines.length === 1 ? options.fileName : `${options.fileName} ${i + 1}`),
    kind: line.kind,
    profile: options.profile,
    optional: false,
    points: cleanPoints(line.points).map((lngLat, j) => ({ id: options.newId(), lngLat, ...(line.straight && j > 0 && { straight: true }) })),
    legs: line.legs,
  }));
  const pointAt = new Map(routes.flatMap((r) => r.points.map((p) => [p.lngLat.join(','), p.id] as const)));
  const kinds = new Set<string>(STOP_KINDS.map((k) => k.value));
  const stops = gpx.waypoints.map((w, i) => {
    const lngLat = roundLngLat(w.lngLat);
    const stop = newStop(options.newId(), w.name ?? `Waypoint ${i + 1}`, lngLat, pointAt.get(lngLat.join(',')) ?? null);
    return { ...stop, kind: w.type && kinds.has(w.type) ? (w.type as StopKind) : 'other', notes: w.description ?? '' };
  });
  return { routes, stops };
}
