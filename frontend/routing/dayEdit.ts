import { withChanges, type Day, type LngLat, type Profile, type Route, type RoutedRoute, type RoutePoint, type Stop, type Trip } from '../model/trip';
import * as routeEdit from './routeEdit';

/**
 * Pure edits of a trip's days: routes, their points, and the stops that are bound to a
 * point of a routed route or free. A bound stop stands at its point; after every change of
 * a day's routes the stops are aligned, and a stop whose point is gone becomes free where
 * it was. A track has no points of its own: the stops along it are free.
 */

/** The points a route runs through as points of its own, which a track has none of. */
export const routePoints = (route: Route): readonly RoutePoint[] => (route.kind === 'routed' ? route.points : []);

/** The stops bound to the route's points. */
export function stopsBoundTo(route: Route, stops: readonly Stop[]): Stop[] {
  const pointIds = new Set(routePoints(route).map((p) => p.id));
  return stops.filter((s) => s.pointId !== null && pointIds.has(s.pointId));
}

/** A stop with nothing said about it yet. */
export function newStop(id: string, name: string, lngLat: LngLat, pointId: string | null): Stop {
  return { id, name, kind: 'other', lngLat, pointId, address: '', contact: '', bookingReference: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false };
}

/** The day's stops with every bound one at its route point, or free where its point no longer is. */
export function alignStops(day: Day): Day {
  const positions = new Map(day.routes.flatMap((route) => routePoints(route).map((p) => [p.id, p.lngLat] as const)));
  const stops = day.stops.map((stop) => {
    if (stop.pointId === null) return stop;
    const at = positions.get(stop.pointId);
    if (at === undefined) return { ...stop, pointId: null };
    return at === stop.lngLat ? stop : { ...stop, lngLat: at };
  });
  return stops.every((s, i) => s === day.stops[i]) ? day : { ...day, stops };
}

export function updateDay(trip: Trip, dayId: string, change: (day: Day) => Day): Trip {
  const days = trip.days.map((day) => (day.id === dayId ? change(day) : day));
  return days.every((d, i) => d === trip.days[i]) ? trip : { ...trip, days };
}

/** The route of the day that holds the point, and the point. */
export function pointOfDay(day: Day, pointId: string): { route: RoutedRoute; point: RoutePoint } | undefined {
  for (const route of day.routes) {
    if (route.kind !== 'routed') continue;
    const point = route.points.find((p) => p.id === pointId);
    if (point) return { route, point };
  }
  return undefined;
}

/**
 * Applies a route edit (see routeEdit) to the route, wherever in the trip it is, and
 * aligns the day's stops: a stop bound to a moved point moves along, one whose point is
 * gone stays where it was, free.
 */
export function updateRoute(trip: Trip, routeId: string, change: (route: Route) => Route): Trip {
  const day = dayOfRoute(trip, routeId);
  if (!day) return trip;
  return updateDay(trip, day.id, (d) => {
    const routes = d.routes.map((r) => (r.id === routeId ? change(r) : r));
    return routes.every((r, i) => r === d.routes[i]) ? d : alignStops({ ...d, routes });
  });
}

/** An edit of a routed route (see routeEdit) as an edit of any route: a track stays as it is. */
export const routedOnly =
  (change: (route: RoutedRoute) => RoutedRoute) =>
  (route: Route): Route =>
    route.kind === 'routed' ? change(route) : route;

/** The profile a new route of the day gets: that of the day's last route, or the motorcycle. */
export function defaultProfile(day: Day): Profile {
  return day.routes.at(-1)?.profile ?? 'motorcycle';
}

export function addRoute(trip: Trip, dayId: string, id: string): Trip {
  return updateDay(trip, dayId, (day) => ({
    ...day,
    routes: [...day.routes, { id, name: '', kind: 'routed', profile: defaultProfile(day), highways: 'allow', optional: false, points: [], legs: {} }],
  }));
}

/** Adds routes and stops, as read from a file, to the day. */
export function addParts(trip: Trip, dayId: string, parts: { routes: Route[]; stops: Stop[] }): Trip {
  if (parts.routes.length === 0 && parts.stops.length === 0) return trip;
  return updateDay(trip, dayId, (day) => ({ ...day, routes: [...day.routes, ...parts.routes], stops: [...day.stops, ...parts.stops] }));
}

