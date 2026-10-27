import type { Day, LngLat, Place, Profile, Route, Stop, Trip } from '../model/trip';
import { withPrunedLegs } from './routeEdit';

/**
 * Pure edits of a trip's days: stops with their places, and the routes between
 * consecutive stops, which always start and end at the stops' positions.
 */

/** A route from one position to another with no points between, routed with the profile. */
function newRoute(id: () => string, from: LngLat, to: LngLat, profile: Profile): Route {
  return { id: id(), name: '', kind: 'routed', profile, optional: false, points: [{ id: id(), lngLat: from }, { id: id(), lngLat: to }], legs: {} };
}

function newPlace(id: () => string, name: string, lngLat: LngLat): Place {
  return { id: id(), name, kind: 'other', lngLat, address: '', contact: '', bookingReference: '', notes: '' };
}

function newStop(id: () => string, placeId: string): Stop {
  return { id: id(), placeId, role: 'visit', arriveAt: null, pauseMinutes: null, optional: false, notes: '' };
}

const positions = (places: readonly Place[]): Map<string, LngLat> => new Map(places.map((p) => [p.id, p.lngLat]));

/** The day with every route's first and last point at the positions of its stops, legs pruned where that moved them. */
export function alignRouteEnds(day: Day, places: readonly Place[]): Day {
  const at = positions(places);
  const routes = day.routes.map((route, i) => {
    const from = at.get(day.stops[i]!.placeId)!;
    const to = at.get(day.stops[i + 1]!.placeId)!;
    const first = route.points[0]!;
    const last = route.points.at(-1)!;
    if (first.lngLat === from && last.lngLat === to) return route;
    const points = [...route.points];
    points[0] = { ...first, lngLat: from };
    points[points.length - 1] = { ...last, lngLat: to };
    return withPrunedLegs({ ...route, points });
  });
  return routes.every((r, i) => r === day.routes[i]) ? day : { ...day, routes };
}

function updateDay(trip: Trip, dayId: string, change: (day: Day) => Day): Trip {
  const days = trip.days.map((day) => (day.id === dayId ? change(day) : day));
  return days.every((d, i) => d === trip.days[i]) ? trip : { ...trip, days };
}

/** The profile a new route of the day takes: that of the day's last route, or the road profile. */
export function dayProfile(day: Day): Profile {
  return day.routes.at(-1)?.profile ?? 'car';
}

/** Adds a stop at a new place at the end of the day, routed from the stop before. */
export function appendStop(trip: Trip, dayId: string, lngLat: LngLat, id: () => string): Trip {
  const place = newPlace(id, `Stop ${trip.places.length + 1}`, lngLat);
  const stop = newStop(id, place.id);
  const withPlace = { ...trip, places: [...trip.places, place] };
  return updateDay(withPlace, dayId, (day) => {
    const last = day.stops.at(-1);
    const from = last && positions(withPlace.places).get(last.placeId)!;
    return {
      ...day,
      stops: [...day.stops, stop],
      routes: from ? [...day.routes, newRoute(id, from, lngLat, dayProfile(day))] : day.routes,
    };
  });
}

/**
 * Adds a stop at a new place on a route of the day, splitting the route at its leg
 * `legIndex` (the leg from point `legIndex` to the next): the points before stay with the
 * first half, the points after go to the second.
 */
export function insertStop(trip: Trip, dayId: string, routeIndex: number, legIndex: number, lngLat: LngLat, id: () => string): Trip {
  const place = newPlace(id, `Stop ${trip.places.length + 1}`, lngLat);
  const stop = newStop(id, place.id);
  const withPlace = { ...trip, places: [...trip.places, place] };
  return updateDay(withPlace, dayId, (day) => {
    const route = day.routes[routeIndex]!;
    const after = route.points[legIndex + 1]!;
    const end = { id: id(), lngLat, ...(after.straight && { straight: true }) };
    const first = withPrunedLegs({ ...route, points: [...route.points.slice(0, legIndex + 1), end] });
    const second = withPrunedLegs({ ...route, id: id(), points: [{ id: id(), lngLat }, ...route.points.slice(legIndex + 1)] });
    return {
      ...day,
      stops: [...day.stops.slice(0, routeIndex + 1), stop, ...day.stops.slice(routeIndex + 1)],
      routes: [...day.routes.slice(0, routeIndex), first, second, ...day.routes.slice(routeIndex + 1)],
    };
  });
}

