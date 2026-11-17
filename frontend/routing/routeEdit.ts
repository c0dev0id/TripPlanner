import { keepTolerances } from '../geo/simplify';
import { withChanges, type LngLat, type Route, type RoutedLeg, type RoutedRoute, type RoutePoint, type Track } from '../model/trip';
import { pruneLegs, routedLegs, routeLine } from './legs';
import { decodeCached, encodePolyline } from './polyline';

/** Pure edits of one route. Each result keeps exactly the routed legs it still needs. */

export function withPrunedLegs(route: RoutedRoute): RoutedRoute {
  return { ...route, legs: pruneLegs(route) };
}

export function appendPoint(route: RoutedRoute, point: RoutePoint): RoutedRoute {
  return { ...route, points: [...route.points, point] };
}

/** Inserts a point before the one at `index`, splitting the leg that led there; both halves keep its kind. */
export function insertPoint(route: RoutedRoute, index: number, point: RoutePoint): RoutedRoute {
  const split = route.points[index]?.straight ? { ...point, straight: true } : point;
  return withPrunedLegs({ ...route, points: [...route.points.slice(0, index), split, ...route.points.slice(index)] });
}

export function movePoint(route: RoutedRoute, id: string, lngLat: LngLat): RoutedRoute {
  return withPrunedLegs({ ...route, points: route.points.map((p) => (p.id === id ? { ...p, lngLat } : p)) });
}

export function removePoint(route: RoutedRoute, id: string): RoutedRoute {
  return withPrunedLegs({ ...route, points: route.points.filter((p) => p.id !== id) });
}

/** Makes the leg that leads to the point straight, or routed again. */
export function setStraight(route: RoutedRoute, id: string, straight: boolean): RoutedRoute {
  const points = route.points.map((p) => {
    if (p.id !== id) return p;
    const { straight: _, ...plain } = p;
    return straight ? { ...plain, straight: true } : plain;
  });
  return withPrunedLegs({ ...route, points });
}

/** What a route says about itself; the motorway dial only a routed route has. */
export type RouteSettings = Pick<RoutedRoute, 'name' | 'profile' | 'highways' | 'optional' | 'color'>;

/** Changes what a route says about itself, the motorway dial a routed route's alone; under a new profile or motorway dial its legs are routed again. */
export function changeSettings(route: Route, change: Partial<RouteSettings>): Route {
  if (route.kind === 'track') return withChanges(route, change);
  const next = withChanges(route, change);
  return next === route ? route : withPrunedLegs(next);
}

/** For each point of the track, the tolerance in metres up to which thinning keeps it (Douglas–Peucker's). */
export function thinningTolerances(track: Track): Float64Array {
  return keepTolerances(decodeCached(track.line));
}

function thinnedLine(track: Track, toleranceM: number): LngLat[] {
  const tolerances = thinningTolerances(track);
  return decodeCached(track.line).filter((_, i) => tolerances[i]! > toleranceM);
}

/** The track with fewer points: those that keep its line within `toleranceM`. */
export function condenseTrack(track: Track, toleranceM: number): Track {
  return { ...track, line: encodePolyline(thinnedLine(track, toleranceM)) };
}

/** A route made of the track, under new ids and in the colour its place gives it: thinned like `condenseTrack`, every leg routed along the roads. */
export function trackToRoute(track: Track, toleranceM: number, newId: () => string): RoutedRoute {
  const { line: _, ...base } = track;
  return { ...base, id: newId(), color: null, kind: 'routed', highways: 'allow', points: thinnedLine(track, toleranceM).map((lngLat) => ({ id: newId(), lngLat })), legs: {} };
}

/** A track made of the route, under the id given and in the colour its place gives it: the route's line as it runs now, along its legs, and no points of its own. */
export function routeToTrack(route: RoutedRoute, id: string): Track {
  const { points: _, legs: __, highways: ___, ...base } = route;
  return { ...base, id, color: null, kind: 'track', line: encodePolyline(routeLine(route)) };
}

/** Stores a routed leg if the route still needs it (the request may be outdated). */
export function addLeg(route: RoutedRoute, key: string, leg: RoutedLeg): RoutedRoute {
  if (!routedLegs(route).some((l) => l.key === key)) return route;
  return { ...route, legs: { ...route.legs, [key]: leg } };
}
