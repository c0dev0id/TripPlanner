import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { simplifyToCount } from './simplify';

describe('simplifyToCount', () => {
  it('keeps the ends and the corners, dropping the points on straight stretches', () => {
    const line: LngLat[] = [
      [11, 48],
      [11.1, 48],
      [11.2, 48],
      [11.2, 48.1],
      [11.2, 48.2],
    ];
    expect(simplifyToCount(line, 3)).toEqual([
      [11, 48],
      [11.2, 48],
      [11.2, 48.2],
    ]);
    expect(simplifyToCount(line, 10)).toEqual(line);
  });

  it('keeps at most the count asked for', () => {
    const zigzag: LngLat[] = Array.from({ length: 3000 }, (_, i) => [i * 0.0001, (i % 2) * 0.0002]);
    const kept = simplifyToCount(zigzag, 500);
    expect(kept.length).toBeLessThanOrEqual(500);
    expect(kept[0]).toEqual(zigzag[0]);
    expect(kept.at(-1)).toEqual(zigzag.at(-1));
  });
});
