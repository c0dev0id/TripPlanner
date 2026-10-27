import { describe, expect, it } from 'vitest';
import type { Day, RoutedLeg, Trip } from '../model/trip';
import { addFreeStop, addRoute, alignStops, connectStop, convertPoint, disconnectStop, insertStop, moveStop, removeRoute, removeStop, setRouteProfile, updateRoute, updateStop } from './dayEdit';
import { routeLegs } from './legs';
import * as routeEdit from './routeEdit';

const routed = (geometry: string): RoutedLeg => ({ geometry, distanceM: 1000, durationS: 60 });

const empty = (): Trip => ({ id: 1, name: 'T', description: '', startsOn: null, version: 1, days: [{ id: 'd', name: '', date: null, notes: '', routes: [], stops: [] }] });

const day = (trip: Trip): Day => trip.days[0]!;

/** A day with one routed route of three points, a stop bound to the middle one, and a free stop. */
function fixture(): Trip {
  let trip = addRoute(empty(), 'd', 'r');
  for (const [id, lngLat] of [['a', [1, 1]], ['b', [2, 2]], ['c', [3, 3]]] as const) {
    trip = updateRoute(trip, 'r', (r) => routeEdit.appendPoint(r, { id, lngLat: [...lngLat] }));
  }
  const route = day(trip).routes[0]!;
  const legs = Object.fromEntries(routeLegs(route).map((l) => [l.key, routed(l.key)]));
  trip = { ...trip, days: [{ ...day(trip), routes: [{ ...route, legs }] }] };
  trip = convertPoint(trip, 'd', 'b', 's1');
  return addFreeStop(trip, 'd', [2.5, 2.4], 's2');
}

describe('routes and points', () => {
  it('adds a route with the day profile and points at its end', () => {
    const trip = fixture();
    expect(day(trip).routes[0]!.points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    const bike = setRouteProfile(trip, 'r', 'bike');
    const two = addRoute(bike, 'd', 'r2');
    expect(day(two).routes[1]!.profile).toBe('bike');
    expect(day(bike).routes[0]!.legs).toEqual({});
  });

  it('moves a bound stop with its point', () => {
    const trip = updateRoute(fixture(), 'r', (r) => routeEdit.movePoint(r, 'b', [2.1, 2.1]));
    expect(day(trip).stops[0]!.lngLat).toEqual([2.1, 2.1]);
    expect(day(trip).routes[0]!.legs).toEqual({});
  });

  it('frees a stop whose point is removed, where it stood', () => {
    const trip = updateRoute(fixture(), 'r', (r) => routeEdit.removePoint(r, 'b'));
    expect(day(trip).routes[0]!.points.map((p) => p.id)).toEqual(['a', 'c']);
    expect(day(trip).stops[0]).toMatchObject({ pointId: null, lngLat: [2, 2] });
  });

  it('frees the stops of a removed route', () => {
    const trip = removeRoute(fixture(), 'd', 'r');
    expect(day(trip).routes).toEqual([]);
    expect(day(trip).stops.map((s) => s.pointId)).toEqual([null, null]);
  });

  it('inserts a point without touching the stops', () => {
    const trip = updateRoute(fixture(), 'r', (r) => routeEdit.insertPoint(r, 1, { id: 'x', lngLat: [1.5, 1.5] }));
    expect(day(trip).routes[0]!.points.map((p) => p.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(day(trip).stops[0]!.pointId).toBe('b');
  });

  it('leaves a route of another trip part alone', () => {
    const trip = fixture();
    expect(updateRoute(trip, 'nope', (r) => routeEdit.removePoint(r, 'b'))).toBe(trip);
  });
});

describe('stops', () => {
  it('inserts a stop on the line as a bound stop', () => {
    const trip = insertStop(fixture(), 'd', 'r', 1, [1.5, 1.5], 'x', 's3');
    expect(day(trip).routes[0]!.points.map((p) => p.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(day(trip).stops[2]).toMatchObject({ id: 's3', pointId: 'x', lngLat: [1.5, 1.5] });
  });

  it('converts a point once', () => {
    const trip = fixture();
    expect(day(trip).stops[0]).toMatchObject({ id: 's1', name: 'Stop 1', kind: 'other', lngLat: [2, 2], pointId: 'b' });
    expect(convertPoint(trip, 'd', 'b', 's9')).toBe(trip);
    expect(convertPoint(trip, 'd', 'nowhere', 's9')).toBe(trip);
  });

  it('connects a free stop by a new point at its position', () => {
    const trip = connectStop(fixture(), 'd', 's2', 'r', 2, 'p');
    expect(day(trip).routes[0]!.points.map((p) => [p.id, p.lngLat])).toEqual([
      ['a', [1, 1]],
      ['b', [2, 2]],
      ['p', [2.5, 2.4]],
      ['c', [3, 3]],
    ]);
    expect(day(trip).stops[1]!.pointId).toBe('p');
    expect(Object.keys(day(trip).routes[0]!.legs)).toEqual(['car/1,1;2,2']);
    expect(connectStop(trip, 'd', 's2', 'r', 2, 'q')).toBe(trip);
  });

  it('disconnects a bound stop, which stays where it was', () => {
    const trip = disconnectStop(fixture(), 'd', 's1');
    expect(day(trip).routes[0]!.points.map((p) => p.id)).toEqual(['a', 'c']);
    expect(day(trip).stops[0]).toMatchObject({ pointId: null, lngLat: [2, 2] });
    expect(disconnectStop(trip, 'd', 's1')).toBe(trip);
  });

  it('moves a bound stop through its point and a free stop on its own', () => {
    const bound = moveStop(fixture(), 'd', 's1', [2.2, 2.2]);
    expect(day(bound).routes[0]!.points[1]!.lngLat).toEqual([2.2, 2.2]);
    expect(day(bound).stops[0]!.lngLat).toEqual([2.2, 2.2]);
    const free = moveStop(fixture(), 'd', 's2', [5, 5]);
    expect(day(free).stops[1]!.lngLat).toEqual([5, 5]);
    expect(day(free).routes[0]!.points[1]!.lngLat).toEqual([2, 2]);
  });

  it('removes a stop and leaves its point', () => {
    const trip = removeStop(fixture(), 'd', 's1');
    expect(day(trip).stops.map((s) => s.id)).toEqual(['s2']);
    expect(day(trip).routes[0]!.points).toHaveLength(3);
  });

  it('updates what a stop says and returns the same trip for no change', () => {
    const trip = updateStop(fixture(), 'd', 's1', { name: 'Lunch', kind: 'restaurant' });
    expect(day(trip).stops[0]).toMatchObject({ name: 'Lunch', kind: 'restaurant' });
    expect(updateStop(trip, 'd', 's1', { name: 'Lunch' })).toBe(trip);
  });

  it('aligns stops to their points and returns the same day when aligned', () => {
    const aligned = day(fixture());
    expect(alignStops(aligned)).toBe(aligned);
    const moved = { ...aligned, stops: aligned.stops.map((s) => (s.id === 's1' ? { ...s, lngLat: [9, 9] as [number, number] } : s)) };
    expect(alignStops(moved).stops[0]!.lngLat).toEqual([2, 2]);
  });
});
