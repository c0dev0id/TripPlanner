import { distanceBetween, planeAt } from '../geo/measure';
import { nearestLine, type XY } from '../geo/nearest';
import type { Day, LngLat, RoutePoint, Stop, Trip } from '../model/trip';
import { legCoordinates, legDistance, legDuration, routeLegs } from './legs';
import { decodeCached } from './polyline';

/**
 * A day's stops and route points in riding order, each with its distance from the day's
 * start along the routes. A free stop takes the place where a route passes closest.
 */

export interface SequenceEntry {
  /** The stop's id, or the plain route point's. */
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

/** A leg of the day with its line, the line on the plane, its length and riding time, and where it starts along the day. */
interface LegLine {
  routeIndex: number;
  routeId: string;
  legIndex: number;
  line: LngLat[];
  xy: XY[];
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
      const distanceM = legDistance(route, leg);
      const durationS = legDuration(route, leg);
      legs.push({ routeIndex, routeId: route.id, legIndex, line, xy: line.map(toPlane), distanceM, durationS, startM, startS });
      startM += distanceM;
      startS += durationS;
    });
  });
  return legs;
}

/** Metres along a line from its start to a spot on its segment `segment`. */
function alongLine(line: readonly LngLat[], segment: number, spot: LngLat): number {
  let metres = 0;
  for (let i = 1; i <= segment; i++) metres += distanceBetween(line[i - 1]!, line[i]!);
  return metres + distanceBetween(line[segment]!, spot);
}

/** The entry of a free stop, placed where the legs pass closest; after the day's end where there is no leg. */
function freeStopEntry(stop: Stop, legs: readonly LegLine[], origin: XY, fallback: { routeIndex: number; distanceM: number; timeS: number }): SequenceEntry {
  const hit = nearestLine(legs.map((l) => l.xy), origin);
  if (!hit) return { id: stop.id, ...fallback, lngLat: stop.lngLat, stop };
  const leg = legs[hit.index]!;
  const [a, b] = [leg.line[hit.segment]!, leg.line[hit.segment + 1] ?? leg.line[hit.segment]!];
  const spot: LngLat = [a[0] + hit.t * (b[0] - a[0]), a[1] + hit.t * (b[1] - a[1])];
  const alongM = alongLine(leg.line, hit.segment, spot);
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
 * closest, after a stop or point at the same distance. Free stops of a day without a leg
 * come last, in their order.
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
    const toPlane = planeAt(day.routes[0]?.points[0]?.lngLat ?? free[0]!.lngLat);
    const legs = legLines(day, toPlane, decode);
    const end = { routeIndex: Math.max(0, day.routes.length - 1), distanceM: metres, timeS: seconds };
    for (const stop of free) entries.push(freeStopEntry(stop, legs, toPlane(stop.lngLat), end));
  }
  // A stable sort keeps points before the free stops placed at the same distance.
  return entries.sort((a, b) => a.routeIndex - b.routeIndex || a.distanceM - b.distanceM);
}

/**
 * The trip with each day's stops sorted into riding order: how the document is stored, so
 * that the server and the read-only page need no routing. A sort of the day's own list,
 * so that no stop can go missing whatever the sequence lists.
 */
export function withStopsInRidingOrder(trip: Trip): Trip {
  const days = trip.days.map((day) => {
    const rank = new Map(daySequence(day).map((e, i) => [e.id, i]));
    return { ...day, stops: [...day.stops].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)) };
  });
  return { ...trip, days };
}
