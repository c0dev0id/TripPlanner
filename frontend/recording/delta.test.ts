import { describe, expect, it } from 'vitest';
import { METRES_PER_DEGREE } from '../geo/measure';
import type { LngLat } from '../model/trip';
import { alignAlong, deltaSummaryOf, deltaToTrack, offsetsFrom, valueAt } from './delta';
import { measuresOf } from './measures';

/** A place `east` and `north` metres from a corner near the equator, where degrees of longitude and latitude are alike. */
const at = (east: number, north = 0): LngLat => [east / METRES_PER_DEGREE, north / METRES_PER_DEGREE];

/** Points every 100 m eastwards, from `from` metres on. */
const east = (n: number, from = 0, north = 0): LngLat[] => Array.from({ length: n }, (_, i) => at(from + i * 100, north));

const round = (values: readonly (number | null)[]) => values.map((v) => (v === null ? null : Math.round(v)));

describe('offsetsFrom', () => {
  it('measures each point\'s distance to the nearest line', () => {
    expect(round(offsetsFrom([at(50, 30), at(250, -80), at(700, 0)], [east(4), [at(700, 20), at(800, 20)]]))).toEqual([30, 80, 20]);
  });
});

describe('alignAlong', () => {
  it('places each point along the other track, and none that is off it', () => {
    const { along, offset } = alignAlong([at(50, 10), at(150, -20), at(250, 400)], east(4));
    expect(round(along)).toEqual([50, 150, null]);
    expect(round(offset)).toEqual([10, 20, 400]);
  });

  it('follows the other track along the way back, though the way out lies nearer', () => {
    // Out 300 m east and back along the same road, 5 m to the side.
    const outAndBack = [...east(4), ...east(3, 100, 5).reverse()];
    const track = [at(100, 1), at(300), at(200, 1), at(100, 1)];
    expect(round(alignAlong(track, outAndBack).along)).toEqual([100, 300, 405, 505]);
  });

  it('takes up the other track wherever it comes back to it', () => {
    const { along } = alignAlong([at(0, 2), at(100, 400), at(2500, 2)], east(30));
    expect(round(along)).toEqual([0, null, 2500]);
  });
});

describe('valueAt', () => {
  it('reads a series between two points', () => {
    const distance = Float64Array.from([0, 100, 200]);
    expect([valueAt(distance, [10, 20, 40], 50), valueAt(distance, [10, 20, 40], 200), valueAt(distance, [10, null, 40], 150)]).toEqual([15, 40, null]);
  });
});

describe('deltaToTrack', () => {
  const ride = (seconds: number, speed: number, lean: number[]) => {
    const points = east(5);
    const measures = measuresOf({ points, series: { time: points.map((_, i) => i * seconds * 1000), speed: points.map(() => speed / 3.6), lean_angle: lean } });
    return { points, measures };
  };

  it('compares time, speed and lean at the same places', () => {
    const quick = ride(10, 36, [0, -30, 0, 20, 0]);
    const slow = ride(12, 30, [0, 25, 0, -20, 0]);
    const d = deltaToTrack(quick, slow);
    expect(round(d.time!)).toEqual([0, -2, -4, -6, -8]);
    expect(round(d.speed!)).toEqual([6, 6, 6, 6, 6]);
    expect(round(d.lean!)).toEqual([0, 5, 0, 0, 0]);
    const s = deltaSummaryOf(quick.measures, d);
    expect([s.offM, Math.round(s.timeS!), Math.round(s.speed!)]).toEqual([0, -8, 6]);
  });

  it('counts the distance off the other and how far it went', () => {
    const track = { points: [at(0), at(100), at(200, 300), at(300)], measures: measuresOf({ points: [at(0), at(100), at(200, 300), at(300)], series: {} }) };
    const s = deltaSummaryOf(track.measures, { offset: offsetsFrom(track.points, [east(4)]) });
    expect([Math.round(s.offM), Math.round(s.furthestM)]).toEqual([316, 300]);
  });
});
