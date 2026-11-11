import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { distanceBetween, stretchesOf } from './measure';

describe('distanceBetween', () => {
  it('measures along the great circle', () => {
    // Munich to Innsbruck, about 98 km.
    expect(distanceBetween([11.576, 48.137], [11.393, 47.268])).toBeCloseTo(97_700, -3);
    expect(distanceBetween([0, 0], [0, 0])).toBe(0);
    // A quarter of the Earth's circumference along the equator.
    expect(distanceBetween([0, 0], [90, 0])).toBeCloseTo(10_007_557, 0);
  });
});

describe('stretchesOf', () => {
  // Along the equator a hundredth of a degree is some 1.1 km.
  const line: LngLat[] = [0, 0.01, 0.02, 0.03, 0.04, 0.05].map((lng) => [lng, 0]);

  it('cuts where the next point would make a stretch too long, each beginning where the one before ends', () => {
    expect(stretchesOf(line, 2500)).toEqual([line.slice(0, 3), line.slice(2, 5), line.slice(4, 6)]);
  });

  it('keeps a short line whole and a segment that is too long by itself', () => {
    expect(stretchesOf(line, 50_000)).toEqual([line]);
    expect(stretchesOf(line, 500)).toEqual([0, 1, 2, 3, 4].map((i) => line.slice(i, i + 2)));
    expect(stretchesOf([[0, 0]], 500)).toEqual([]);
  });
});
