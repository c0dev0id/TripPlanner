import { describe, expect, it } from 'vitest';
import { withChanges, type Day, type RoutedLeg, type Trip } from '../model/trip';
import { addDay, addFreeStop, addParts, addRoute, alignStops, connectStop, convertPoint, copiedRoute, disconnectStop, duplicateDay, duplicateRoute, insertStop, moveDay, moveRoute, moveRouteToDay, moveStop, pasteIntoTrip, pasteRoute, pasteStop, removeRoute, removeStop, routedOnly, updateDay, updateRoute, updateStop } from './dayEdit';
import { changeSettings } from './routeEdit';
import { pointCount, routedLegs } from './legs';
import { encodePolyline } from './polyline';
import { routedOf } from './testing';
import * as routeEdit from './routeEdit';

const routed = (geometry: string): RoutedLeg => ({ geometry, distanceM: 1000, durationS: 60 });

const empty = (): Trip => ({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [{ id: 'd', name: '', date: null, notes: '', routes: [], stops: [] }] });

const day = (trip: Trip): Day => trip.days[0]!;

/** The first day of the trip, dated. */
const dateDay = (trip: Trip, date: string): Trip => updateDay(trip, 'd', (d) => withChanges(d, { date }));

/** A day with one routed route of three points, a stop bound to the middle one, and a free stop. */
function fixture(): Trip {
  let trip = addRoute(empty(), 'd', 'r');
  for (const [id, lngLat] of [['a', [1, 1]], ['b', [2, 2]], ['c', [3, 3]]] as const) {
    trip = updateRoute(trip, 'r', routedOnly((r) => routeEdit.appendPoint(r, { id, lngLat: [...lngLat] })));
  }
  const route = routedOf(day(trip).routes[0]!);
  const legs = Object.fromEntries(routedLegs(route).map((l) => [l.key, routed(l.key)]));
  trip = { ...trip, days: [{ ...day(trip), routes: [{ ...route, legs }] }] };
  trip = convertPoint(trip, 'd', 'b', 's1');
  return addFreeStop(trip, 'd', [2.5, 2.4], 's2');
}

describe('routes and points', () => {
  it('adds a route with the day profile and points at its end', () => {
    const trip = fixture();
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    const bike = updateRoute(trip, 'r', (r) => changeSettings(r, { profile: 'bicycle' }));
    const two = addRoute(bike, 'd', 'r2');
    expect(day(two).routes[1]!.profile).toBe('bicycle');
    expect(routedOf(day(bike).routes[0]!).legs).toEqual({});
  });

  it('moves a bound stop with its point', () => {
    const trip = updateRoute(fixture(), 'r', routedOnly((r) => routeEdit.movePoint(r, 'b', [2.1, 2.1])));
    expect(day(trip).stops[0]!.lngLat).toEqual([2.1, 2.1]);
    expect(routedOf(day(trip).routes[0]!).legs).toEqual({});
  });

  it('frees a stop whose point is removed, where it stood', () => {
    const trip = updateRoute(fixture(), 'r', routedOnly((r) => routeEdit.removePoint(r, 'b')));
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'c']);
    expect(day(trip).stops[0]).toMatchObject({ pointId: null, lngLat: [2, 2] });
  });

  it('frees the stops of a removed route', () => {
    const trip = removeRoute(fixture(), 'd', 'r');
    expect(day(trip).routes).toEqual([]);
    expect(day(trip).stops.map((s) => s.pointId)).toEqual([null, null]);
  });

  it('inserts a point without touching the stops', () => {
    const trip = updateRoute(fixture(), 'r', routedOnly((r) => routeEdit.insertPoint(r, 1, { id: 'x', lngLat: [1.5, 1.5] })));
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(day(trip).stops[0]!.pointId).toBe('b');
  });

  it('leaves a route of another trip part alone', () => {
    const trip = fixture();
    expect(updateRoute(trip, 'nope', routedOnly((r) => routeEdit.removePoint(r, 'b')))).toBe(trip);
  });
});

