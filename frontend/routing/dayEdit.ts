import type { Day, LngLat, Profile, Route, RoutePoint, Stop, Trip } from '../model/trip';
import * as routeEdit from './routeEdit';

/**
 * Pure edits of a trip's days: routes, their points, and the stops that are bound to a
 * route point or free. A bound stop stands at its point; after every change of a day's
 * routes the stops are aligned, and a stop whose point is gone becomes free where it was.
 */

/** A stop with nothing said about it yet. */
export function newStop(id: string, name: string, lngLat: LngLat, pointId: string | null): Stop {
  return { id, name, kind: 'other', lngLat, pointId, address: '', contact: '', bookingReference: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false };
}

/** The day's stops with every bound one at its route point, or free where its point no longer is. */
export function alignStops(day: Day): Day {
  const positions = new Map(day.routes.flatMap((route) => route.points.map((p) => [p.id, p.lngLat] as const)));
  const stops = day.stops.map((stop) => {
    if (stop.pointId === null) return stop;
    const at = positions.get(stop.pointId);
    if (at === undefined) return { ...stop, pointId: null };
    return at === stop.lngLat ? stop : { ...stop, lngLat: at };
  });
  return stops.every((s, i) => s === day.stops[i]) ? day : { ...day, stops };
}

function updateDay(trip: Trip, dayId: string, change: (day: Day) => Day): Trip {
  const days = trip.days.map((day) => (day.id === dayId ? change(day) : day));
  return days.every((d, i) => d === trip.days[i]) ? trip : { ...trip, days };
}

