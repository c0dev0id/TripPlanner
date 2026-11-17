import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { waysAlong } from './ways';

/** A way along a parallel, a point every 0.01 degrees: about 730 m apart. */
const along = (from: number, to: number): LngLat[] => Array.from({ length: Math.round((to - from) / 0.01) + 1 }, (_, i) => [Number((from + i * 0.01).toFixed(2)), 49]);

describe('waysAlong', () => {
  it('cuts the way at the points: for each the way on to the next, none for the last', () => {
    const way = along(8, 8.1);
    // The second point lies beside the way, between two of its points; the third on one of them.
    const ways = waysAlong([[8, 49], [8.035, 49.0002], [8.07, 49], [8.1, 49]], way);
    expect(ways).toEqual([way.slice(1, 4), way.slice(4, 7), way.slice(7, 10), []]);
  });

  it('takes a point where the way first comes by it after the point before, on a way out and back', () => {
    const out = along(8, 8.1);
    const way = [...out, ...out.toReversed().slice(1)];
    const ways = waysAlong([[8, 49], [8.05, 49], [8.1, 49], [8.05, 49], [8, 49]], way);
    expect(ways.map((part) => part.length)).toEqual([4, 5, 5, 5, 0]);
    expect(ways.flat()).toEqual(way.slice(1, -1));
  });

  it('gives no ways where a point is not beside the way, or there is none', () => {
    const way = along(8, 8.1);
    expect(waysAlong([[8, 49], [8.05, 49.01], [8.1, 49]], way)).toEqual([[], [], []]);
    expect(waysAlong([[8, 49], [8.1, 49]], [])).toEqual([[], []]);
    expect(waysAlong([[8, 49]], way)).toEqual([[]]);
  });
});
