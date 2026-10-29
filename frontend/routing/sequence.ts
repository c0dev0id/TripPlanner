import { distanceBetween, metresAlong, planeAt } from '../geo/measure';
import { nearestOnLines, type NearestPlace, type XY } from '../geo/nearest';
import type { Day, LngLat, RoutePoint, Stop, Trip } from '../model/trip';
import { legCoordinates, legDistance, legDuration, routeLegs, routePositions } from './legs';
import { decodeCached } from './polyline';

/**
 * A day's stops and route points in riding order, each with its distance from the day's
 * start along the routes. A free stop takes the place where a route passes closest; a
 * track, which has no points of its own, has an entry where it ends.
 */

/** How far from the routes a free stop may stand and still take a place along them; farther away, it stands for itself. */
const FREE_STOP_REACH_M = 500;

export interface SequenceEntry {
  /** The stop's id, the plain route point's, or for the end of a track the track's. */
  id: string;
  /** Which route of the day, in order, and the distance and riding time from the day's start. */
  routeIndex: number;
  distanceM: number;
  timeS: number;
  lngLat: LngLat;
  stop?: Stop;
  point?: RoutePoint;
  /** For a free stop: the leg (from point `legIndex` of the route) and the spot on it nearest to the stop, and how far away that is. */
  near?: { routeId: string; legIndex: number; lngLat: LngLat; distanceM: number };
}

/** A leg of the day with its line, the line on the plane, the metres along it to each of its points, its length and riding time, and where it starts along the day. */
interface LegLine {
  routeIndex: number;
  routeId: string;
  legIndex: number;
  line: LngLat[];
  xy: XY[];
  alongM: Float64Array;
  distanceM: number;
  durationS: number;
  startM: number;
  startS: number;
}

function legLines(day: Day, toPlane: (p: LngLat) => XY, decode: (geometry: string) => LngLat[]): LegLine[] {
  const legs: LegLine[] = [];
  let startM = 0;
  let startS = 0;
  day.routes.forEach((route, routeIndex) => {
    routeLegs(route).forEach((leg, legIndex) => {
      const line = legCoordinates(route, leg, decode);
      const alongM = metresAlong(line);
      const distanceM = legDistance(route, leg);
      const durationS = legDuration(route, leg);
      legs.push({ routeIndex, routeId: route.id, legIndex, line, xy: line.map(toPlane), alongM, distanceM, durationS, startM, startS });
      startM += distanceM;
      startS += durationS;
    });
  });
  return legs;
}

/** The entry of a free stop, placed at `hit`, the place on the legs nearest to it. */
function freeStopEntry(stop: Stop, legs: readonly LegLine[], hit: NearestPlace): SequenceEntry {
  const leg = legs[hit.index]!;
  const [a, b] = [leg.line[hit.segment]!, leg.line[hit.segment + 1] ?? leg.line[hit.segment]!];
  const spot: LngLat = [a[0] + hit.t * (b[0] - a[0]), a[1] + hit.t * (b[1] - a[1])];
  const alongM = leg.alongM[hit.segment]! + distanceBetween(a, spot);
  return {
    id: stop.id,
    routeIndex: leg.routeIndex,
    distanceM: leg.startM + alongM,
    timeS: leg.startS + (leg.distanceM > 0 ? (alongM / leg.distanceM) * leg.durationS : 0),
    lngLat: stop.lngLat,
    stop,
    near: { routeId: leg.routeId, legIndex: leg.legIndex, lngLat: spot, distanceM: hit.distance },
  };
}

/**
 * The day's stops and route points in riding order. Bound stops stand in for their
 * points (each of several on one point); free stops are placed where the routes pass
 * closest, after a stop or point at the same distance. Free stops that no leg passes
 * within FREE_STOP_REACH_M have no place on the ride and are left out (standingAlone).
 */
export function daySequence(day: Day, decode = decodeCached): SequenceEntry[] {
  const bound = new Map<string, Stop[]>();
  for (const stop of day.stops) {
    if (stop.pointId !== null) bound.set(stop.pointId, [...(bound.get(stop.pointId) ?? []), stop]);
  }
  const entries: SequenceEntry[] = [];
  let metres = 0;
  let seconds = 0;
  day.routes.forEach((route, routeIndex) => {
    const legs = routeLegs(route);
    if (route.kind === 'track') {
      const line = routePositions(route);
      metres += legDistance(route, legs[0]!);
      seconds += legDuration(route, legs[0]!);
      if (line.length > 0) entries.push({ id: route.id, routeIndex, distanceM: metres, timeS: seconds, lngLat: line.at(-1)! });
      return;
    }
    route.points.forEach((point, i) => {
      if (i > 0) {
        metres += legDistance(route, legs[i - 1]!);
        seconds += legDuration(route, legs[i - 1]!);
      }
      const at = { routeIndex, distanceM: metres, timeS: seconds, lngLat: point.lngLat, point };
      const stops = bound.get(point.id);
      if (stops) for (const stop of stops) entries.push({ id: stop.id, ...at, stop });
      else entries.push({ id: point.id, ...at });
    });
  });
  const free = day.stops.filter((s) => s.pointId === null);
  if (free.length > 0) {
    const toPlane = planeAt((day.routes[0] && routePositions(day.routes[0])[0]) ?? free[0]!.lngLat);
    const legs = legLines(day, toPlane, decode);
    const nearest = nearestOnLines(legs.map((l) => l.xy));
    for (const stop of free) {
      const hit = nearest(toPlane(stop.lngLat), FREE_STOP_REACH_M);
      if (hit) entries.push(freeStopEntry(stop, legs, hit));
    }
  }
  // A stable sort keeps points before the free stops placed at the same distance.
  return entries.sort((a, b) => a.routeIndex - b.routeIndex || a.distanceM - b.distanceM);
}

/** The day's stops the riding sequence leaves out, in their order: the free stops that stand for themselves, beside no route. */
export function standingAlone(day: Day, sequence: readonly SequenceEntry[]): Stop[] {
  const placed = new Set(sequence.flatMap((e) => (e.stop ? [e.stop.id] : [])));
  return day.stops.filter((s) => !placed.has(s.id));
}

/**
 * The trip with each day's stops sorted into riding order: how the document is stored, so
 * that the server and the read-only page need no routing. A sort of the day's own list,
 * so that no stop can go missing whatever the sequence lists.
 */
export function withStopsInRidingOrder(trip: Trip): Trip {
  const days = trip.days.map((day) => {
    let sorted = sortedDays.get(day);
    if (!sorted) {
      const rank = new Map(daySequence(day).map((e, i) => [e.id, i]));
      sorted = { ...day, stops: [...day.stops].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)) };
      sortedDays.set(day, sorted);
    }
    return sorted;
  });
  return { ...trip, days };
}

/** Days in riding order by the day they were sorted from: days are never changed in place, so a day an edit left alone is sorted once. */
const sortedDays = new WeakMap<Day, Day>();
