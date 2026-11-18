import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { frameOf, zoomToFit } from './frame';
import { distanceBetween } from './measure';

describe('frameOf', () => {
  const aslant: LngLat[] = [[8, 48], [8.5, 48.35], [9, 48.7]];

  it('is the box of the positions on a map with north up', () => {
    const frame = frameOf(aslant, 0);
    expect(frame.center[0]).toBeCloseTo(8.5, 3);
    expect(frame.center[1]).toBeCloseTo(48.35, 3);
    expect(frame.height).toBeCloseTo(distanceBetween([8, 48], [8, 48.7]), -3);
  });

  it('is narrow for positions in a row once the map is turned along them', () => {
    const north = frameOf(aslant, 0);
    const along = frameOf(aslant, 43.5);
    expect(along.width).toBeLessThan(north.width / 10);
    expect(along.height).toBeCloseTo(distanceBetween(aslant[0]!, aslant[2]!), -3);
    // The middle stays the middle of the row.
    expect(distanceBetween(along.center, [8.5, 48.35])).toBeLessThan(500);
  });
});

describe('zoomToFit', () => {
  it('goes a zoom farther off for a frame twice as large, and by whichever side is tighter', () => {
    const frame = { center: [8, 48] as LngLat, width: 40_000, height: 10_000 };
    const zoom = zoomToFit(frame, { width: 800, height: 400 });
    expect(zoomToFit({ ...frame, width: 80_000 }, { width: 800, height: 400 })).toBeCloseTo(zoom - 1, 5);
    expect(zoomToFit(frame, { width: 800, height: 50 })).toBeLessThan(zoom);
  });
});
