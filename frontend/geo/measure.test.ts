import { describe, expect, it } from 'vitest';
import { distanceBetween, lineLength } from './measure';

describe('distanceBetween', () => {
  it('measures along the great circle', () => {
    // Munich to Innsbruck, about 115 km.
    expect(distanceBetween([11.576, 48.137], [11.393, 47.268])).toBeCloseTo(97_700, -3);
    expect(distanceBetween([0, 0], [0, 0])).toBe(0);
    // A quarter of the Earth's circumference along the equator.
    expect(distanceBetween([0, 0], [90, 0])).toBeCloseTo(10_007_557, 0);
  });
});

describe('lineLength', () => {
  it('sums the segments', () => {
    expect(lineLength([[0, 0]])).toBe(0);
    expect(lineLength([[0, 0], [1, 0], [2, 0]])).toBeCloseTo(2 * distanceBetween([0, 0], [1, 0]), 6);
  });
});