/** Removes a route; the stops bound to its points stay, free. */
export function removeRoute(trip: Trip, dayId: string, routeId: string): Trip {
  return updateDay(trip, dayId, (day) => (day.routes.some((r) => r.id === routeId) ? alignStops({ ...day, routes: day.routes.filter((r) => r.id !== routeId) }) : day));
}

/** Drops every routed leg of the route so that they are routed again. */
export function clearLegs(trip: Trip, routeId: string): Trip {
  return updateRoute(trip, routeId, routedOnly((r) => (Object.keys(r.legs).length === 0 ? r : { ...r, legs: {} })));
}

/** Makes a stop of the route point, unless one is bound to it already. */
export function convertPoint(trip: Trip, dayId: string, pointId: string, id: string): Trip {
  return updateDay(trip, dayId, (day) => {
    if (day.stops.some((s) => s.pointId === pointId)) return day;
    const point = pointOfDay(day, pointId)?.point;
    if (!point) return day;
    return { ...day, stops: [...day.stops, newStop(id, `Stop ${day.stops.length + 1}`, point.lngLat, pointId)] };
  });
}

/** Inserts a point of the route before the one at `index` and makes a stop of it; on a track, which has no points of its own, a free stop there. */
export function insertStop(trip: Trip, dayId: string, routeId: string, index: number, lngLat: LngLat, pointId: string, stopId: string): Trip {
  if (dayOfRoute(trip, routeId)?.routes.find((r) => r.id === routeId)?.kind === 'track') return addFreeStop(trip, dayId, lngLat, stopId);
  return convertPoint(updateRoute(trip, routeId, routedOnly((r) => routeEdit.insertPoint(r, index, { id: pointId, lngLat }))), dayId, pointId, stopId);
}

/** Adds a free stop at a position. */
export function addFreeStop(trip: Trip, dayId: string, lngLat: LngLat, id: string): Trip {
  return updateDay(trip, dayId, (day) => ({ ...day, stops: [...day.stops, newStop(id, `Stop ${day.stops.length + 1}`, lngLat, null)] }));
}

/** Binds a free stop to a new point of the routed route, inserted before the point at `index` at the stop's position. */
export function connectStop(trip: Trip, dayId: string, stopId: string, routeId: string, index: number, pointId: string): Trip {
  return updateDay(trip, dayId, (day) => {
    const stop = day.stops.find((s) => s.id === stopId);
    if (!stop || stop.pointId !== null || !day.routes.some((r) => r.id === routeId && r.kind === 'routed')) return day;
    const routes = day.routes.map((r) => (r.id === routeId && r.kind === 'routed' ? routeEdit.insertPoint(r, index, { id: pointId, lngLat: stop.lngLat }) : r));
    const stops = day.stops.map((s) => (s.id === stopId ? { ...s, pointId } : s));
    return { ...day, routes, stops };
  });
}

/** Frees a bound stop where it stands; its route point goes and the route runs past. */
export function disconnectStop(trip: Trip, dayId: string, stopId: string): Trip {
  return updateDay(trip, dayId, (day) => {
    const stop = day.stops.find((s) => s.id === stopId);
    if (!stop || stop.pointId === null) return day;
    const pointId = stop.pointId;
    const routes = day.routes.map(routedOnly((r) => (r.points.some((p) => p.id === pointId) ? routeEdit.removePoint(r, pointId) : r)));
    return { ...day, routes, stops: day.stops.map((s) => (s.id === stopId ? { ...s, pointId: null } : s)) };
  });
}

/** Moves a stop: a bound one by moving its point, a free one on its own. */
export function moveStop(trip: Trip, dayId: string, stopId: string, lngLat: LngLat): Trip {
  return updateDay(trip, dayId, (day) => {
    const stop = day.stops.find((s) => s.id === stopId);
    if (!stop) return day;
    const pointId = stop.pointId;
    if (pointId === null) return { ...day, stops: day.stops.map((s) => (s.id === stopId ? { ...s, lngLat } : s)) };
    const route = pointOfDay(day, pointId)?.route;
    return route ? alignStops({ ...day, routes: day.routes.map((r) => (r === route ? routeEdit.movePoint(r, pointId, lngLat) : r)) }) : day;
  });
}

