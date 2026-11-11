import { describe, expect, it } from 'vitest';
import { sizeAt } from './overlaySigns';

describe('sizeAt', () => {
  const lineWidth = (zoom: number, sharpUntil: number) => Math.round(sizeAt(zoom, 4, 6, 12, 0.8, sharpUntil) * 10) / 10;

  it('grows a little with the zoom over a base map sharp at every zoom', () => {
    expect([8, 10, 12, 14, 16, 18, 22].map((zoom) => lineWidth(zoom, Infinity))).toEqual([4, 4, 5, 6, 9, 12, 12]);
  });

  it('takes the road for its measure where the base map is blown up, a road doubling with every zoom', () => {
    // Sharp until zoom 16: a road of 12 px there is 24, 96 and 768 px wide at zooms 17, 19 and 22.
    expect([16, 17, 19, 22].map((zoom) => lineWidth(zoom, 16))).toEqual([9, 19.2, 76.8, 614.4]);
  });
});
