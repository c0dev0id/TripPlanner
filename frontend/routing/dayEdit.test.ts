import { describe, expect, it } from 'vitest';
import type { RoutedLeg, Trip } from '../model/trip';
import { addDay, alignRouteEnds, appendStop, clearDayLegs, insertStop, movePlace, removeDay, removeStop, setDayProfile } from './dayEdit';
import { routeLegs } from './legs';
import { setStraight } from './routeEdit';

const routed = (geometry: string): RoutedLeg => ({ geometry, distanceM: 1, durationS: 1 });

/** Ids in order: id1, id2, … */
const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

const empty = (): Trip => ({ id: 1, name: 'T', description: '', startsOn: null, version: 1, places: [], days: [{ id: 'd', name: '', date: null, notes: '', stops: [], routes: [] }] });

/** A day of three stops with the routes between them routed. */
function threeStops(): Trip {
  const id = ids();
  let trip = appendStop(empty(), 'd', [1, 1], id);
  trip = appendStop(trip, 'd', [2, 2], id);
  trip = appendStop(trip, 'd', [3, 3], id);
  const day = trip.days[0]!;
  const routes = day.routes.map((r) => ({ ...r, legs: Object.fromEntries(routeLegs(r).map((l) => [l.key, routed(l.key)])) }));
  return { ...trip, days: [{ ...day, routes }] };
}

describe('appendStop', () => {
  it('adds a place, a stop and a route from the stop before', () => {
    const id = ids();
    const one = appendStop(empty(), 'd', [1, 1], id);
    expect(one.places).toEqual([{ id: 'id1', name: 'Stop 1', kind: 'other', lngLat: [1, 1], address: '', contact: '', bookingReference: '', notes: '' }]);
    expect(one.days[0]!.stops.map((s) => s.placeId)).toEqual(['id1']);
    expect(one.days[0]!.routes).toEqual([]);
    const two = appendStop(one, 'd', [2, 2], id);
    expect(two.days[0]!.stops.map((s) => s.placeId)).toEqual(['id1', 'id3']);
    expect(two.days[0]!.routes).toHaveLength(1);
    expect(two.days[0]!.routes[0]!.points.map((p) => p.lngLat)).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(two.days[0]!.routes[0]!.profile).toBe('car');
  });

  it('takes the profile of the day', () => {
    const bike = setDayProfile(threeStops(), 'd', 'bike');
    const more = appendStop(bike, 'd', [4, 4], ids());
    expect(more.days[0]!.routes.map((r) => r.profile)).toEqual(['bike', 'bike', 'bike']);
    expect(more.days[0]!.routes.map((r) => Object.keys(r.legs).length)).toEqual([0, 0, 0]);
  });
});

describe('insertStop', () => {
  it('splits the route at the leg, the points staying with their halves', () => {
    const trip = threeStops();
    const day = trip.days[0]!;
    // Shape the first route with two points: 1,1 -> 1.2,1.2 -> 1.5,1.5 -> 2,2.
    const shaped = { ...day.routes[0]!, points: [day.routes[0]!.points[0]!, { id: 'p1', lngLat: [1.2, 1.2] as [number, number] }, { id: 'p2', lngLat: [1.5, 1.5] as [number, number] }, day.routes[0]!.points[1]!] };
    const withShape = { ...trip, days: [{ ...day, routes: [shaped, day.routes[1]!] }] };
    const split = insertStop(withShape, 'd', 0, 1, [1.3, 1.3], ids());
    const result = split.days[0]!;
    expect(result.stops.map((s) => s.placeId)).toEqual(['id1', 'id1', 'id3', 'id5'].map((_, i) => result.stops[i]!.placeId));
    expect(result.stops).toHaveLength(4);
    expect(result.routes).toHaveLength(3);
    expect(result.routes[0]!.points.map((p) => p.lngLat)).toEqual([
      [1, 1],
      [1.2, 1.2],
      [1.3, 1.3],
    ]);
    expect(result.routes[1]!.points.map((p) => p.lngLat)).toEqual([
      [1.3, 1.3],
      [1.5, 1.5],
      [2, 2],
    ]);
    expect(result.routes[2]).toBe(day.routes[1]);
    expect(split.places.at(-1)!.lngLat).toEqual([1.3, 1.3]);
  });

  it('keeps a straight leg straight on both sides of the new stop', () => {
    const trip = threeStops();
    const straight = { ...trip, days: [{ ...trip.days[0]!, routes: trip.days[0]!.routes.map((r, i) => (i === 0 ? setStraight(r, r.points[1]!.id, true) : r)) }] };
    const split = insertStop(straight, 'd', 0, 0, [1.5, 1.5], ids());
    expect(split.days[0]!.routes[0]!.points[1]!.straight).toBe(true);
    expect(split.days[0]!.routes[1]!.points[1]!.straight).toBe(true);
  });
});

