import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { distanceBetween } from './measure';
import { nearestPlaceOn, partInBox } from './reach';

/** The nearest place asked once, in a flat map at the position's own latitude. */
const nearestPlace = (from: LngLat, lines: LngLat[][]) => nearestPlaceOn(lines, from[1])(from);

describe('nearestPlace', () => {
  const road: LngLat[] = [
    [8, 48],
    [9, 48],
  ];

  it('finds the place on a segment, not only its ends', () => {
    const found = nearestPlace([8.5, 48.5], [road])!;
    expect(found.at[0]).toBeCloseTo(8.5, 6);
    expect(found.at[1]).toBeCloseTo(48, 6);
    expect(found.metres).toBeCloseTo(distanceBetween([8.5, 48.5], [8.5, 48]), 3);
  });

  it('takes the end of a line where the position lies beyond it', () => {
    expect(nearestPlace([10, 48], [road])!.at).toEqual([9, 48]);
  });

  it('picks the nearest of several lines, and is at no distance on one', () => {
    const far: LngLat[] = [
      [8, 50],
      [9, 50],
    ];
    expect(nearestPlace([8.2, 49.2], [road, far])!.at[1]).toBeCloseTo(50, 6);
    expect(nearestPlace([8.2, 48.6], [road, far])!.at[1]).toBeCloseTo(48, 6);
    expect(nearestPlace([8.25, 48], [road, far])!.metres).toBeCloseTo(0, 6);
  });

  it('answers for many positions from one preparation, a degree of latitude off its own', () => {
    const nearest = nearestPlaceOn([road], 49);
    expect(nearest([8.5, 48.5])!.at[0]).toBeCloseTo(8.5, 6);
    expect(nearest([8.5, 48.5])!.metres).toBeCloseTo(distanceBetween([8.5, 48.5], [8.5, 48]), 3);
    expect(nearest([10, 48])!.at).toEqual([9, 48]);
  });

  it('takes a line of one point as that point, and finds nothing without a line', () => {
    expect(nearestPlace([8, 49], [[[8, 48]]])!.at).toEqual([8, 48]);
    expect(nearestPlace([8, 49], [])).toBeUndefined();
    expect(nearestPlace([8, 49], [[]])).toBeUndefined();
  });
});

describe('partInBox', () => {
  it('keeps a segment that lies inside', () => {
    expect(partInBox([10, 10], [90, 40], 100, 50)).toEqual([
      [10, 10],
      [90, 40],
    ]);
  });

  it('cuts a segment at the edges it crosses', () => {
    expect(partInBox([-50, 25], [150, 25], 100, 50)).toEqual([
      [0, 25],
      [100, 25],
    ]);
    expect(partInBox([50, 25], [50, 500], 100, 50)).toEqual([
      [50, 25],
      [50, 50],
    ]);
  });

  it('finds nothing of a segment that passes outside', () => {
    expect(partInBox([-10, -10], [-5, 80], 100, 50)).toBeUndefined();
    expect(partInBox([120, 10], [200, 40], 100, 50)).toBeUndefined();
    expect(partInBox([-10, 45], [40, 95], 100, 50)).toBeUndefined();
  });
});
