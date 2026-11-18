import { describe, expect, it } from 'vitest';
import { groundAtFoot, tilesAround, tilesInView } from './tiles';

describe('tilesAround', () => {
  it('has the position in the middle of what it takes', () => {
    // Greenwich on the equator is the corner the four middle tiles of level 1 share.
    expect(tilesAround([0, 0], 1, 2, 2)).toEqual([
      { z: 1, x: 0, y: 0 },
      { z: 1, x: 1, y: 0 },
      { z: 1, x: 0, y: 1 },
      { z: 1, x: 1, y: 1 },
    ]);
  });

  it('finds the tile a place lies in', () => {
    // Berlin lies in tile 10/550/335.
    expect(tilesAround([13.4, 52.52], 10, 1, 1)).toEqual([{ z: 10, x: 550, y: 335 }]);
  });

  it('takes none beyond the world', () => {
    expect(tilesAround([-179.9, 84], 2, 4, 4).every((tile) => tile.x >= 0 && tile.y >= 0 && tile.x < 4 && tile.y < 4)).toBe(true);
    expect(tilesAround([0, 0], 0, 4, 4)).toEqual([{ z: 0, x: 0, y: 0 }]);
  });
});

describe('tilesInView', () => {
  const count = (tiles: { z: number }[], z: number) => tiles.filter((tile) => tile.z === z).length;

  it('covers the view at the level seen and takes a few of the coarser ones', () => {
    const tiles = tilesInView([8.4, 49], [8.4, 49], 13, false, { width: 512, height: 768 }, 256);
    expect(count(tiles, 13)).toBe(3 * 4);
    expect(count(tiles, 12)).toBe(16);
    expect(count(tiles, 9)).toBe(16);
    expect(count(tiles, 8)).toBe(0);
    expect(count(tiles, 14)).toBe(0);
  });

  it('takes finer ones toward the foot of a steep view and past it', () => {
    const near: [number, number] = [8.4, 48.9];
    const tiles = tilesInView([8.4, 49], near, 13, true, { width: 512, height: 768 }, 256);
    expect(count(tiles, 14)).toBeGreaterThan(16);
    expect(tiles).toContainEqual(tilesAround(near, 15, 1, 1)[0]);
    expect(tiles).toContainEqual(tilesAround([8.4, 48.85], 15, 1, 1)[0]);
    expect(tiles).toContainEqual(tilesAround([8.4, 48.91], 14, 1, 1)[0]);
    expect(new Set(tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`)).size).toBe(tiles.length);
  });

  it('stops at the coarsest level there is', () => {
    expect(Math.min(...tilesInView([8.4, 49], [8.4, 49], 2, false, { width: 512, height: 512 }, 256).map((tile) => tile.z))).toBe(0);
  });
});

describe('groundAtFoot', () => {
  it('lies behind what a map that looks north looks at, the farther the lower the zoom', () => {
    const close = groundAtFoot([8.4, 49], 14, 72, 0, 900);
    const far = groundAtFoot([8.4, 49], 10, 72, 0, 900);
    expect(close[0]).toBeCloseTo(8.4, 6);
    expect(close[1]).toBeLessThan(49);
    expect(49 - far[1]).toBeCloseTo((49 - close[1]) * 16, 6);
  });

  it('lies farther behind a place shown over the middle of the view', () => {
    expect(groundAtFoot([8.4, 49], 14, 72, 0, 900, 60)[1]).toBeLessThan(groundAtFoot([8.4, 49], 14, 72, 0, 900)[1]);
  });

  it('lies west of what a map that looks east looks at', () => {
    const [lng, lat] = groundAtFoot([8.4, 49], 14, 72, 90, 900);
    expect(lng).toBeLessThan(8.4);
    expect(lat).toBeCloseTo(49, 6);
  });
});