describe('stops', () => {
  it('inserts a stop on the line as a bound stop', () => {
    const trip = insertStop(fixture(), 'd', 'r', 1, [1.5, 1.5], 'x', 's3');
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(day(trip).stops[2]).toMatchObject({ id: 's3', pointId: 'x', lngLat: [1.5, 1.5] });
  });

  it('inserts a stop on a track as a free stop where it was asked for', () => {
    const track = { id: 't', name: '', kind: 'track' as const, profile: 'motorcycle' as const, optional: false, line: encodePolyline([[1, 1], [2, 2]]) };
    const trip = insertStop(addParts(fixture(), 'd', { routes: [track], stops: [] }), 'd', 't', 1, [1.5, 1.5], 'x', 's3');
    expect(day(trip).routes[1]).toEqual(track);
    expect(day(trip).stops[2]).toMatchObject({ id: 's3', pointId: null, lngLat: [1.5, 1.5] });
  });

  it('converts a point once', () => {
    const trip = fixture();
    expect(day(trip).stops[0]).toMatchObject({ id: 's1', name: 'Stop 1', symbol: 'Pin, Blue', lngLat: [2, 2], pointId: 'b' });
    expect(convertPoint(trip, 'd', 'b', 's9')).toBe(trip);
    expect(convertPoint(trip, 'd', 'nowhere', 's9')).toBe(trip);
  });

  it('connects a free stop by a new point at its position', () => {
    const trip = connectStop(fixture(), 'd', 's2', 'r', 2, 'p');
    expect(routedOf(day(trip).routes[0]!).points.map((p) => [p.id, p.lngLat])).toEqual([
      ['a', [1, 1]],
      ['b', [2, 2]],
      ['p', [2.5, 2.4]],
      ['c', [3, 3]],
    ]);
    expect(day(trip).stops[1]!.pointId).toBe('p');
    expect(Object.keys(routedOf(day(trip).routes[0]!).legs)).toEqual(['motorcycle:allow/1,1;2,2']);
    expect(connectStop(trip, 'd', 's2', 'r', 2, 'q')).toBe(trip);
  });

  it('disconnects a bound stop, which stays where it was', () => {
    const trip = disconnectStop(fixture(), 'd', 's1');
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'c']);
    expect(day(trip).stops[0]).toMatchObject({ pointId: null, lngLat: [2, 2] });
    expect(disconnectStop(trip, 'd', 's1')).toBe(trip);
  });

  it('moves a bound stop through its point and a free stop on its own', () => {
    const bound = moveStop(fixture(), 'd', 's1', [2.2, 2.2]);
    expect(routedOf(day(bound).routes[0]!).points[1]!.lngLat).toEqual([2.2, 2.2]);
    expect(day(bound).stops[0]!.lngLat).toEqual([2.2, 2.2]);
    const free = moveStop(fixture(), 'd', 's2', [5, 5]);
    expect(day(free).stops[1]!.lngLat).toEqual([5, 5]);
    expect(routedOf(day(free).routes[0]!).points[1]!.lngLat).toEqual([2, 2]);
  });

  it('removes a stop and leaves its point', () => {
    const trip = removeStop(fixture(), 'd', 's1');
    expect(day(trip).stops.map((s) => s.id)).toEqual(['s2']);
    expect(routedOf(day(trip).routes[0]!).points).toHaveLength(3);
  });

  it('updates what a stop says and returns the same trip for no change', () => {
    const trip = updateStop(fixture(), 'd', 's1', { name: 'Lunch', symbol: 'Restaurant' });
    expect(day(trip).stops[0]).toMatchObject({ name: 'Lunch', symbol: 'Restaurant' });
    expect(updateStop(trip, 'd', 's1', { name: 'Lunch' })).toBe(trip);
  });

  it('aligns stops to their points and returns the same day when aligned', () => {
    const aligned = day(fixture());
    expect(alignStops(aligned)).toBe(aligned);
    const moved = { ...aligned, stops: aligned.stops.map((s) => (s.id === 's1' ? { ...s, lngLat: [9, 9] as [number, number] } : s)) };
    expect(alignStops(moved).stops[0]!.lngLat).toEqual([2, 2]);
  });
});

describe('days', () => {
  it('dates a new day after the last dated one', () => {
    expect(addDay(empty(), 'e').days[1]!.date).toBeNull();
    const dated = dateDay(empty(), '2027-12-31');
    expect(addDay(dated, 'e').days[1]!.date).toBe('2028-01-01');
    expect(dateDay(dated, '2027-12-31')).toBe(dated);
  });
});

