import { describe, expect, it } from 'vitest';
import type { LngLat, Route, RoutedLeg } from '../model/trip';
import { legCoordinates, legKey, legState, nextMissingLeg, pruneLegs, roundLngLat, routeDistance, routeLegs } from './legs';

const routed = (geometry: string, distanceM = 1000): RoutedLeg => ({ geometry, distanceM, durationS: 60 });

const route = (id: string, points: [number, number][], legs: Record<string, RoutedLeg> = {}): Route => ({
  id,
  name: '',
  kind: 'routed',
  profile: 'bicycle',
  highways: 'allow',
  optional: false,
  points: points.map((lngLat, i) => ({ id: `${id}${i}`, lngLat })),
  legs,
});

describe('legs', () => {
  it('builds keys from profile and coordinates', () => {
    expect(legKey({ profile: 'motorcycle', highways: 'avoid' }, [11.5, 48.1], [11.6, 48.2])).toBe('motorcycle:avoid/11.5,48.1;11.6,48.2');
    expect(legKey({ profile: 'motorcycle', highways: 'allow' }, [11, 48], [0.000001, -0])).toBe('motorcycle:allow/11,48;0.000001,0');
  });

  it('needs one leg per pair of consecutive points', () => {
    expect(routeLegs(route('r', [[1, 1]]))).toEqual([]);
    expect(
      routeLegs(
        route('r', [
          [1, 1],
          [2, 2],
          [3, 3],
        ]),
      ).map((l) => !l.straight && l.key),
    ).toEqual(['bicycle:allow/1,1;2,2', 'bicycle:allow/2,2;3,3']);
  });

  it('drops cached legs that are no longer needed', () => {
    const r = route(
      'r',
      [
        [1, 1],
        [2, 2],
      ],
      { 'bicycle:allow/1,1;2,2': routed('a'), 'bicycle:allow/2,2;3,3': routed('b'), 'motorcycle:allow/1,1;2,2': routed('c') },
    );
    expect(pruneLegs(r)).toEqual({ 'bicycle:allow/1,1;2,2': routed('a') });
  });

  it('finds the next missing leg, skipping cached and failed ones', () => {
    const r = route(
      'r',
      [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ],
      { 'bicycle:allow/1,1;2,2': routed('a') },
    );
    const failed = new Set(['bicycle:allow/2,2;3,3']);
    expect(nextMissingLeg([r], failed)).toMatchObject({ routeId: 'r', key: 'bicycle:allow/3,3;4,4', from: [3, 3], to: [4, 4] });
    expect(
      nextMissingLeg(
        [
          route(
            'done',
            [
              [1, 1],
              [2, 2],
            ],
            { 'bicycle:allow/1,1;2,2': routed('a') },
          ),
        ],
        new Set(),
      ),
    ).toBeUndefined();
  });

  it('serves the preferred routes first', () => {
    const a = route('a', [
      [1, 1],
      [2, 2],
    ]);
    const b = route('b', [
      [5, 5],
      [6, 6],
    ]);
    expect(nextMissingLeg([a, b], new Set(), new Set(['b']))?.routeId).toBe('b');
    expect(nextMissingLeg([a, b], new Set())?.routeId).toBe('a');
  });

  it('rounds coordinates to six decimals', () => {
    expect(roundLngLat([11.12345678, -48.98765432])).toEqual([11.123457, -48.987654]);
  });
});

const decode = (geometry: string): LngLat[] => JSON.parse(geometry);
const tour: Route = {
  ...route('t', [
    [1, 1],
    [2, 2],
    [3, 3],
  ]),
  profile: 'motorcycle',
  highways: 'allow',
  legs: { 'motorcycle:allow/1,1;2,2': routed('[[1,1],[1.5,1.2],[2,2]]'), 'motorcycle:allow/2,2;3,3': routed('[[2,2],[2.5,2.8],[3,3]]') },
};

describe('legCoordinates', () => {
  it('draws a routed leg along its geometry and the others straight', () => {
    const [first, second] = routeLegs(tour);
    expect(legCoordinates(tour, first!, decode)).toEqual([
      [1, 1],
      [1.5, 1.2],
      [2, 2],
    ]);
    const partial = { ...tour, legs: { 'motorcycle:allow/1,1;2,2': routed('[[1,1],[1.5,1.2],[2,2]]') } };
    expect(legCoordinates(partial, second!, decode)).toEqual([
      [2, 2],
      [3, 3],
    ]);
  });

  it('draws a straight leg as its two ends, whatever is cached for it', () => {
    const points = tour.points.map((p, i) => (i === 1 ? { ...p, straight: true } : p));
    const straight = { ...tour, points };
    expect(legCoordinates(straight, routeLegs(straight)[0]!, decode)).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });
});

describe('routeDistance', () => {
  it('adds routed lengths and counts other legs as the crow flies', () => {
    expect(routeDistance(tour)).toBe(2000);
    const partial = { ...tour, legs: { 'motorcycle:allow/1,1;2,2': routed('[[1,1],[2,2]]', 500) } };
    // 2,2 to 3,3 is about 157 km on the sphere.
    expect(routeDistance(partial)).toBeCloseTo(500 + 157_000, -4);
  });
});

describe('straight legs', () => {
  const r = route('s', [
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
  r.points[1]!.straight = true;

  it('are marked by the point they lead to', () => {
    expect(routeLegs(r).map((l) => l.straight)).toEqual([true, false]);
  });

  it('are never routed', () => {
    expect(nextMissingLeg([r], new Set())).toMatchObject({ key: 'bicycle:allow/2,2;3,3' });
    expect(nextMissingLeg([{ ...r, legs: { 'bicycle:allow/2,2;3,3': routed('b') } }], new Set())).toBeUndefined();
  });

  it('keep no cached geometry', () => {
    expect(pruneLegs({ ...r, legs: { 'bicycle:allow/1,1;2,2': routed('a'), 'bicycle:allow/2,2;3,3': routed('b') } })).toEqual({ 'bicycle:allow/2,2;3,3': routed('b') });
  });
});

describe('legState', () => {
  it('tells routed, straight, pending and failed legs apart', () => {
    const r = route(
      's',
      [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ],
      { 'bicycle:allow/1,1;2,2': routed('a') },
    );
    r.points[3]!.straight = true;
    expect(routeLegs(r).map((leg) => legState(r, leg, new Set(['bicycle:allow/2,2;3,3'])))).toEqual(['routed', 'failed', 'straight']);
    expect(legState(r, routeLegs(r)[1]!, new Set())).toBe('pending');
  });
});
