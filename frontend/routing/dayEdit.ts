import { t } from '../i18n/t';
import { withChanges, type Day, type LngLat, type Profile, type Route, type RoutedRoute, type RoutePoint, type Stop, type Trip } from '../model/trip';
import { PLAIN_SYMBOL } from '../symbols/symbols';
import { roundLngLat } from './legs';
import * as routeEdit from './routeEdit';

/**
 * Pure edits of a trip's days: routes, their points, and the stops, each of which is of
 * one route or track of its day: bound to a point of a routed route, or beside its route.
 * A bound stop stands at its point; after every change of a day's routes the stops are
 * aligned: a stop whose point is gone stands beside its route where it was, and one
 * whose route is gone goes with it. A track has no points of its own: its stops stand
 * beside it. A place of a list of places is of no route.
 */

/** The points a route runs through as points of its own, which a track has none of. */
export const routePoints = (route: Route): readonly RoutePoint[] => (route.kind === 'routed' ? route.points : []);

/** The stops that are the route's own: on its points and beside it. */
export const stopsOf = (route: Route, stops: readonly Stop[]): Stop[] => stops.filter((s) => s.routeId === route.id);

/** The stops with each place once: copies of one waypoint that several routes have, alike in name, position and symbol, as the first of them. */
export function distinctStops(stops: readonly Stop[]): Stop[] {
  const seen = new Set<string>();
  return stops.filter((stop) => {
    const key = `${stop.name}|${stop.lngLat.join(',')}|${stop.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A stop with nothing said about it yet, of the route `routeId` and on its point `pointId`, or of none. */
export function newStop(id: string, name: string, lngLat: LngLat, routeId: string | null, pointId: string | null): Stop {
  return { id, name, symbol: PLAIN_SYMBOL, lngLat, routeId, pointId, address: '', contact: '', bookingReference: '', website: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false };
}

/** The stops as the route's own under the ids `newId` gives: each on the route's point where it stands on one, else beside the route. */
export function asStopsOf(route: Route, stops: readonly Stop[], newId: () => string): Stop[] {
  const pointAt = new Map(routePoints(route).map((p) => [p.lngLat.join(','), p.id]));
  return stops.map((stop) => {
    const at = roundLngLat(stop.lngLat);
    return { ...stop, id: newId(), lngLat: at, routeId: route.id, pointId: pointAt.get(at.join(',')) ?? null };
  });
}

/** Whether the day takes stops: a day of a trip only where it has a route or track for them, a category of a list of places always. */
export const takesStops = (trip: Trip, day: Day): boolean => trip.kind === 'collection' || day.routes.length > 0;

/**
 * Stops of no route as a day takes them, under new ids: in a trip each route and track of
 * the day gets its own copy of each, and a day without one takes none; in a list of
 * places they are places of the category.
 */
function takenByDay(trip: Trip, day: Day, stops: readonly Stop[], newId: () => string): Stop[] {
  if (trip.kind === 'collection') return stops.map((stop) => ({ ...stop, id: newId(), routeId: null, pointId: null }));
  return day.routes.flatMap((route) => asStopsOf(route, stops, newId));
}

/** The day's stops with every bound one at its route point, or beside its route where its point no longer is; without those whose route no longer is. */
export function alignStops(day: Day): Day {
  const routeIds = new Set(day.routes.map((route) => route.id));
  const positions = new Map(day.routes.flatMap((route) => routePoints(route).map((p) => [p.id, p.lngLat] as const)));
  const stops = day.stops
    .filter((stop) => stop.routeId === null || routeIds.has(stop.routeId))
    .map((stop) => {
      if (stop.pointId === null) return stop;
      const at = positions.get(stop.pointId);
      if (at === undefined) return { ...stop, pointId: null };
      return at === stop.lngLat ? stop : { ...stop, lngLat: at };
    });
  return stops.length === day.stops.length && stops.every((s, i) => s === day.stops[i]) ? day : { ...day, stops };
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
    routes: [...day.routes, { id, name: '', kind: 'routed', profile: defaultProfile(day), highways: 'allow', optional: false, color: null, points: [], legs: {} }],
  }));
}

/** A name ending in a number, as what stands before the number and the number; none for any other name. */
function numberedName(name: string): { series: string; number: number } | undefined {
  const parts = /^(.*?)\s*(\d+)$/.exec(name);
  return parts ? { series: parts[1]!, number: Number(parts[2]) } : undefined;
}

/**
 * The stops on no point among `stops` that are numbered in a series, by their number: named alike
 * but for the number at the end, as two or more are. That is how some files name the
 * points of a route they keep as waypoints, and what tells them from a waypoint that is one.
 */
export function numberedStops(stops: readonly Stop[]): Stop[] {
  const numbered = stops.flatMap((stop) => {
    const name = stop.pointId === null ? numberedName(stop.name) : undefined;
    return name ? [{ stop, ...name }] : [];
  });
  const sizes = new Map<string, number>();
  for (const { series } of numbered) sizes.set(series, (sizes.get(series) ?? 0) + 1);
  return numbered
    .filter(({ series }) => sizes.get(series)! > 1)
    .sort((a, b) => a.number - b.number)
    .map(({ stop }) => stop);
}

/**
 * Makes a route of stops on no point of one day, at its end: each stop a point where it stands,
 * in the order they are named in, and no stop any more. Nothing with fewer than two.
 */
export function routeFromStops(trip: Trip, stopIds: readonly string[], routeId: string, newId: () => string): Trip {
  const day = trip.days.find((d) => d.stops.some((stop) => stopIds.includes(stop.id)));
  const taken = stopIds.flatMap((id) => day?.stops.find((stop) => stop.id === id && stop.pointId === null) ?? []);
  if (!day || taken.length < 2) return trip;
  const route: Route = { id: routeId, name: '', kind: 'routed', profile: defaultProfile(day), highways: 'allow', optional: false, color: null, points: taken.map((stop) => ({ id: newId(), lngLat: stop.lngLat })), legs: {} };
  return updateDay(trip, day.id, (d) => ({ ...d, routes: [...d.routes, route], stops: d.stops.filter((stop) => !taken.includes(stop)) }));
}

/** Adds routes with their stops, as read from a file, to the day; stops that come without a route are taken as the day takes them (see takenByDay), by the routes it has by then. */
export function addParts(trip: Trip, dayId: string, parts: { routes: Route[]; stops: Stop[] }, newId: () => string): Trip {
  if (parts.routes.length === 0 && parts.stops.length === 0) return trip;
  return updateDay(trip, dayId, (day) => {
    const withRoutes = { ...day, routes: [...day.routes, ...parts.routes] };
    const [own, loose] = [parts.stops.filter((stop) => stop.routeId !== null), parts.stops.filter((stop) => stop.routeId === null)];
    return { ...withRoutes, stops: [...day.stops, ...own, ...takenByDay(trip, withRoutes, loose, newId)] };
  });
}

/** Removes a route, and its stops with it. */
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
    const found = pointOfDay(day, pointId);
    if (!found) return day;
    return { ...day, stops: [...day.stops, newStop(id, t('Stop {n}', { n: day.stops.length + 1 }), found.point.lngLat, found.route.id, pointId)] };
  });
}

/** Inserts a point of the route before the one at `index` and makes a stop of it; on a track, which has no points of its own, a stop beside it there. */
export function insertStop(trip: Trip, dayId: string, routeId: string, index: number, lngLat: LngLat, pointId: string, stopId: string): Trip {
  if (dayOfRoute(trip, routeId)?.routes.find((r) => r.id === routeId)?.kind === 'track') return addStop(trip, dayId, routeId, lngLat, stopId);
  return convertPoint(updateRoute(trip, routeId, routedOnly((r) => routeEdit.insertPoint(r, index, { id: pointId, lngLat }))), dayId, pointId, stopId);
}

/** Adds a stop at a position beside the route or track `routeId` of the day; with null, a place of a category of a list of places. */
export function addStop(trip: Trip, dayId: string, routeId: string | null, lngLat: LngLat, id: string): Trip {
  return updateDay(trip, dayId, (day) => ({ ...day, stops: [...day.stops, newStop(id, t('Stop {n}', { n: day.stops.length + 1 }), lngLat, routeId, null)] }));
}

/** Binds a stop beside its routed route to a new point of it, inserted before the point at `index` at the stop's position. */
export function connectStop(trip: Trip, dayId: string, stopId: string, index: number, pointId: string): Trip {
  return updateDay(trip, dayId, (day) => {
    const stop = day.stops.find((s) => s.id === stopId);
    const routeId = stop?.routeId;
    if (!stop || stop.pointId !== null || !day.routes.some((r) => r.id === routeId && r.kind === 'routed')) return day;
    const routes = day.routes.map((r) => (r.id === routeId && r.kind === 'routed' ? routeEdit.insertPoint(r, index, { id: pointId, lngLat: stop.lngLat }) : r));
    const stops = day.stops.map((s) => (s.id === stopId ? { ...s, pointId } : s));
    return { ...day, routes, stops };
  });
}

/** Takes a bound stop off its point to stand beside its route there; the route point goes and the route runs past. */
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

/** A day without routes, stops or notes. */
const emptyDay = (id: string, name: string, date: string | null): Day => ({ id, name, date, notes: '', routes: [], stops: [] });

/** Adds a day at the end, dated the day after the last one where that has a date. */
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
  const copy: Day = { ...withNewPartIds(trip.days[index]!, newId).day, id, date: null };
  return { ...trip, days: trip.days.toSpliced(index + 1, 0, copy) };
}

/**
 * The day with its routes, their points and its stops under new ids, the stops following
 * their routes and points, and the new id of each old one.
 */
export function withNewPartIds(day: Day, newId: () => string): { day: Day; ids: Map<string, string> } {
  const routes = day.routes.map((route) => copyRoute(route, newId));
  const ids = new Map(day.routes.flatMap((route, r): [string, string][] => [[route.id, routes[r]!.id], ...copiedPointIds(route, routes[r]!)]));
  const stops = day.stops.map((stop) => {
    const id = newId();
    ids.set(stop.id, id);
    return { ...stop, id, routeId: (stop.routeId !== null && ids.get(stop.routeId)) || null, pointId: (stop.pointId !== null && ids.get(stop.pointId)) || null };
  });
  return { day: { ...day, routes, stops }, ids };
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

/** A copy of the route with new ids, right after it, named after it, with copies of its stops. */
export function duplicateRoute(trip: Trip, routeId: string, newId: () => string): Trip {
  const day = dayOfRoute(trip, routeId);
  if (!day) return trip;
  return updateDay(trip, day.id, (d) => {
    const index = d.routes.findIndex((r) => r.id === routeId);
    const { route, stops } = withNewIds(copiedRoute(d, d.routes[index]!), newId);
    return { ...d, routes: d.routes.toSpliced(index + 1, 0, { ...route, name: route.name === '' ? '' : `${route.name} copy` }), stops: [...d.stops, ...stops] };
  });
}

/**
 * The trip with what `make` makes of a route right after it in its day, with copies of
 * the route's stops beside it; the route stays as it is. Unchanged where `make` makes
 * nothing of it.
 */
export function addMadeOf(trip: Trip, routeId: string, make: (route: Route) => Route | undefined, newId: () => string): Trip {
  const day = dayOfRoute(trip, routeId);
  const index = day?.routes.findIndex((r) => r.id === routeId) ?? -1;
  const made = day && make(day.routes[index]!);
  if (!day || !made) return trip;
  const stops = asStopsOf(made, stopsOf(day.routes[index]!, day.stops), newId);
  return updateDay(trip, day.id, (d) => ({ ...d, routes: d.routes.toSpliced(index + 1, 0, made), stops: [...d.stops, ...stops] }));
}

/** Moves the route to the end of another day, with its stops. */
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

/** A route as copied to be pasted into a day, of its trip or another, with its stops and the date and name of the day it was on. */
export interface CopiedRoute {
  route: Route;
  stops: Stop[];
  from: Pick<Day, 'date' | 'name'>;
}

/** The route of the day with its stops, as a copy to paste. */
export function copiedRoute(day: Day, route: Route): CopiedRoute {
  return { route, stops: stopsOf(route, day.stops), from: { date: day.date, name: day.name } };
}

/** A copied route with itself, its points and its stops under new ids, the stops on the new points. */
function withNewIds(copied: CopiedRoute, newId: () => string): CopiedRoute {
  const route = copyRoute(copied.route, newId);
  const pointIds = new Map(copiedPointIds(copied.route, route));
  const stops = copied.stops.map((s) => ({ ...s, id: newId(), routeId: route.id, pointId: (s.pointId !== null && pointIds.get(s.pointId)) || null }));
  return { ...copied, route, stops };
}

/** Adds a copied route at the end of the day, it, its points and its stops under new ids. */
export function pasteRoute(trip: Trip, dayId: string, copied: CopiedRoute, newId: () => string): Trip {
  const { route, stops } = withNewIds(copied, newId);
  return updateDay(trip, dayId, (day) => ({ ...day, routes: [...day.routes, route], stops: [...day.stops, ...stops] }));
}

/** The trip with a new, empty day under `id` where its date puts it: before the first day of a later date, and at the end where it has no date or none is later. */
export function withDayByDate(trip: Trip, id: string, name: string, date: string | null): Trip {
  const later = date === null ? -1 : trip.days.findIndex((d) => d.date !== null && d.date > date);
  return { ...trip, days: trip.days.toSpliced(later < 0 ? trip.days.length : later, 0, emptyDay(id, name, date)) };
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
    let dayId = date === null ? undefined : next.days.find((d) => d.date === date)?.id;
    if (!dayId) {
      dayId = newId();
      next = withDayByDate(next, dayId, trip.kind === 'collection' ? c.route.name || c.from.name : c.from.name, date);
    }
    next = pasteRoute(next, dayId, c, newId);
  }
  return next;
}

/** Adds copied stops to the day, as the day takes them (see takenByDay). */
export function pasteStops(trip: Trip, dayId: string, stops: readonly Stop[], newId: () => string): Trip {
  return updateDay(trip, dayId, (day) => {
    const pasted = takenByDay(trip, day, stops, newId);
    return pasted.length > 0 ? { ...day, stops: [...day.stops, ...pasted] } : day;
  });
}

/** Adds copied stops to the route or track as its own, under new ids: each on its point where the stop stands on one, else beside it. */
export function pasteStopsIntoRoute(trip: Trip, routeId: string, stops: readonly Stop[], newId: () => string): Trip {
  const day = dayOfRoute(trip, routeId);
  const route = day?.routes.find((r) => r.id === routeId);
  return day && route ? updateDay(trip, day.id, (d) => ({ ...d, stops: [...d.stops, ...asStopsOf(route, stops, newId)] })) : trip;
}

/** What a trip holds below itself that is selected, copied and moved: its days, their routes, their stops. */
export type PartKind = 'day' | 'route' | 'stop';

/** Removes the parts: a day with all it holds, a route with its stops, a stop leaving its point to the route. */
export function removeParts(trip: Trip, kind: PartKind, ids: readonly string[]): Trip {
  if (kind === 'day') return ids.some((id) => trip.days.some((d) => d.id === id)) ? { ...trip, days: trip.days.filter((d) => !ids.includes(d.id)) } : trip;
  return ids.reduce((next, id) => {
    const day = kind === 'route' ? dayOfRoute(next, id) : dayOfStop(next, id);
    if (!day) return next;
    return kind === 'route' ? removeRoute(next, day.id, id) : removeStop(next, day.id, id);
  }, trip);
}

/** A copy of each part right after it: a day or a route as their own duplicates are made, a stop beside its route where the original stands. */
export function duplicateParts(trip: Trip, kind: PartKind, ids: readonly string[], newId: () => string): Trip {
  return ids.reduce((next, id) => {
    if (kind === 'day') return duplicateDay(next, id, newId(), newId);
    if (kind === 'route') return duplicateRoute(next, id, newId);
    const day = dayOfStop(next, id);
    if (!day) return next;
    const copyId = newId();
    return updateDay(next, day.id, (d) => {
      const index = d.stops.findIndex((s) => s.id === id);
      const stop = d.stops[index]!;
      return { ...d, stops: d.stops.toSpliced(index + 1, 0, { ...stop, id: copyId, pointId: null, name: stop.name === '' ? '' : `${stop.name} copy` }) };
    });
  }, trip);
}

/**
 * Moves the stop to another day, which takes it as it takes any (see takenByDay): a
 * place of a list of places goes to the other category, a stop of a trip to each route
 * and track of the day. It stays where it is where the day has none to take it.
 */
export function moveStopToDay(trip: Trip, stopId: string, dayId: string, newId: () => string): Trip {
  const from = dayOfStop(trip, stopId);
  const to = trip.days.find((d) => d.id === dayId);
  if (!from || !to || from.id === dayId) return trip;
  const taken = takenByDay(trip, to, [from.stops.find((s) => s.id === stopId)!], newId);
  if (taken.length === 0) return trip;
  const days = trip.days.map((d) => {
    if (d.id === from.id) return { ...d, stops: d.stops.filter((s) => s.id !== stopId) };
    return d.id === dayId ? { ...d, stops: [...d.stops, ...taken] } : d;
  });
  return { ...trip, days };
}

/**
 * Moves the stop to the route or track, of its day or another, as that route's own: on
 * its point where the stop stands on one, else beside it. A point the stop stood on stays
 * with the route it was of.
 */
export function moveStopIntoRoute(trip: Trip, stopId: string, routeId: string): Trip {
  const from = dayOfStop(trip, stopId);
  const target = dayOfRoute(trip, routeId);
  const stop = from?.stops.find((s) => s.id === stopId);
  if (!from || !target || !stop || stop.routeId === routeId) return trip;
  const moved = asStopsOf(target.routes.find((r) => r.id === routeId)!, [stop], () => stopId);
  const left = updateDay(trip, from.id, (d) => ({ ...d, stops: d.stops.filter((s) => s.id !== stopId) }));
  return updateDay(left, target.id, (d) => ({ ...d, stops: [...d.stops, ...moved] }));
}

/** Moves the days to right after the day `afterId`, in the order they are in; the same trip where `afterId` is one of them or no day. */
export function moveDaysAfter(trip: Trip, ids: readonly string[], afterId: string): Trip {
  if (ids.includes(afterId) || !trip.days.some((d) => d.id === afterId)) return trip;
  const moved = trip.days.filter((d) => ids.includes(d.id));
  const rest = trip.days.filter((d) => !ids.includes(d.id));
  const days = rest.toSpliced(rest.findIndex((d) => d.id === afterId) + 1, 0, ...moved);
  return days.every((d, i) => d === trip.days[i]) ? trip : { ...trip, days };
}

/**
 * Adds copied days, each and all it holds under new ids, right after the day `afterId` or
 * at the trip's end; in a collection they are sections, which have no date.
 */
export function pasteDays(trip: Trip, days: readonly Day[], afterId: string | undefined, newId: () => string): Trip {
  if (days.length === 0) return trip;
  const copies = days.map((day) => ({ ...withNewPartIds(day, newId).day, id: newId(), date: trip.kind === 'collection' ? null : day.date }));
  const at = trip.days.findIndex((d) => d.id === afterId);
  return { ...trip, days: trip.days.toSpliced(at < 0 ? trip.days.length : at + 1, 0, ...copies) };
}

/** The day the stop belongs to. */
export function dayOfStop(trip: Trip, stopId: string): Day | undefined {
  return trip.days.find((d) => d.stops.some((s) => s.id === stopId));
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

