import type { LineString } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { Day, LngLat, Route } from '../model/trip';
import { encodePolyline } from '../routing/polyline';
import { routeFeatures } from './routeOverlay';

const route = (straight: boolean[]): Route => ({
  id: 'r',
  name: '',
  kind: 'routed',
  profile: 'motorcycle',
  highways: 'allow',
  optional: false,
  points: straight.map((s, i) => ({ id: `r${i}`, lngLat: [11 + i * 0.01, 48] as LngLat, ...(s && { straight: true }) })),
  legs: {},
});
const lines = (routes: Route[]) => {
  const day: Day = { id: 'd', name: '', date: null, notes: '', routes, stops: [] };
  return routeFeatures([{ day, role: 'selected' }], undefined, new Set(), []).features.map((f) => [f.properties!.state, (f.geometry as LineString).coordinates.length]);
};

describe('routeFeatures', () => {
  it('draws a run of legs in the same state as one line, and a track as one', () => {
    expect(lines([route([false, true, true, true])])).toEqual([['straight', 4]]);
    const line: LngLat[] = [
      [11, 48],
      [11.1, 48],
      [11.2, 48.1],
    ];
    expect(lines([{ id: 't', name: '', kind: 'track', profile: 'motorcycle', optional: false, line: encodePolyline(line) }])).toEqual([['track', 3]]);
  });

  it('starts a new line where the state changes', () => {
    expect(lines([route([false, false, true, false])])).toEqual([
      ['pending', 2],
      ['straight', 2],
      ['pending', 2],
    ]);
  });
});
