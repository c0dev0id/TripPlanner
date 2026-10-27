import { distanceBetween } from '../geo/measure';
import { nearestLine, type XY } from '../geo/nearest';
import type { Day, LngLat, Route, RoutePoint, Stop } from '../model/trip';
import { legCoordinates, legDistance, routeLegs } from './legs';
import { decodePolyline } from './polyline';

/**
 * A day's stops and route points in riding order, each with its distance from the day's
 * start along the routes. A free stop takes the place where a route passes closest.
 */

export interface SequenceEntry {
  /** Which route of the day, in order, and the distance from the day's start in metres. */
  routeIndex: number;
  distanceM: number;
  lngLat: LngLat;
  stop?: Stop;
  point?: RoutePoint;
  /** For a free stop: where on the route it is nearest, and how far from it. */
  near?: { lngLat: LngLat; distanceM: number };
}

/** Metres per degree of latitude; longitudes are scaled by the cosine of the latitude. */
const METRES_PER_DEGREE = 111_195;

/** A flat map in metres around a position. */
function planeAt([lng0, lat0]: LngLat): (p: LngLat) => XY {
  const scale = Math.cos((lat0 * Math.PI) / 180);
  return ([lng, lat]) => [(lng - lng0) * scale * METRES_PER_DEGREE, (lat - lat0) * METRES_PER_DEGREE];
}

/** Where a day's route passes closest to a position: the route, the leg, the spot on it and its distance from the day's start. */
export interface NearestPlace {
  routeIndex: number;
  routeId: string;
  /** The leg of the route, from its point `legIndex` to the next. */
  legIndex: number;
  lngLat: LngLat;
  /** From the day's start, along the routes. */
  distanceM: number;
  /** From the position to the spot. */
  awayM: number;
}

/** The place on the day's routes nearest to a position, or undefined where the day has no leg. */
export function nearestOnRoutes(day: Day, position: LngLat, decode = decodePolyline): NearestPlace | undefined {
  const toPlane = planeAt(position);
  const origin = toPlane(position);
  let best: NearestPlace | undefined;
  let startOfRoute = 0;
  day.routes.forEach((route, routeIndex) => {
    let startOfLeg = startOfRoute;
    routeLegs(route).forEach((leg, legIndex) => {
      const line = legCoordinates(route, leg, decode);
      const hit = nearestLine([line.map(toPlane)], origin);
      if (hit && (!best || hit.distance < best.awayM)) {
        const [a, b] = [line[hit.segment]!, line[hit.segment + 1] ?? line[hit.segment]!];
        const spot: LngLat = [a[0] + hit.t * (b[0] - a[0]), a[1] + hit.t * (b[1] - a[1])];
        best = { routeIndex, routeId: route.id, legIndex, lngLat: spot, distanceM: startOfLeg + alongLine(line, hit.segment, spot), awayM: hit.distance };
      }
      startOfLeg += legDistance(route, leg);
    });
    startOfRoute = startOfLeg;
  });
  return best;
}

/** Metres along a line from its start to a spot on its segment `segment`. */
function alongLine(line: readonly LngLat[], segment: number, spot: LngLat): number {
  let metres = 0;
  for (let i = 1; i <= segment; i++) metres += distanceBetween(line[i - 1]!, line[i]!);
  return metres + distanceBetween(line[segment]!, spot);
}

/** Each route point's distance from the day's start, by point id, in riding order. */
function pointDistances(routes: readonly Route[]): Map<string, { routeIndex: number; distanceM: number }> {
  const distances = new Map<string, { routeIndex: number; distanceM: number }>();
  let metres = 0;
  routes.forEach((route, routeIndex) => {
    const legs = routeLegs(route);
    route.points.forEach((point, i) => {
      if (i > 0) metres += legDistance(route, legs[i - 1]!);
      distances.set(point.id, { routeIndex, distanceM: metres });
    });
  });
  return distances;
}

/**
 * The day's stops and route points in riding order. Bound stops stand in for their
 * points; free stops are placed where the routes pass closest, after a stop or point
 * at the same distance. Free stops of a day without a leg come last, in their order.
 */
export function daySequence(day: Day, decode = decodePolyline): SequenceEntry[] {
  const distances = pointDistances(day.routes);
  const bound = new Map(day.stops.filter((s) => s.pointId !== null).map((s) => [s.pointId!, s]));
  const entries: SequenceEntry[] = [];
  for (const route of day.routes) {
    for (const point of route.points) {
      const at = distances.get(point.id)!;
      const stop = bound.get(point.id);
      entries.push(stop ? { ...at, lngLat: point.lngLat, stop, point } : { ...at, lngLat: point.lngLat, point });
    }
  }
  const lastRoute = Math.max(0, day.routes.length - 1);
  const end = entries.at(-1)?.distanceM ?? 0;
  for (const stop of day.stops) {
    if (stop.pointId !== null) continue;
    const near = nearestOnRoutes(day, stop.lngLat, decode);
    entries.push(
      near
        ? { routeIndex: near.routeIndex, distanceM: near.distanceM, lngLat: stop.lngLat, stop, near: { lngLat: near.lngLat, distanceM: near.awayM } }
        : { routeIndex: lastRoute, distanceM: end, lngLat: stop.lngLat, stop },
    );
  }
  // A stable sort keeps points before the free stops placed at the same distance.
  return entries.sort((a, b) => a.routeIndex - b.routeIndex || a.distanceM - b.distanceM);
}
