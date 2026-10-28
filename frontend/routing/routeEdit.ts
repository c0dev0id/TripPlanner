import type { LngLat, Route, RoutedLeg, RoutePoint } from '../model/trip';
import { pruneLegs, routedLegs, type Costing } from './legs';

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

/** Changes the profile or the motorway dial; the legs are routed again under the new costing. */
export function changeCosting(route: Route, costing: Partial<Costing>): Route {
  return withPrunedLegs({ ...route, ...costing });
}

/** Stores a routed leg if the route still needs it (the request may be outdated). */
export function addLeg(route: Route, key: string, leg: RoutedLeg): Route {
  if (!routedLegs(route).some((l) => l.key === key)) return route;
  return { ...route, legs: { ...route.legs, [key]: leg } };
}
