import { describe, expect, it } from 'vitest';
import type { Day, LngLat, Route, RoutedLeg, Stop } from '../model/trip';
import { newStop } from './dayEdit';
import { encodePolyline } from './polyline';
import { daySequence, withStopsInRidingOrder } from './sequence';

const decode = (geometry: string): LngLat[] => JSON.parse(geometry);
const leg = (geometry: LngLat[], distanceM: number): RoutedLeg => ({ geometry: JSON.stringify(geometry), distanceM, durationS: 1 });

/** A stop of the route `routeId`, on its point `pointId` or beside it. */
const stop = (id: string, lngLat: LngLat, pointId: string | null, routeId: string | null = 'r'): Stop => newStop(id, id, lngLat, routeId, pointId);

/** A route north along 11°E from 47° to 47.2°, in two legs of 11 km each (the second bends east). */
const route: Route = {
  id: 'r',
  name: '',
  kind: 'routed',
  profile: 'motorcycle',
  highways: 'allow',
  optional: false,
  color: null,
  points: [
    { id: 'a', lngLat: [11, 47] },
    { id: 'b', lngLat: [11, 47.1] },
    { id: 'c', lngLat: [11, 47.2] },
  ],
  legs: {
    'motorcycle:allow/11,47;11,47.1': leg([[11, 47], [11, 47.1]], 11_000),
    'motorcycle:allow/11,47.1;11,47.2': leg([[11, 47.1], [11.02, 47.15], [11, 47.2]], 11_000),
  },
};

const day = (stops: Stop[], routes: Route[] = [route]): Day => ({ id: 'd', name: '', date: null, notes: '', routes, stops });