/**
 * Removes a stop from the day. The routes on both sides become one, running from the stop
 * before to the stop after and keeping their points but not the removed stop's position; at
 * the day's ends the route to or from the stop goes. The place stays with the trip.
 */
export function removeStop(trip: Trip, dayId: string, stopId: string): Trip {
  return updateDay(trip, dayId, (day) => {
    const index = day.stops.findIndex((s) => s.id === stopId);
    if (index < 0) return day;
    const stops = day.stops.filter((s) => s.id !== stopId);
    const routes = [...day.routes];
    if (index === 0) routes.splice(0, 1);
    else if (index === day.stops.length - 1) routes.splice(index - 1, 1);
    else {
      const [before, after] = [routes[index - 1]!, routes[index]!];
      const merged = withPrunedLegs({ ...before, points: [...before.points.slice(0, -1), ...after.points.slice(1)], legs: { ...before.legs, ...after.legs } });
      routes.splice(index - 1, 2, merged);
    }
    return { ...day, stops, routes };
  });
}

/** Moves a place; the routes that start or end there follow, their legs to and from it dropped. */
export function movePlace(trip: Trip, placeId: string, lngLat: LngLat): Trip {
  const places = trip.places.map((p) => (p.id === placeId ? { ...p, lngLat } : p));
  const moved = { ...trip, places };
  return { ...moved, days: moved.days.map((day) => alignRouteEnds(day, places)) };
}

export function renamePlace(trip: Trip, placeId: string, name: string): Trip {
  return { ...trip, places: trip.places.map((p) => (p.id === placeId ? { ...p, name } : p)) };
}

/** The day a route belongs to. */
export function dayOfRoute(trip: Trip, routeId: string): Day | undefined {
  return trip.days.find((day) => day.routes.some((r) => r.id === routeId));
}

/** Applies a route edit to the route, wherever in the trip it is. */
export function updateRoute(trip: Trip, routeId: string, change: (route: Route) => Route): Trip {
  const day = dayOfRoute(trip, routeId);
  if (!day) return trip;
  return updateDay(trip, day.id, (d) => {
    const routes = d.routes.map((r) => (r.id === routeId ? change(r) : r));
    return routes.every((r, i) => r === d.routes[i]) ? d : { ...d, routes };
  });
}

export function setDayProfile(trip: Trip, dayId: string, profile: Profile): Trip {
  return updateDay(trip, dayId, (day) =>
    day.routes.every((r) => r.profile === profile) ? day : { ...day, routes: day.routes.map((r) => (r.profile === profile ? r : withPrunedLegs({ ...r, profile }))) },
  );
}

/** Drops every routed leg of the day so that they are routed again. */
export function clearDayLegs(trip: Trip, dayId: string): Trip {
  return updateDay(trip, dayId, (day) =>
    day.routes.every((r) => Object.keys(r.legs).length === 0) ? day : { ...day, routes: day.routes.map((r) => ({ ...r, legs: {} })) },
  );
}

export function addDay(trip: Trip, id: () => string): Trip {
  return { ...trip, days: [...trip.days, { id: id(), name: '', date: null, notes: '', stops: [], routes: [] }] };
}

/** Removes a day with its stops and routes; the places stay with the trip. */
export function removeDay(trip: Trip, dayId: string): Trip {
  return { ...trip, days: trip.days.filter((d) => d.id !== dayId) };
}

export function renameDay(trip: Trip, dayId: string, name: string): Trip {
  return updateDay(trip, dayId, (day) => ({ ...day, name }));
}