/** Removes a stop; a point it was bound to stays as a plain point of the route. */
export function removeStop(trip: Trip, dayId: string, stopId: string): Trip {
  return updateDay(trip, dayId, (day) => (day.stops.some((s) => s.id === stopId) ? { ...day, stops: day.stops.filter((s) => s.id !== stopId) } : day));
}

/** Changes what a stop says about itself: name, kind, address, notes, times. */
export function updateStop(trip: Trip, dayId: string, stopId: string, change: Partial<Omit<Stop, 'id' | 'pointId'>>): Trip {
  return updateDay(trip, dayId, (day) => {
    const stop = day.stops.find((s) => s.id === stopId);
    const next = stop && withChanges(stop, change);
    return !next || next === stop ? day : { ...day, stops: day.stops.map((s) => (s === stop ? next : s)) };
  });
}

/** Adds a day at the end, dated the day after the last one where that has a date. */
/** A day without routes, stops or notes. */
const emptyDay = (id: string, name: string, date: string | null): Day => ({ id, name, date, notes: '', routes: [], stops: [] });

export function addDay(trip: Trip, id: string): Trip {
  const last = trip.days.at(-1)?.date ?? null;
  return { ...trip, days: [...trip.days, emptyDay(id, '', last === null ? null : dayAfter(last))] };
}

/** The date after a date given as YYYY-MM-DD, in the same form; counted in UTC, where no daylight-saving step can shorten a day. */
export function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function removeDay(trip: Trip, dayId: string): Trip {
  return { ...trip, days: trip.days.filter((d) => d.id !== dayId) };
}

/** Moves the day to place `to` among the days. */
export function moveDay(trip: Trip, dayId: string, to: number): Trip {
  const days = movedTo(trip.days, dayId, to);
  return days === trip.days ? trip : { ...trip, days };
}

/** A copy of the day as `id`, right after it, without a date; its parts under new ids, bound stops following their points. */
export function duplicateDay(trip: Trip, dayId: string, id: string, newId: () => string): Trip {
  const index = trip.days.findIndex((d) => d.id === dayId);
  if (index < 0) return trip;
  const day = trip.days[index]!;
  const routes = day.routes.map((route) => copyRoute(route, newId));
  const pointIds = new Map(day.routes.flatMap((route, r) => copiedPointIds(route, routes[r]!)));
  const stops = day.stops.map((stop) => ({ ...stop, id: newId(), pointId: stop.pointId === null ? null : pointIds.get(stop.pointId)! }));
  const copy: Day = { ...day, id, date: null, routes, stops };
  return { ...trip, days: trip.days.toSpliced(index + 1, 0, copy) };
}

/** Moves the route to place `to` among the routes of its day. */
export function moveRoute(trip: Trip, routeId: string, to: number): Trip {
  const day = dayOfRoute(trip, routeId);
  return day
    ? updateDay(trip, day.id, (d) => {
        const routes = movedTo(d.routes, routeId, to);
        return routes === d.routes ? d : { ...d, routes };
      })
    : trip;
}

/** A copy of the route with new ids, right after it, named after it; the stops stay with the original. */
export function duplicateRoute(trip: Trip, routeId: string, newId: () => string): Trip {
  const day = dayOfRoute(trip, routeId);
  if (!day) return trip;
  return updateDay(trip, day.id, (d) => {
    const index = d.routes.findIndex((r) => r.id === routeId);
    const route = d.routes[index]!;
    const copy = { ...copyRoute(route, newId), name: route.name === '' ? '' : `${route.name} copy` };
    return { ...d, routes: d.routes.toSpliced(index + 1, 0, copy) };
  });
}

/** Moves the route to the end of another day, with the stops bound to its points. */
export function moveRouteToDay(trip: Trip, routeId: string, dayId: string): Trip {
  const from = dayOfRoute(trip, routeId);
  if (!from || from.id === dayId || !trip.days.some((d) => d.id === dayId)) return trip;
  const { route, stops } = copiedRoute(from, from.routes.find((r) => r.id === routeId)!);
  const days = trip.days.map((d) => {
    if (d.id === from.id) return { ...d, routes: d.routes.filter((r) => r.id !== routeId), stops: d.stops.filter((s) => !stops.includes(s)) };
    if (d.id === dayId) return { ...d, routes: [...d.routes, route], stops: [...d.stops, ...stops] };
    return d;
  });
  return { ...trip, days };
}

