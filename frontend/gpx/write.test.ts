import { describe, expect, it } from 'vitest';
import { parseGpx, type GpxContent } from './gpx';
import { gpxText } from './write';

describe('gpxText', () => {
  it('writes what a file holds so that it reads back the same', () => {
    const content: GpxContent = {
      name: 'Odenwald & Neckar',
      waypoints: [
        { lngLat: [8.7, 49.4], name: 'Café <Mitte>', description: 'Open "late"', symbol: 'Flag, Blue', type: 'Cafés', links: ['https://example.org/?a=1&b=2'] },
        { lngLat: [8.8, 49.5], links: [] },
      ],
      routes: [{ name: 'Loop', points: [[8.7, 49.4], [8.8, 49.5]], ways: [[], []] }],
      tracks: [{ name: 'Ride', segments: [[[8.7, 49.4], [8.75, 49.45]], [[8.8, 49.5]]] }],
    };
    expect(JSON.parse(JSON.stringify(parseGpx(gpxText(content))))).toEqual(content);
  });

  it('writes a file that holds nothing as an empty GPX file', () => {
    expect(parseGpx(gpxText({ waypoints: [], routes: [], tracks: [] }))).toMatchObject({ waypoints: [], routes: [], tracks: [] });
  });
});
