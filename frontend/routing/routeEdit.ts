import { keepTolerances } from '../geo/simplify';
import { withChanges, type LngLat, type Route, type RoutedLeg, type RoutePoint } from '../model/trip';
import { pruneLegs, routedLegs } from './legs';

/** Pure edits of one route. Each result keeps exactly the routed legs it still needs. */

export function withPrunedLegs(route: Route): Route {
  return { ...route, legs: pruneLegs(route) };
}

export function appendPoint(route: Route, point: RoutePoint): Route {
  return { ...route, points: [...route.points, point] };
}

/** Inserts a point before the one at `index`, splitting the leg that led there; both halves keep its kind. */
export function insertPoint(route: Route, index: number, point: RoutePoint): Route {
  const split = route.points[index]?.straight ? { ...point, straight: true } : point;
  return withPrunedLegs({ ...route, points: [...route.points.slice(0, index), split, ...route.points.slice(index)] });
}

export function movePoint(route: Route, id: string, lngLat: LngLat): Route {
  return withPrunedLegs({ ...route, points: route.points.map((p) => (p.id === id ? { ...p, lngLat } : p)) });
}

export function removePoint(route: Route, id: string): Route {
  return withPrunedLegs({ ...route, points: route.points.filter((p) => p.id !== id) });
}

/** Makes the leg that leads to the point straight, or routed again. */
export function setStraight(route: Route, id: string, straight: boolean): Route {
  const points = route.points.map((p) => {
    if (p.id !== id) return p;
    const { straight: _, ...plain } = p;
    return straight ? { ...plain, straight: true } : plain;
  });
  return withPrunedLegs({ ...route, points });
}

/** Changes what a route says about itself; under a new profile or motorway dial the legs are routed again. */
export function changeSettings(route: Route, change: Partial<Pick<Route, 'name' | 'profile' | 'highways' | 'optional'>>): Route {
  const next = withChanges(route, change);
  return next === route ? route : withPrunedLegs(next);
}

/** For each point of the route, the tolerance in metres up to which thinning keeps it: Douglas–Peucker's, and any for a point in `keep`. */
export function thinningTolerances(route: Route, keep: ReadonlySet<string>): Float64Array {
  const tolerances = keepTolerances(route.points.map((p) => p.lngLat));
  route.points.forEach((p, i) => {
    if (keep.has(p.id)) tolerances[i] = Infinity;
  });
  return tolerances;
}

function thinnedPoints(route: Route, toleranceM: number, keep: ReadonlySet<string>): RoutePoint[] {
  const tolerances = thinningTolerances(route, keep);
  return route.points.filter((_, i) => tolerances[i]! > toleranceM);
}

/** The route with fewer points: those that keep its line within `toleranceM`, and those in `keep`; its legs stay as they are. */
export function condensePoints(route: Route, toleranceM: number, keep: ReadonlySet<string>): Route {
  return withPrunedLegs({ ...route, points: thinnedPoints(route, toleranceM, keep) });
}

/** The track as a route: thinned like `condensePoints`, every leg routed along the roads. */
export function trackToRoute(route: Route, toleranceM: number, keep: ReadonlySet<string>): Route {
  const points = thinnedPoints(route, toleranceM, keep).map(({ id, lngLat }) => ({ id, lngLat }));
  return withPrunedLegs({ ...route, kind: 'routed', points });
}

/** Stores a routed leg if the route still needs it (the request may be outdated). */
export function addLeg(route: Route, key: string, leg: RoutedLeg): Route {
  if (!routedLegs(route).some((l) => l.key === key)) return route;
  return { ...route, legs: { ...route.legs, [key]: leg } };
}