/** The route of the day that holds the point, and the point. */
export function pointOfDay(day: Day, pointId: string): { route: Route; point: RoutePoint } | undefined {
  for (const route of day.routes) {
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

export function renameRoute(trip: Trip, routeId: string, name: string): Trip {
  return updateRoute(trip, routeId, (r) => (r.name === name ? r : { ...r, name }));
}

/** Drops every routed leg of the route so that they are routed again. */
export function clearLegs(trip: Trip, routeId: string): Trip {
  return updateRoute(trip, routeId, (r) => (Object.keys(r.legs).length === 0 ? r : { ...r, legs: {} }));
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

/** Inserts a point of the route before the one at `index` and makes a stop of it. */
export function insertStop(trip: Trip, dayId: string, routeId: string, index: number, lngLat: LngLat, pointId: string, stopId: string): Trip {
  return convertPoint(updateRoute(trip, routeId, (r) => routeEdit.insertPoint(r, index, { id: pointId, lngLat })), dayId, pointId, stopId);
}

/** Adds a free stop at a position. */
export function addFreeStop(trip: Trip, dayId: string, lngLat: LngLat, id: string): Trip {
  return updateDay(trip, dayId, (day) => ({ ...day, stops: [...day.stops, newStop(id, `Stop ${day.stops.length + 1}`, lngLat, null)] }));
}

/** Binds a free stop to a new point of the route, inserted before the point at `index` at the stop's position. */
export function connectStop(trip: Trip, dayId: string, stopId: string, routeId: string, index: number, pointId: string): Trip {
  return updateDay(trip, dayId, (day) => {
    const stop = day.stops.find((s) => s.id === stopId);
    if (!stop || stop.pointId !== null || !day.routes.some((r) => r.id === routeId)) return day;
    const routes = day.routes.map((r) => (r.id === routeId ? routeEdit.insertPoint(r, index, { id: pointId, lngLat: stop.lngLat }) : r));
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
    const routes = day.routes.map((r) => (r.points.some((p) => p.id === pointId) ? routeEdit.removePoint(r, pointId) : r));
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
    if (!stop || (Object.keys(change) as (keyof typeof change)[]).every((key) => stop[key] === change[key])) return day;
    return { ...day, stops: day.stops.map((s) => (s.id === stopId ? { ...s, ...change } : s)) };
  });
}

/** Adds a day at the end, dated the day after the last one where that has a date. */
export function addDay(trip: Trip, id: string): Trip {
  const last = trip.days.at(-1)?.date ?? null;
  return { ...trip, days: [...trip.days, { id, name: '', date: last === null ? null : dayAfter(last), notes: '', routes: [], stops: [] }] };
}

/** The date after a date given as YYYY-MM-DD, in the same form; counted in UTC, where no daylight-saving step can shorten a day. */
function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function removeDay(trip: Trip, dayId: string): Trip {
  return { ...trip, days: trip.days.filter((d) => d.id !== dayId) };
}

/** Swaps the day with the one before (`by` -1) or after (`by` 1); nothing at the ends. */
export function moveDay(trip: Trip, dayId: string, by: -1 | 1): Trip {
  const days = swapped(trip.days, dayId, by);
  return days === trip.days ? trip : { ...trip, days };
}

/** A copy of the day as `id`, right after it, without a date; its parts under new ids, bound stops following their points. */
export function duplicateDay(trip: Trip, dayId: string, id: string, newId: () => string): Trip {
  const index = trip.days.findIndex((d) => d.id === dayId);
  if (index < 0) return trip;
  const day = trip.days[index]!;
  const routes = day.routes.map((route) => copyRoute(route, newId));
  const pointIds = new Map(day.routes.flatMap((route, r) => route.points.map((p, i) => [p.id, routes[r]!.points[i]!.id])));
  const stops = day.stops.map((stop) => ({ ...stop, id: newId(), pointId: stop.pointId === null ? null : pointIds.get(stop.pointId)! }));
  const copy: Day = { ...day, id, date: null, routes, stops };
  return { ...trip, days: trip.days.toSpliced(index + 1, 0, copy) };
}

/** Swaps the route with the one before (`by` -1) or after (`by` 1) in its day; nothing at the ends. */
export function moveRoute(trip: Trip, routeId: string, by: -1 | 1): Trip {
  const day = dayOfRoute(trip, routeId);
  return day
    ? updateDay(trip, day.id, (d) => {
        const routes = swapped(d.routes, routeId, by);
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
  const route = from.routes.find((r) => r.id === routeId)!;
  const pointIds = new Set(route.points.map((p) => p.id));
  const bound = (stop: Stop) => stop.pointId !== null && pointIds.has(stop.pointId);
  const days = trip.days.map((d) => {
    if (d.id === from.id) return { ...d, routes: d.routes.filter((r) => r.id !== routeId), stops: d.stops.filter((s) => !bound(s)) };
    if (d.id === dayId) return { ...d, routes: [...d.routes, route], stops: [...d.stops, ...from.stops.filter(bound)] };
    return d;
  });
  return { ...trip, days };
}

/** A copy of the stop in another day, free where it stands. */
export function copyStopToDay(trip: Trip, stopId: string, dayId: string, newId: string): Trip {
  const stop = trip.days.flatMap((d) => d.stops).find((s) => s.id === stopId);
  return stop ? updateDay(trip, dayId, (day) => ({ ...day, stops: [...day.stops, { ...stop, id: newId, pointId: null }] })) : trip;
}

function dayOfRoute(trip: Trip, routeId: string): Day | undefined {
  return trip.days.find((d) => d.routes.some((r) => r.id === routeId));
}

/** The list with the item swapped with its neighbour; the same list where that is not possible. */
function swapped<T extends { id: string }>(items: readonly T[], id: string, by: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const other = index + by;
  if (index < 0 || other < 0 || other >= items.length) return items as T[];
  const list = [...items];
  [list[index], list[other]] = [list[other]!, list[index]!];
  return list;
}

/** The route with new ids for itself and its points; the legs stay, as they are keyed by position. */
function copyRoute(route: Route, newId: () => string): Route {
  return { ...route, id: newId(), points: route.points.map((p) => ({ ...p, id: newId() })) };
}

export function renameDay(trip: Trip, dayId: string, name: string): Trip {
  return updateDay(trip, dayId, (day) => (day.name === name ? day : { ...day, name }));
}

/** Dates the day, as YYYY-MM-DD, or takes the date away. */
export function setDayDate(trip: Trip, dayId: string, date: string | null): Trip {
  return updateDay(trip, dayId, (day) => (day.date === date ? day : { ...day, date }));
}
