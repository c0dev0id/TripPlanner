import { describe, expect, it } from 'vitest';
import { withChanges, type Day, type RoutedLeg, type Trip } from '../model/trip';
import { addDay, addParts, addStop, addRoute, alignStops, connectStop, convertPoint, copiedRoute, disconnectStop, duplicateDay, duplicateRoute, insertStop, duplicateParts, moveDay, moveDaysAfter, moveRoute, moveRouteToDay, moveStop, moveStopIntoRoute, moveStopToDay, numberedStops, pasteDays, pasteIntoTrip, pasteRoute, pasteStops, pasteStopsIntoRoute, removeParts, removeRoute, removeStop, routedOnly, routeFromStops, updateDay, updateRoute, updateStop, withNewPartIds } from './dayEdit';
import { changeSettings } from './routeEdit';
import { pointCount, routedLegs } from './legs';
import { encodePolyline } from './polyline';
import { routedOf } from './testing';
import * as routeEdit from './routeEdit';

const routed = (geometry: string): RoutedLeg => ({ geometry, distanceM: 1000, durationS: 60 });

const empty = (): Trip => ({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [{ id: 'd', name: '', date: null, notes: '', routes: [], stops: [] }] });

const day = (trip: Trip): Day => trip.days[0]!;

/** Ids of the prefix numbered from 1, in the order asked for. */
const ids = (prefix: string) => {
  let n = 0;
  return () => `${prefix}${++n}`;
};

/** The first day of the trip, dated. */
const dateDay = (trip: Trip, date: string): Trip => updateDay(trip, 'd', (d) => withChanges(d, { date }));

