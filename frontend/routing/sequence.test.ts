import { describe, expect, it } from 'vitest';
import type { Day, LngLat, Route, RoutedLeg, Stop } from '../model/trip';
import { daySequence, nearestOnRoutes } from './sequence';

const decode = (geometry: string): LngLat[] => JSON.parse(geometry);
const leg = (geometry: LngLat[], distanceM: number): RoutedLeg => ({ geometry: JSON.stringify(geometry), distanceM, durationS: 1 });

const stop = (id: string, lngLat: LngLat, pointId: string | null): Stop => ({
  id,
  name: id,
  kind: 'other',
  lngLat,
  pointId,
  address: '',
  contact: '',
  bookingReference: '',
  notes: '',
  arriveAt: null,
  pauseMinutes: null,
  optional: false,
});

/** A route north along 11°E from 47° to 47.2°, in two legs of 11 km each (the second bends east). */
const route: Route = {
  id: 'r',
  name: '',
  kind: 'routed',
  profile: 'car',
  optional: false,
  points: [
    { id: 'a', lngLat: [11, 47] },
    { id: 'b', lngLat: [11, 47.1] },
    { id: 'c', lngLat: [11, 47.2] },
  ],
  legs: {
    'car/11,47;11,47.1': leg([[11, 47], [11, 47.1]], 11_000),
    'car/11,47.1;11,47.2': leg([[11, 47.1], [11.02, 47.15], [11, 47.2]], 11_000),
  },
};

const day = (stops: Stop[], routes: Route[] = [route]): Day => ({ id: 'd', name: '', date: null, notes: '', routes, stops });

describe('nearestOnRoutes', () => {
  it('finds the leg and the spot where the route passes closest', () => {
    const near = nearestOnRoutes(day([]), [11.01, 47.05], decode)!;
    expect(near.routeId).toBe('r');
    expect(near.legIndex).toBe(0);
    expect(near.lngLat[0]).toBeCloseTo(11, 6);
    expect(near.lngLat[1]).toBeCloseTo(47.05, 3);
    // About 760 m east of the line, 5.5 km along it.
    expect(near.awayM).toBeCloseTo(760, -2);
    expect(near.distanceM).toBeCloseTo(5560, -2);
  });

  it('measures the distance along the routed geometry', () => {
    const near = nearestOnRoutes(day([]), [11.02, 47.15], decode)!;
    expect(near.legIndex).toBe(1);
    expect(near.awayM).toBeCloseTo(0, 0);
    // The first leg's 11 km plus the way to the bend.
    expect(near.distanceM).toBeGreaterThan(11_000 + 5_000);
    expect(near.distanceM).toBeLessThan(11_000 + 7_000);
  });

  it('is undefined for a day without a leg', () => {
    expect(nearestOnRoutes(day([], []), [11, 47], decode)).toBeUndefined();
    expect(nearestOnRoutes(day([], [{ ...route, points: route.points.slice(0, 1), legs: {} }]), [11, 47], decode)).toBeUndefined();
  });
});

describe('daySequence', () => {
  it('lists points and stops in riding order with their distance from the start', () => {
    const stops = [stop('hotel', [11, 47.2], 'c'), stop('cafe', [11.01, 47.05], null), stop('home', [11, 47], 'a')];
    const entries = daySequence(day(stops), decode);
    expect(entries.map((e) => [e.stop?.id ?? e.point?.id, Math.round(e.distanceM / 100) * 100])).toEqual([
      ['home', 0],
      ['cafe', 5600],
      ['b', 11_000],
      ['hotel', 22_000],
    ]);
    expect(entries[0]!.point?.id).toBe('a');
    expect(entries[1]!.near?.distanceM).toBeCloseTo(760, -2);
    expect(entries[1]!.near?.lngLat[1]).toBeCloseTo(47.05, 3);
  });

  it('puts the free stops of a day without legs last, in their order', () => {
    const entries = daySequence(day([stop('x', [1, 1], null), stop('y', [2, 2], null)], []), decode);
    expect(entries.map((e) => [e.stop?.id, e.distanceM])).toEqual([
      ['x', 0],
      ['y', 0],
    ]);
  });

  it('counts a second route on from the end of the first', () => {
    const hike: Route = { ...route, id: 'h', profile: 'foot', points: [{ id: 'h1', lngLat: [11, 47.2] }, { id: 'h2', lngLat: [11.01, 47.2] }], legs: {} };
    const entries = daySequence(day([], [route, hike]), decode);
    expect(entries.map((e) => e.point!.id)).toEqual(['a', 'b', 'c', 'h1', 'h2']);
    expect(entries[3]).toMatchObject({ routeIndex: 1, distanceM: 22_000 });
    expect(entries[4]!.distanceM).toBeGreaterThan(22_000);
  });
});
