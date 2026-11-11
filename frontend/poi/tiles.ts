import { METRES_PER_DEGREE } from '../geo/measure';
import type { LngLat } from '../model/trip';

/**
 * The tiles places are asked for by: those of the web's maps at zoom 10, some 25 km wide in
 * central Europe, as the server keeps them.
 */

const COUNT = 1 << 10;

export interface Tile {
  x: number;
  y: number;
}

const clamp = (n: number): number => Math.max(0, Math.min(COUNT - 1, Math.floor(n)));

/** The tile a position lies in. */
export function tileOf([lng, lat]: LngLat): Tile {
  const y = (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2;
  return { x: clamp(((lng + 180) / 360) * COUNT), y: clamp(y * COUNT) };
}

/** Every tile between two corners, the south-west and the north-east one. */
function tilesBetween(southWest: LngLat, northEast: LngLat): Tile[] {
  const [from, to] = [tileOf([southWest[0], northEast[1]]), tileOf([northEast[0], southWest[1]])];
  const tiles: Tile[] = [];
  for (let x = from.x; x <= to.x; x++) for (let y = from.y; y <= to.y; y++) tiles.push({ x, y });
  return tiles;
}

/** The tiles a view of the map shows: west, south, east, north. */
export const tilesOfView = (west: number, south: number, east: number, north: number): Tile[] => tilesBetween([west, south], [east, north]);

/** The tiles with a place that can lie within `reachM` metres of the lines, each once. */
export function tilesAlong(lines: readonly (readonly LngLat[])[], reachM: number): Tile[] {
  const tiles = new Map<string, Tile>();
  for (const line of lines) {
    for (const [lng, lat] of line) {
      const dLat = reachM / METRES_PER_DEGREE;
      const dLng = dLat / Math.cos((lat * Math.PI) / 180);
      for (const tile of tilesBetween([lng - dLng, lat - dLat], [lng + dLng, lat + dLat])) tiles.set(`${tile.x}/${tile.y}`, tile);
    }
  }
  return [...tiles.values()];
}