describe('removeStop', () => {
  it('joins the routes around a middle stop without its position', () => {
    const trip = threeStops();
    const middle = trip.days[0]!.stops[1]!;
    const result = removeStop(trip, 'd', middle.id).days[0]!;
    expect(result.stops).toHaveLength(2);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]!.points.map((p) => p.lngLat)).toEqual([
      [1, 1],
      [3, 3],
    ]);
    expect(result.routes[0]!.legs).toEqual({});
  });

  it('drops the route at the end of the day', () => {
    const trip = threeStops();
    const first = removeStop(trip, 'd', trip.days[0]!.stops[0]!.id).days[0]!;
    expect(first.routes).toHaveLength(1);
    expect(first.routes[0]!.points[0]!.lngLat).toEqual([2, 2]);
    const last = removeStop(trip, 'd', trip.days[0]!.stops[2]!.id).days[0]!;
    expect(last.routes[0]!.points.at(-1)!.lngLat).toEqual([2, 2]);
    expect(Object.keys(last.routes[0]!.legs)).toHaveLength(1);
  });

  it('keeps the place', () => {
    const trip = threeStops();
    expect(removeStop(trip, 'd', trip.days[0]!.stops[1]!.id).places).toHaveLength(3);
  });
});

describe('movePlace', () => {
  it('moves the route ends at the place and drops their legs', () => {
    const trip = threeStops();
    const moved = movePlace(trip, trip.places[1]!.id, [2.5, 2.5]);
    const routes = moved.days[0]!.routes;
    expect(routes[0]!.points.at(-1)!.lngLat).toEqual([2.5, 2.5]);
    expect(routes[1]!.points[0]!.lngLat).toEqual([2.5, 2.5]);
    expect(routes.map((r) => Object.keys(r.legs).length)).toEqual([0, 0]);
  });

  it('leaves days that do not use the place untouched', () => {
    const trip = addDay(threeStops(), ids());
    const other = trip.days[1];
    expect(movePlace(trip, trip.places[0]!.id, [0, 0]).days[1]).toBe(other);
  });
});

describe('alignRouteEnds', () => {
  it('returns the same day when nothing moved', () => {
    const trip = threeStops();
    expect(alignRouteEnds(trip.days[0]!, trip.places)).toBe(trip.days[0]);
  });
});

describe('days', () => {
  it('adds and removes days, keeping the places', () => {
    const trip = addDay(threeStops(), ids());
    expect(trip.days).toHaveLength(2);
    const removed = removeDay(trip, 'd');
    expect(removed.days.map((d) => d.id)).toEqual(['id1']);
    expect(removed.places).toHaveLength(3);
  });

  it('clears the legs of a day as one change', () => {
    const trip = threeStops();
    const cleared = clearDayLegs(trip, 'd');
    expect(cleared.days[0]!.routes.map((r) => r.legs)).toEqual([{}, {}]);
    expect(clearDayLegs(cleared, 'd')).toBe(cleared);
  });
});
