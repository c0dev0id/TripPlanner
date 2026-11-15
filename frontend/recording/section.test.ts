import { describe, expect, it } from 'vitest';
import { METRES_PER_DEGREE } from '../geo/measure';
import type { LngLat } from '../model/trip';
import { sectionOn, trackOnSection } from './section';

const at = (east: number, north = 0): LngLat => [east / METRES_PER_DEGREE, north / METRES_PER_DEGREE];
/** Points every 100 m eastwards from `from` to `to` metres, or westwards where `to` is less. */
const road = (from: number, to: number, north = 0): LngLat[] => {
  const step = to >= from ? 100 : -100;
  return Array.from({ length: Math.abs(to - from) / 100 + 1 }, (_, i) => at(from + i * step, north));
};

describe('sectionOn', () => {
  const section = road(1000, 2000);

  it('finds where a line rides the section in its direction', () => {
    const on = sectionOn(road(0, 3000), section)!;
    expect([Math.round(on.fromM), Math.round(on.toM)]).toEqual([1000, 2000]);
  });

  it('takes a line a little off the section for one on it', () => {
    expect(sectionOn(road(0, 3000, 30), section)).toBeDefined();
  });

  it('does not take a line the other way, a line elsewhere, or one that leaves the section halfway', () => {
    expect(sectionOn(road(3000, 0), section)).toBeUndefined();
    expect(sectionOn(road(0, 3000, 400), section)).toBeUndefined();
    const detour = [...road(0, 1500), at(1500, 500), at(2500, 500)];
    expect(sectionOn(detour, section)).toBeUndefined();
  });

  it('finds the pass that rides it on a way out and back', () => {
    const outAndBack = [...road(3000, 0), ...road(0, 3000).slice(1)];
    const on = sectionOn(outAndBack, section)!;
    expect([Math.round(on.fromM), Math.round(on.toM)]).toEqual([4000, 5000]);
  });
});

describe('trackOnSection', () => {
  it('keeps the points and values of the part on the section', () => {
    const points = road(0, 3000);
    const track = { segments: 1, points, series: { time: points.map((_, i) => i * 1000) } };
    const part = trackOnSection(track, road(1000, 2000))!;
    expect([part.points.length, part.series.time![0], part.series.time!.at(-1)]).toEqual([11, 10000, 20000]);
    expect(trackOnSection(track, road(2000, 1000))).toBeUndefined();
  });
});