describe('reordering and copying', () => {
  const ids = (prefix: string) => {
    let n = 0;
    return () => `${prefix}${++n}`;
  };
  const twoDays = (): Trip => addDay(dateDay(fixture(), '2027-06-12'), 'e');

  it('moves a day to another place, within the ends', () => {
    const trip = addDay(twoDays(), 'f');
    expect(moveDay(trip, 'f', 0).days.map((d) => d.id)).toEqual(['f', 'd', 'e']);
    expect(moveDay(trip, 'd', 2).days.map((d) => d.id)).toEqual(['e', 'f', 'd']);
    expect(moveDay(trip, 'd', 9).days.map((d) => d.id)).toEqual(['e', 'f', 'd']);
    expect(moveDay(trip, 'e', 1)).toBe(trip);
  });

  it('duplicates a day with new ids, the bound stop following its point', () => {
    const trip = duplicateDay(twoDays(), 'd', 'copy', ids('n'));
    expect(trip.days.map((d) => d.id)).toEqual(['d', 'copy', 'e']);
    const copy = trip.days[1]!;
    expect(copy.date).toBeNull();
    expect(copy.routes[0]!.id).toBe('n1');
    expect(routedOf(copy.routes[0]!).points.map((p) => p.id)).toEqual(['n2', 'n3', 'n4']);
    expect(routedOf(copy.routes[0]!).legs).toEqual(routedOf(day(trip).routes[0]!).legs);
    expect(copy.stops.map((s) => [s.id, s.pointId])).toEqual([
      ['n5', 'n3'],
      ['n6', null],
    ]);
  });

  it('moves and duplicates a route within its day', () => {
    const two = addRoute(fixture(), 'd', 'r2');
    expect(day(moveRoute(two, 'r2', 0)).routes.map((r) => r.id)).toEqual(['r2', 'r']);
    expect(moveRoute(two, 'r2', 1)).toBe(two);
    const copied = duplicateRoute({ ...two, days: [{ ...day(two), routes: [{ ...day(two).routes[0]!, name: 'Loop' }, day(two).routes[1]!] }] }, 'r', ids('c'));
    expect(day(copied).routes.map((r) => [r.id, r.name, pointCount(r)])).toEqual([
      ['r', 'Loop', 3],
      ['c1', 'Loop copy', 3],
      ['r2', '', 0],
    ]);
    expect(day(copied).stops[0]!.pointId).toBe('b');
  });

  it('moves a route to another day with its bound stops', () => {
    const trip = moveRouteToDay(twoDays(), 'r', 'e');
    expect(day(trip).routes).toEqual([]);
    expect(day(trip).stops.map((s) => s.id)).toEqual(['s2']);
    expect(trip.days[1]!.routes.map((r) => r.id)).toEqual(['r']);
    expect(trip.days[1]!.stops.map((s) => [s.id, s.pointId])).toEqual([['s1', 'b']]);
    const same = twoDays();
    expect(moveRouteToDay(same, 'r', 'd')).toBe(same);
  });

  it('pastes a stop into a day as a free stop', () => {
    const trip = pasteStop(twoDays(), 'e', day(twoDays()).stops[0]!, 'c');
    expect(trip.days[1]!.stops).toEqual([{ ...day(trip).stops[0]!, id: 'c', pointId: null }]);
  });

  it('pastes a copied route with its bound stops under new ids, the stops bound to the new points', () => {
    const copied = copiedRoute(day(twoDays()), day(twoDays()).routes[0]!);
    expect(copied.stops.map((s) => s.id)).toEqual(['s1']);
    const trip = pasteRoute(twoDays(), 'e', copied, ids('p'));
    const pasted = routedOf(trip.days[1]!.routes[0]!);
    expect([pasted.id, pasted.points.map((p) => p.id), pasted.legs]).toEqual(['p1', ['p2', 'p3', 'p4'], routedOf(day(trip).routes[0]!).legs]);
    expect(trip.days[1]!.stops.map((s) => [s.id, s.name, s.pointId])).toEqual([['p5', 'Stop 1', 'p3']]);
  });

  it('pastes routes into a trip onto the day of their date, a new day of that date among the others, or a new day at the end', () => {
    const copied = copiedRoute(day(twoDays()), day(twoDays()).routes[0]!);
    const from = (date: string | null, name: string) => ({ ...copied, from: { date, name } });
    const trip = pasteIntoTrip(addDay(twoDays(), 'f'), [from('2027-06-13', 'North'), from('2027-06-01', 'Early'), from(null, 'Loose')], ids('p'));
    expect(trip.days.map((d) => [d.date, d.name, d.routes.length])).toEqual([
      ['2027-06-01', 'Early', 1],
      ['2027-06-12', '', 1],
      ['2027-06-13', '', 1],
      ['2027-06-14', '', 0],
      [null, 'Loose', 1],
    ]);
    expect(trip.days[2]!.stops.map((s) => s.pointId)).toEqual([routedOf(trip.days[2]!.routes[0]!).points[1]!.id]);
  });

  it('pastes routes into a collection as a new section each, named after the route', () => {
    const collection: Trip = { ...twoDays(), kind: 'collection' };
    const copied = copiedRoute(day(collection), withChanges(day(collection).routes[0]!, { name: 'Pass' }));
    const pasted = pasteIntoTrip(collection, [{ ...copied, from: { date: '2027-06-12', name: 'Alps' } }, { ...copied, route: withChanges(copied.route, { name: '' }), from: { date: null, name: 'Alps' } }], ids('p'));
    expect(pasted.days.slice(2).map((d) => [d.date, d.name, d.routes.length])).toEqual([
      [null, 'Pass', 1],
      [null, 'Alps', 1],
    ]);
  });
});

describe('addParts', () => {
  it('appends routes and stops to the day and leaves an empty import alone', () => {
    const trip = fixture();
    expect(addParts(trip, 'd', { routes: [], stops: [] })).toBe(trip);
    const route = { ...day(trip).routes[0]!, id: 'imported', points: [] };
    const stop = { ...day(trip).stops[1]!, id: 'w' };
    const added = addParts(trip, 'd', { routes: [route], stops: [stop] });
    expect(day(added).routes.map((r) => r.id)).toEqual(['r', 'imported']);
    expect(day(added).stops.map((s) => s.id)).toEqual(['s1', 's2', 'w']);
  });
});