/** A day with one routed route of three points, a stop bound to the middle one, and a stop beside the route. */
function fixture(): Trip {
  let trip = addRoute(empty(), 'd', 'r');
  for (const [id, lngLat] of [['a', [1, 1]], ['b', [2, 2]], ['c', [3, 3]]] as const) {
    trip = updateRoute(trip, 'r', routedOnly((r) => routeEdit.appendPoint(r, { id, lngLat: [...lngLat] })));
  }
  const route = routedOf(day(trip).routes[0]!);
  const legs = Object.fromEntries(routedLegs(route).map((l) => [l.key, routed(l.key)]));
  trip = { ...trip, days: [{ ...day(trip), routes: [{ ...route, legs }] }] };
  trip = convertPoint(trip, 'd', 'b', 's1');
  return addStop(trip, 'd', 'r', [2.5, 2.4], 's2');
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

  it('removes a route with its stops, and leaves those of another', () => {
    const other = addStop(addRoute(fixture(), 'd', 'q'), 'd', 'q', [4, 4], 's3');
    const trip = removeRoute(other, 'd', 'r');
    expect(day(trip).routes.map((r) => r.id)).toEqual(['q']);
    expect(day(trip).stops.map((s) => s.id)).toEqual(['s3']);
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

  it('inserts a stop on a track as a stop beside it where it was asked for', () => {
    const track = { id: 't', name: '', kind: 'track' as const, profile: 'motorcycle' as const, optional: false, color: null, line: encodePolyline([[1, 1], [2, 2]]) };
    const trip = insertStop(addParts(fixture(), 'd', { routes: [track], stops: [] }, ids('n')), 'd', 't', 1, [1.5, 1.5], 'x', 's3');
    expect(day(trip).routes[1]).toEqual(track);
    expect(day(trip).stops[2]).toMatchObject({ id: 's3', routeId: 't', pointId: null, lngLat: [1.5, 1.5] });
  });

  it('converts a point once', () => {
    const trip = fixture();
    expect(day(trip).stops[0]).toMatchObject({ id: 's1', name: 'Stop 1', symbol: 'Pin, Blue', lngLat: [2, 2], routeId: 'r', pointId: 'b' });
    expect(convertPoint(trip, 'd', 'b', 's9')).toBe(trip);
    expect(convertPoint(trip, 'd', 'nowhere', 's9')).toBe(trip);
  });

  it('connects a stop beside its route by a new point at its position', () => {
    const trip = connectStop(fixture(), 'd', 's2', 2, 'p');
    expect(routedOf(day(trip).routes[0]!).points.map((p) => [p.id, p.lngLat])).toEqual([
      ['a', [1, 1]],
      ['b', [2, 2]],
      ['p', [2.5, 2.4]],
      ['c', [3, 3]],
    ]);
    expect(day(trip).stops[1]!.pointId).toBe('p');
    expect(Object.keys(routedOf(day(trip).routes[0]!).legs)).toEqual(['motorcycle:allow/1,1;2,2']);
    expect(connectStop(trip, 'd', 's2', 2, 'q')).toBe(trip);
  });

  it('disconnects a bound stop, which stays where it was', () => {
    const trip = disconnectStop(fixture(), 'd', 's1');
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'c']);
    expect(day(trip).stops[0]).toMatchObject({ routeId: 'r', pointId: null, lngLat: [2, 2] });
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
    expect(day(copied).stops.map((s) => [s.id, s.routeId, s.pointId])).toEqual([
      ['s1', 'r', 'b'],
      ['s2', 'r', null],
      ['c5', 'c1', 'c3'],
      ['c6', 'c1', null],
    ]);
  });

  it('moves a route to another day with its stops', () => {
    const trip = moveRouteToDay(twoDays(), 'r', 'e');
    expect(day(trip).routes).toEqual([]);
    expect(day(trip).stops).toEqual([]);
    expect(trip.days[1]!.routes.map((r) => r.id)).toEqual(['r']);
    expect(trip.days[1]!.stops.map((s) => [s.id, s.pointId])).toEqual([['s1', 'b'], ['s2', null]]);
    const same = twoDays();
    expect(moveRouteToDay(same, 'r', 'd')).toBe(same);
  });

  it('renews the ids of a day\'s parts, names each new one, and frees a stop whose point is gone', () => {
    const source = day(fixture());
    const lost = { ...source.stops[1]!, id: 'lost', pointId: 'gone' };
    const { day: renewed, ids: made } = withNewPartIds({ ...source, stops: [...source.stops, lost] }, ids('n'));
    expect(new Set(made.keys())).toEqual(new Set(['r', 'a', 'b', 'c', 's1', 's2', 'lost']));
    expect(new Set(made.values()).size).toBe(7);
    expect(renewed.id).toBe('d');
    expect(routedOf(renewed.routes[0]!).points.map((p) => p.id)).toEqual([made.get('a'), made.get('b'), made.get('c')]);
    expect(renewed.stops.map((s) => [s.id, s.pointId])).toEqual([[made.get('s1'), made.get('b')], [made.get('s2'), null], [made.get('lost'), null]]);
  });

  it('removes several parts at once: days whole, routes with their stops, stops leaving their points', () => {
    const trip = twoDays();
    expect(removeParts(trip, 'day', ['e', 'nowhere']).days.map((d) => d.id)).toEqual(['d']);
    expect(removeParts(trip, 'day', ['nowhere'])).toBe(trip);
    const routeless = removeParts(trip, 'route', ['r']);
    expect(day(routeless).routes).toEqual([]);
    expect(day(routeless).stops).toEqual([]);
    const stopless = removeParts(trip, 'stop', ['s1', 's2']);
    expect(day(stopless).stops).toEqual([]);
    expect(routedOf(day(stopless).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('duplicates several parts, a stop as a copy beside its route after the original', () => {
    const trip = duplicateParts(twoDays(), 'stop', ['s1', 's2'], ids('n'));
    expect(day(trip).stops.map((s) => [s.id, s.pointId, s.name])).toEqual([
      ['s1', 'b', 'Stop 1'],
      ['n1', null, 'Stop 1 copy'],
      ['s2', null, 'Stop 2'],
      ['n2', null, 'Stop 2 copy'],
    ]);
    expect(duplicateParts(twoDays(), 'route', ['r'], ids('n')).days[0]!.routes.map((r) => r.id)).toEqual(['r', 'n1']);
    expect(duplicateParts(twoDays(), 'day', ['d', 'e'], ids('n')).days).toHaveLength(4);
  });

  it('moves a stop to another day, where each route takes a copy of it, and leaves it where the day has no route', () => {
    const none = twoDays();
    expect(moveStopToDay(none, 's1', 'e', ids('n'))).toBe(none);
    expect(moveStopToDay(none, 's1', 'd', ids('n'))).toBe(none);
    const trip = moveStopToDay(addRoute(addRoute(twoDays(), 'e', 'q'), 'e', 'u'), 's1', 'e', ids('n'));
    expect(routedOf(day(trip).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(day(trip).stops.map((s) => s.id)).toEqual(['s2']);
    expect(trip.days[1]!.stops.map((s) => [s.id, s.routeId, s.pointId])).toEqual([
      ['n1', 'q', null],
      ['n2', 'u', null],
    ]);
  });

  it('moves a place of a list of places to another category as it is', () => {
    const list: Trip = { ...empty(), kind: 'collection', days: [{ ...day(empty()), stops: [{ ...day(fixture()).stops[1]!, routeId: null }] }, { ...day(empty()), id: 'e' }] };
    expect(moveStopToDay(list, 's2', 'e', ids('n')).days.map((d) => d.stops.map((s) => [s.id, s.routeId]))).toEqual([[], [['n1', null]]]);
  });

  it('moves a stop to a route of another day as its own, keeping its id: on a point it stands on, else beside the route', () => {
    let trip = addRoute(twoDays(), 'e', 'q');
    for (const [id, lngLat] of [['x', [5, 5]], ['y', [2, 2]]] as const) {
      trip = updateRoute(trip, 'q', routedOnly((r) => routeEdit.appendPoint(r, { id, lngLat: [...lngLat] })));
    }
    const moved = moveStopIntoRoute(moveStopIntoRoute(trip, 's2', 'q'), 's1', 'q');
    expect(day(moved).stops).toEqual([]);
    expect(moved.days[1]!.stops.map((s) => [s.id, s.routeId, s.pointId])).toEqual([
      ['s2', 'q', null],
      ['s1', 'q', 'y'],
    ]);
    expect(routedOf(day(moved).routes[0]!).points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(routedOf(moved.days[1]!.routes[0]!).points.map((p) => p.id)).toEqual(['x', 'y']);
    expect(moveStopIntoRoute(moved, 's1', 'q')).toBe(moved);
  });

  it('moves days to after another, in their order, and leaves the trip where nothing moves', () => {
    const trip = addDay(addDay(twoDays(), 'f'), 'g');
    expect(moveDaysAfter(trip, ['d', 'f'], 'g').days.map((d) => d.id)).toEqual(['e', 'g', 'd', 'f']);
    expect(moveDaysAfter(trip, ['e'], 'd')).toBe(trip);
    expect(moveDaysAfter(trip, ['d'], 'd')).toBe(trip);
  });

  it('pastes days under new ids after a day or at the end, without dates in a collection', () => {
    const source = twoDays();
    const pasted = pasteDays(source, [source.days[0]!], 'd', ids('n'));
    expect(pasted.days.map((d) => d.id)).toEqual(['d', 'n7', 'e']);
    expect(pasted.days[1]!.date).toBe('2027-06-12');
    expect(pasted.days[1]!.stops.map((s) => s.pointId)).toEqual([routedOf(pasted.days[1]!.routes[0]!).points[1]!.id, null]);
    const collection = pasteDays({ ...empty(), kind: 'collection', days: [] }, source.days, undefined, ids('m'));
    expect(collection.days.map((d) => d.date)).toEqual([null, null]);
  });

  it('pastes stops into a day of a trip as the own of each of its routes, and into a category of a list as places', () => {
    const stops = day(twoDays()).stops;
    expect(pasteStops(twoDays(), 'e', stops, ids('c'))).toEqual(twoDays());
    const trip = pasteStops(addRoute(addRoute(twoDays(), 'e', 'q'), 'e', 'u'), 'e', [stops[0]!], ids('c'));
    expect(trip.days[1]!.stops).toEqual([
      { ...stops[0]!, id: 'c1', routeId: 'q', pointId: null },
      { ...stops[0]!, id: 'c2', routeId: 'u', pointId: null },
    ]);
    const list = pasteStops({ ...twoDays(), kind: 'collection' }, 'e', [stops[0]!], ids('c'));
    expect(list.days[1]!.stops).toEqual([{ ...stops[0]!, id: 'c1', routeId: null, pointId: null }]);
  });

  it('pastes stops into a route as its own, on a point they stand on and else beside the route, which stays as it is', () => {
    const trip = fixture();
    const stop = { ...day(trip).stops[1]!, name: 'Café', routeId: 'elsewhere', pointId: 'gone' };
    const pasted = pasteStopsIntoRoute(trip, 'r', [stop, { ...stop, lngLat: [3, 3] }], ids('new'));
    expect(day(pasted).stops.slice(2)).toEqual([
      { ...stop, id: 'new1', routeId: 'r', pointId: null },
      { ...stop, id: 'new2', lngLat: [3, 3], routeId: 'r', pointId: 'c' },
    ]);
    expect(day(pasted).routes).toBe(day(trip).routes);
    expect(pasteStopsIntoRoute(trip, 'nowhere', [stop], ids('new'))).toBe(trip);
  });

  it('pastes a copied route with its stops under new ids, the stops on the new points or beside the new route', () => {
    const copied = copiedRoute(day(twoDays()), day(twoDays()).routes[0]!);
    expect(copied.stops.map((s) => s.id)).toEqual(['s1', 's2']);
    const trip = pasteRoute(twoDays(), 'e', copied, ids('p'));
    const pasted = routedOf(trip.days[1]!.routes[0]!);
    expect([pasted.id, pasted.points.map((p) => p.id), pasted.legs]).toEqual(['p1', ['p2', 'p3', 'p4'], routedOf(day(trip).routes[0]!).legs]);
    expect(trip.days[1]!.stops.map((s) => [s.id, s.name, s.routeId, s.pointId])).toEqual([
      ['p5', 'Stop 1', 'p1', 'p3'],
      ['p6', 'Stop 2', 'p1', null],
    ]);
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
    expect(trip.days[2]!.stops.map((s) => s.pointId)).toEqual([routedOf(trip.days[2]!.routes[0]!).points[1]!.id, null]);
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
  it('appends routes with their stops to the day and leaves an empty import alone', () => {
    const trip = fixture();
    expect(addParts(trip, 'd', { routes: [], stops: [] }, ids('n'))).toBe(trip);
    const route = { ...day(trip).routes[0]!, id: 'imported', points: [] };
    const stop = { ...day(trip).stops[1]!, id: 'w', routeId: 'imported' };
    const added = addParts(trip, 'd', { routes: [route], stops: [stop] }, ids('n'));
    expect(day(added).routes.map((r) => r.id)).toEqual(['r', 'imported']);
    expect(day(added).stops.map((s) => [s.id, s.routeId])).toEqual([['s1', 'r'], ['s2', 'r'], ['w', 'imported']]);
  });

  it('gives stops that come without a route to each route of the day, and to a day without one none', () => {
    const loose = { ...day(fixture()).stops[1]!, id: 'w', routeId: null };
    const route = { ...day(fixture()).routes[0]!, id: 'imported', points: [] };
    const added = addParts(fixture(), 'd', { routes: [route], stops: [loose] }, ids('n'));
    expect(day(added).stops.slice(2).map((s) => [s.id, s.routeId])).toEqual([['n1', 'r'], ['n2', 'imported']]);
    expect(day(addParts(empty(), 'd', { routes: [], stops: [loose] }, ids('n'))).stops).toEqual([]);
    expect(day(addParts({ ...empty(), kind: 'collection' }, 'd', { routes: [], stops: [loose] }, ids('n'))).stops).toEqual([{ ...loose, id: 'n1' }]);
  });
});

describe('a route kept as waypoints', () => {
  /** A day of stops on no point by these names, a degree apart, in this order. */
  const waypoints = (...names: string[]): Trip => names.reduce((trip, name, i) => updateStop(addStop(trip, 'd', null, [i, i], `s${i}`), 'd', `s${i}`, { name }), empty());
  const names = (stops: readonly { name: string }[]) => stops.map((stop) => stop.name);

  it('finds the stops numbered in a series, by their number, and no waypoint that is one', () => {
    expect(names(numberedStops(day(waypoints('Position 2', 'Position 10', 'Gasthof Adler', 'Position 1', 'Hut 7')).stops))).toEqual(['Position 1', 'Position 2', 'Position 10']);
    expect(names(numberedStops(day(waypoints('2', 'WP004', '1', 'WP003')).stops))).toEqual(['1', '2', 'WP003', 'WP004']);
    expect(numberedStops(day(waypoints('Alpenstraße', 'Panoramastraße', '8 Vorderbrandstraße 52')).stops)).toEqual([]);
  });

  it('counts no stop on a route as numbered', () => {
    const trip = updateStop(updateStop(fixture(), 'd', 's1', { name: 'Via 1' }), 'd', 's2', { name: 'Via 2' });
    expect(numberedStops(day(trip).stops)).toEqual([]);
  });

  it('makes a route of the stops in the order they are named in, which are stops no more', () => {
    const trip = waypoints('Alpenstraße', '2 Roßfeldstraße 76', 'Gasthof Adler', 'Ramsau');
    const made = routeFromStops(trip, ['s3', 's0', 's1'], 'r', ids('n'));
    const route = routedOf(day(made).routes[0]!);
    expect([route.id, route.kind, route.points.map((p) => p.lngLat), route.legs]).toEqual(['r', 'routed', [[3, 3], [0, 0], [1, 1]], {}]);
    expect(names(day(made).stops)).toEqual(['Gasthof Adler']);
  });

  it('leaves the trip as it is for fewer than two free stops', () => {
    const trip = fixture();
    expect(routeFromStops(trip, ['s1', 's2'], 'r2', ids('n'))).toBe(trip);
  });
});
