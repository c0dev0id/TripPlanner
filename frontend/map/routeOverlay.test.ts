import type { LineString } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { Day, LngLat, Route } from '../model/trip';
import { routeFeatures } from './routeOverlay';

const route = (kind: Route['kind'], straight: boolean[]): Route => ({
  id: kind,
  name: '',
  kind,
  profile: 'motorcycle',
  highways: 'allow',
  optional: false,
  points: straight.map((s, i) => ({ id: `${kind}${i}`, lngLat: [11 + i * 0.01, 48] as LngLat, ...(s && { straight: true }) })),
  legs: {},
});
const lines = (routes: Route[]) => {
  const day: Day = { id: 'd', name: '', date: null, notes: '', routes, stops: [] };
  return routeFeatures([{ day, role: 'selected' }], undefined, new Set(), []).features.map((f) => [f.properties!.state, (f.geometry as LineString).coordinates.length]);
};

describe('routeFeatures', () => {
  it('draws a run of legs in the same state as one line', () => {
    expect(lines([route('track', [false, true, true, true])])).toEqual([['straight', 4]]);
  });

  it('starts a new line where the state changes', () => {
    expect(lines([route('routed', [false, false, true, false])])).toEqual([
      ['pending', 2],
      ['straight', 2],
      ['pending', 2],
    ]);
  });
});