/** A route as copied to be pasted into a day, of its trip or another, with the stops bound to its points and the date and name of the day it was on. */
export interface CopiedRoute {
  route: Route;
  stops: Stop[];
  from: Pick<Day, 'date' | 'name'>;
}

/** The route of the day with the stops bound to its points, as a copy to paste. */
export function copiedRoute(day: Day, route: Route): CopiedRoute {
  return { route, stops: stopsBoundTo(route, day.stops), from: { date: day.date, name: day.name } };
}

/** Adds a copied route at the end of the day, it, its points and its stops under new ids, the stops bound to the new points. */
export function pasteRoute(trip: Trip, dayId: string, copied: CopiedRoute, newId: () => string): Trip {
  const route = copyRoute(copied.route, newId);
  const pointIds = new Map(copiedPointIds(copied.route, route));
  const stops = copied.stops.map((s) => ({ ...s, id: newId(), pointId: pointIds.get(s.pointId!)! }));
  return updateDay(trip, dayId, (day) => ({ ...day, routes: [...day.routes, route], stops: [...day.stops, ...stops] }));
}

/**
 * Pastes copied routes into the trip where an import of their files would put them: in a
 * collection each into a new section named after it; in a trip each onto the day of its
 * date, or a new day of that date among the dated days, and an undated one onto a new day
 * of its own at the end. A new day of a trip takes the name of the day the route was on.
 */
export function pasteIntoTrip(trip: Trip, copied: readonly CopiedRoute[], newId: () => string): Trip {
  let next = trip;
  for (const c of copied) {
    const date = trip.kind === 'collection' ? null : c.from.date;
    let day = date === null ? undefined : next.days.find((d) => d.date === date);
    if (!day) {
      day = emptyDay(newId(), trip.kind === 'collection' ? c.route.name || c.from.name : c.from.name, date);
      const later = date === null ? -1 : next.days.findIndex((d) => d.date !== null && d.date > date);
      next = { ...next, days: next.days.toSpliced(later < 0 ? next.days.length : later, 0, day) };
    }
    next = pasteRoute(next, day.id, c, newId);
  }
  return next;
}

/** Adds a copied stop to the day under `id`, free where it stands. */
export function pasteStop(trip: Trip, dayId: string, stop: Stop, id: string): Trip {
  return updateDay(trip, dayId, (day) => ({ ...day, stops: [...day.stops, { ...stop, id, pointId: null }] }));
}

/** The ids of the day's route points that stops stand on. */
export function boundPointIds(day: Pick<Day, 'stops'>): Set<string> {
  return new Set(day.stops.flatMap((s) => (s.pointId === null ? [] : [s.pointId])));
}

/** The day the route belongs to. */
export function dayOfRoute(trip: Trip, routeId: string): Day | undefined {
  return trip.days.find((d) => d.routes.some((r) => r.id === routeId));
}

/** The list with the item at place `to`, within the list's ends; the same list where it is there already or not in it. */
function movedTo<T extends { id: string }>(items: readonly T[], id: string, to: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  const place = Math.max(0, Math.min(to, items.length - 1));
  if (from < 0 || from === place) return items as T[];
  const list = items.filter((item) => item.id !== id);
  list.splice(place, 0, items[from]!);
  return list;
}

/** The route with new ids for itself and its points; the legs stay, as they are keyed by position. */
function copyRoute(route: Route, newId: () => string): Route {
  return route.kind === 'track' ? { ...route, id: newId() } : { ...route, id: newId(), points: route.points.map((p) => ({ ...p, id: newId() })) };
}

/** Each point id of a route with the id of the same point in its copy. */
function copiedPointIds(original: Route, copy: Route): [string, string][] {
  return original.kind === 'routed' && copy.kind === 'routed' ? original.points.map((p, i) => [p.id, copy.points[i]!.id]) : [];
}

