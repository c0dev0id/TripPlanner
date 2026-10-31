import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { colorAt, colorRuns, kmBySurface, NO_VALUE, scaleOf, surfaceColor } from './lineColors';
import { trackSurfaces } from './surfaces';

const along = (...metres: number[]) => Float64Array.from(metres);

describe('scaleOf', () => {
  it('spreads speeds from standing to a round figure above nearly all of them', () => {
    const speeds = [...Array.from({ length: 200 }, (_, i) => i / 2), 400];
    expect(scaleOf('speed', speeds)).toMatchObject({ from: 0, to: 100 });
  });

  it('spreads slopes and lean evenly to both sides', () => {
    expect(scaleOf('slope', [-3, 1, 7])).toMatchObject({ from: -8, to: 8 });
    expect(scaleOf('lean', [-2, 1])).toMatchObject({ from: -10, to: 10 });
  });

  it('has no scale for a measure without values', () => {
    expect(scaleOf('altitude', [null, null])).toBeUndefined();
  });
});

describe('colorAt', () => {
  const scale = { from: 0, to: 100, colors: ['a', 'b', 'c', 'd'] };

  it('picks the step a value falls in, and the ends for values beyond the range', () => {
    expect([0, 24, 25, 99, 100, 150, -5].map((v) => colorAt(scale, v))).toEqual(['a', 'a', 'b', 'd', 'd', 'd', 'a']);
    expect(colorAt(scale, null)).toBe(NO_VALUE);
  });
});

describe('colorRuns', () => {
  const points: LngLat[] = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ];

  it('cuts the line where its colour changes, the pieces sharing their ends', () => {
    expect(colorRuns(points, ['a', 'a', 'b', 'b', 'a'])).toEqual([
      { points: points.slice(0, 3), color: 'a' },
      { points: points.slice(2, 5), color: 'b' },
    ]);
  });

  it('keeps a line of one colour whole', () => {
    expect(colorRuns(points, ['a', 'a', 'a', 'a', 'a'])).toEqual([{ points, color: 'a' }]);
  });
});

describe('surfaces', () => {
  it('counts the kilometres on each surface', () => {
    const km = kmBySurface(along(0, 1000, 3000, 3500), ['paved', 'gravel', 'paved', null]);
    expect([...km]).toEqual([
      ['paved', 1.5],
      ['gravel', 2],
    ]);
    expect([surfaceColor('gravel'), surfaceColor(null)]).toEqual(['#e8590c', NO_VALUE]);
  });

  it('matches points 50 m apart and the last, the points between taking the surface before them', async () => {
    const points: LngLat[] = Array.from({ length: 7 }, (_, i) => [i, 0]);
    let asked: LngLat[] = [];
    const surfaces = await trackSurfaces(points, along(0, 20, 40, 60, 80, 120, 130), async (sent) => {
      asked = [...sent];
      return ['paved', 'gravel', null, 'dirt'];
    });
    expect(asked).toEqual([points[0], points[3], points[5], points[6]]);
    expect(surfaces).toEqual(['paved', 'paved', 'paved', 'gravel', 'gravel', null, 'dirt']);
  });
});
