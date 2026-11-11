import { describe, expect, it } from 'vitest';
import { tileOf, tilesAlong, tilesOfView } from './tiles';

describe('tiles', () => {
  it('are those of the web\'s maps at zoom 10, as the server counts them', () => {
    expect(tileOf([8.2963023, 47.0242031])).toEqual({ x: 535, y: 360 });
    expect(tileOf([0, -0.0001])).toEqual({ x: 512, y: 512 });
    expect(tileOf([-180, 89])).toEqual({ x: 0, y: 0 });
    expect(tileOf([180, -89])).toEqual({ x: 1023, y: 1023 });
  });

  it('of a view are every tile between its corners', () => {
    // A tile is 0.3516° wide: 8.1 to 8.5 spans the columns 535 and 536, and below 47.04° one row.
    expect(tilesOfView(8.1, 47.0, 8.5, 47.03)).toEqual([
      { x: 535, y: 360 },
      { x: 536, y: 360 },
    ]);
  });

  it('along lines are those the lines pass and those within reach beside them, each once', () => {
    const line = [
      [8.2, 47.02],
      [8.3, 47.02],
    ] as [number, number][];
    expect(tilesAlong([line, line], 200)).toEqual([{ x: 535, y: 360 }]);
    // The tile's northern edge is at 47.04°, some 2.2 km from the line.
    expect(tilesAlong([line], 3000)).toEqual([
      { x: 535, y: 359 },
      { x: 535, y: 360 },
    ]);
  });
});
