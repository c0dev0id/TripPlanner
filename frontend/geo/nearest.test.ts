import { describe, expect, it } from 'vitest';
import { fractionOnSegment, nearestOnLines } from './nearest';

describe('nearestOnLines on one query', () => {
  it('finds the closest polyline and the point on it', () => {
    const lines = [
      [
        [0, 0],
        [10, 0],
      ],
      [
        [0, 10],
        [10, 10],
        [10, 20],
      ],
    ] as const;
    expect(nearestOnLines(lines)([4, 2])).toEqual({ index: 0, segment: 0, t: 0.4, distance: 2, point: [4, 0] });
    expect(nearestOnLines(lines)([13, 15])).toEqual({ index: 1, segment: 1, t: 0.5, distance: 3, point: [10, 15] });
  });

  it('handles single points and no lines', () => {
    expect(nearestOnLines([[[3, 4]]])([0, 0])).toEqual({ index: 0, segment: 0, t: 0, distance: 5, point: [3, 4] });
    expect(nearestOnLines([])([0, 0])).toBeUndefined();
  });
});

describe('nearestOnLines', () => {
  /** The nearest place by looking at every segment, earliest first on a tie, by squared distance as the index measures. */
  const bruteForce = (lines: [number, number][][], p: [number, number]) => {
    let best: { index: number; segment: number; distance2: number } | undefined;
    lines.forEach((line, index) => {
      for (let i = line.length === 1 ? 0 : 1; i < line.length; i++) {
        const [a, b] = [line[Math.max(0, i - 1)]!, line[i]!];
        const t = fractionOnSegment(p, a, b);
        const [dx, dy] = [p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1]))];
        const distance2 = dx * dx + dy * dy;
        if (!best || distance2 < best.distance2) best = { index, segment: Math.max(0, i - 1), distance2 };
      }
    });
    return best;
  };

  it('finds what a look at every segment finds, across many blocks and lines', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1000;
    const lines = Array.from({ length: 40 }, () => Array.from({ length: 1 + Math.floor(random() / 10) }, () => [random(), random()] as [number, number]));
    const nearest = nearestOnLines(lines);
    for (let i = 0; i < 200; i++) {
      const p: [number, number] = [random() * 1.2 - 100, random() * 1.2 - 100];
      const hit = nearest(p)!;
      const expected = bruteForce(lines, p)!;
      expect([hit.index, hit.segment]).toEqual([expected.index, expected.segment]);
      expect(hit.distance).toBeCloseTo(Math.sqrt(expected.distance2), 9);
    }
  });

  it('finds nothing beyond reach, and the earlier of two places equally near', () => {
    const lines = [
      [
        [0, 0],
        [10, 0],
      ],
      [
        [0, 4],
        [10, 4],
      ],
    ] as const;
    expect(nearestOnLines(lines)([5, 2], 1.5)).toBeUndefined();
    expect(nearestOnLines(lines)([5, 2], 2)).toMatchObject({ index: 0, distance: 2 });
    expect(nearestOnLines(lines)([5, 2])).toMatchObject({ index: 0, segment: 0, point: [5, 0] });
  });
});