describe('daySequence', () => {
  it('places a stop beside its route at the leg and the spot where the route passes closest', () => {
    const [entry] = daySequence(day([stop('cafe', [11.005, 47.05], null)]), decode).filter((e) => e.stop);
    expect(entry!.near).toMatchObject({ routeId: 'r', legIndex: 0 });
    expect(entry!.near!.lngLat[0]).toBeCloseTo(11, 6);
    expect(entry!.near!.lngLat[1]).toBeCloseTo(47.05, 3);
    // About 380 m east of the line, 5.5 km along it.
    expect(entry!.near!.distanceM).toBeCloseTo(380, -2);
    expect(entry!.distanceM).toBeCloseTo(5560, -2);
  });

  it('measures the distance along the routed geometry', () => {
    const [entry] = daySequence(day([stop('bend', [11.02, 47.15], null)]), decode).filter((e) => e.stop);
    expect(entry!.near!.legIndex).toBe(1);
    expect(entry!.near!.distanceM).toBeCloseTo(0, 0);
    // The first leg's 11 km plus the way to the bend.
    expect(entry!.distanceM).toBeGreaterThan(11_000 + 5_000);
    expect(entry!.distanceM).toBeLessThan(11_000 + 7_000);
  });

  it('places a stop along its own route however far it stands, and not along another that passes closer', () => {
    const north: Route = { ...route, id: 'n', points: [{ id: 'n1', lngLat: [11, 48] }, { id: 'n2', lngLat: [11, 48.1] }], legs: {} };
    const entries = daySequence(day([stop('far', [11.005, 48.05], null)], [route, north]), decode);
    expect(entries.map((e) => [e.id, e.routeIndex])).toEqual([['a', 0], ['b', 0], ['c', 0], ['far', 0], ['n1', 1], ['n2', 1]]);
    expect(entries[3]!.near).toMatchObject({ routeId: 'r', legIndex: 1 });
    expect(entries[3]!.near!.distanceM).toBeGreaterThan(90_000);
  });

  it('puts the stops beside a route without a line at its start, and leaves out a place of no route', () => {
    const onePoint = { ...route, points: route.points.slice(0, 1), legs: {} };
    const entries = daySequence(day([stop('x', [11, 47], null), stop('y', [12, 48], null), stop('place', [11, 47], null, null)], [onePoint]), decode);
    expect(entries.map((e) => [e.id, e.distanceM, e.near])).toEqual([
      ['a', 0, undefined],
      ['x', 0, undefined],
      ['y', 0, undefined],
    ]);
  });

  it('lists points and stops in riding order with their distance from the start', () => {
    const stops = [stop('hotel', [11, 47.2], 'c'), stop('cafe', [11.005, 47.05], null), stop('home', [11, 47], 'a')];
    const entries = daySequence(day(stops), decode);
    expect(entries.map((e) => [e.id, Math.round(e.distanceM / 100) * 100])).toEqual([
      ['home', 0],
      ['cafe', 5600],
      ['b', 11_000],
      ['hotel', 22_000],
    ]);
    expect(entries[0]!.point?.id).toBe('a');
    expect(entries[1]!.near?.distanceM).toBeCloseTo(380, -2);
    expect(entries[1]!.near?.lngLat[1]).toBeCloseTo(47.05, 3);
  });

  it('carries the riding time, a stop beside the route at its share of the leg', () => {
    const entries = daySequence(day([stop('cafe', [11.005, 47.05], null)]), decode);
    // Each leg is 11 km and takes a second in the fixture; the café is half way along the first.
    expect(entries.map((e) => [e.id, Math.round(e.timeS * 100) / 100])).toEqual([
      ['a', 0],
      ['cafe', 0.51],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('counts a second route on from the end of the first', () => {
    const hike: Route = { ...route, id: 'h', profile: 'pedestrian', points: [{ id: 'h1', lngLat: [11, 47.2] }, { id: 'h2', lngLat: [11.01, 47.2] }], legs: {} };
    const entries = daySequence(day([], [route, hike]), decode);
    expect(entries.map((e) => e.point!.id)).toEqual(['a', 'b', 'c', 'h1', 'h2']);
    expect(entries[3]).toMatchObject({ routeIndex: 1, distanceM: 22_000 });
    expect(entries[4]!.distanceM).toBeGreaterThan(22_000);
  });

  it('lists every stop bound to one point, and no plain point for it', () => {
    const entries = daySequence(day([stop('fuel', [11, 47.1], 'b'), stop('cafe', [11, 47.1], 'b')]), decode);
    expect(entries.map((e) => e.id)).toEqual(['a', 'fuel', 'cafe', 'c']);
    expect(entries[1]!.distanceM).toBe(11_000);
  });
});

describe('daySequence along a track', () => {
  // North along 11°E from 47° to 47.2° in steps of 0.05°, about 5.56 km each; the decoder is the real one.
  const track: Route = { id: 't', name: '', kind: 'track', profile: 'motorcycle', optional: false, color: null, line: encodePolyline([[11, 47], [11, 47.05], [11, 47.1], [11, 47.15], [11, 47.2]]) };

  it('places a stop beside the track along its line and ends with the track', () => {
    const entries = daySequence(day([stop('cafe', [11.002, 47.12], null, 't')], [track]));
    expect(entries.map((e) => e.id)).toEqual(['cafe', 't']);
    expect(entries[0]!.near).toMatchObject({ routeId: 't', legIndex: 0 });
    expect(entries[0]!.distanceM).toBeCloseTo(13_343, -1);
    expect(entries[1]!.distanceM).toBeCloseTo(22_239, -1);
    expect(entries[1]!.timeS).toBeCloseTo(22_239 / (50 / 3.6), -1);
  });

  it('counts a route after the track on from its end', () => {
    const entries = daySequence(day([], [track, route]), decode);
    expect(entries.map((e) => e.id)).toEqual(['t', 'a', 'b', 'c']);
    expect(entries[1]!.distanceM).toBeCloseTo(entries[0]!.distanceM, 6);
  });
});

describe('withStopsInRidingOrder', () => {
  it('orders each day\'s stops as the sequence lists them, keeping every stop', () => {
    const stops = [stop('end', [11, 47.2], 'c'), stop('cafe', [11.005, 47.05], null), stop('start', [11, 47], 'a'), stop('fuel', [11, 47.1], 'b')];
    // Not routed yet, the legs run straight between the points.
    const straight = { ...route, legs: {} };
    const trip = withStopsInRidingOrder({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [day(stops, [straight]), day([stop('lost', [12, 48], null, null)], [])] });
    expect(trip.days[0]!.stops.map((s) => s.id)).toEqual(['start', 'cafe', 'fuel', 'end']);
    expect(trip.days[1]!.stops.map((s) => s.id)).toEqual(['lost']);
  });

  it('leaves the stops of a day without a route in the order they are listed, as a file gave them', () => {
    const listed = [stop('c', [11.2, 47], null, null), stop('a', [11, 47.3], null, null), stop('d', [10.9, 47.1], null, null), stop('b', [11.1, 46.9], null, null)];
    const trip = withStopsInRidingOrder({ id: 1, kind: 'collection', name: 'T', description: '', state: 'planned', version: 1, days: [day(listed, [])] });
    expect(trip.days[0]!.stops.map((s) => s.id)).toEqual(['c', 'a', 'd', 'b']);
  });
});
