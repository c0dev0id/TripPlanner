import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { keepTolerances } from './simplify';

const kept = (line: LngLat[], toleranceM: number): LngLat[] => {
  const tolerances = keepTolerances(line);
  return line.filter((_, i) => tolerances[i]! > toleranceM);
};

describe('keepTolerances', () => {
  it('keeps the ends and the corners, dropping the points on straight stretches', () => {
    const line: LngLat[] = [
      [11, 48],
      [11.1, 48],
      [11.2, 48],
      [11.2, 48.1],
      [11.2, 48.2],
    ];
    expect(kept(line, 10)).toEqual([
      [11, 48],
      [11.2, 48],
      [11.2, 48.2],
    ]);
  });

  it('keeps fewer points the larger the tolerance, never the ends', () => {
    const zigzag: LngLat[] = Array.from({ length: 3000 }, (_, i) => [i * 0.0001, (i % 2) * 0.0002 * (1 + (i % 7))]);
    const counts = [5, 25, 100].map((t) => kept(zigzag, t).length);
    expect(counts[0]).toBeGreaterThan(counts[1]!);
    expect(counts[1]).toBeGreaterThan(counts[2]!);
    expect(kept(zigzag, 1e9)).toEqual([zigzag[0], zigzag.at(-1)]);
    expect(keepTolerances([])).toHaveLength(0);
  });
});
