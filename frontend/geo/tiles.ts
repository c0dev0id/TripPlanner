import type { LngLat } from '../model/trip';

/** A map tile by its zoom level, column and row, as tile servers count them. */
export interface Tile {
  z: number;
  x: number;
  y: number;
}

/** The tiles of a zoom level around a position: `across` columns and `down` rows with the position in their middle, less at the world's edges. */
export function tilesAround([lng, lat]: LngLat, z: number, across: number, down: number): Tile[] {
  const count = 2 ** z;
  const column = ((lng + 180) / 360) * count;
  const row = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * count;
  const tiles: Tile[] = [];
  for (let y = Math.round(row - down / 2); y < Math.round(row - down / 2) + down; y++) {
    for (let x = Math.round(column - across / 2); x < Math.round(column - across / 2) + across; x++) {
      if (x >= 0 && y >= 0 && x < count && y < count) tiles.push({ z, x, y });
    }
  }
  return tiles;
}

/** How many levels coarser than the one a place is seen at a map at a tilt draws toward the horizon. */
const COARSER = 4;
/** How many tiles a side are taken of a coarser level, and around each place a finer one is taken at. */
const RING = 4;
/**
 * Where a steep map draws the levels finer than the one a place is seen at: along the way from the place to the
 * ground at the view's foot and past it, as parts of that way, the finest last.
 */
const FINER: readonly (readonly number[])[] = [
  [0.6, 0.9, 1.2],
  [0.9, 1.2, 1.5],
];

/**
 * The tiles a map seen at a tilt draws of a place, for tiles `tileSize` pixels wide of which level `base` is the
 * one the place is seen at: that level over the whole view, `size` pixels, a few of each coarser one around the
 * place, and where the map is `steep` those of the finer ones toward `near`, the ground at the view's foot.
 */
export function tilesInView(center: LngLat, near: LngLat, base: number, steep: boolean, size: { width: number; height: number }, tileSize: number): Tile[] {
  const tiles = new Map<string, Tile>();
  const take = (taken: Tile[]) => taken.forEach((tile) => tiles.set(`${tile.z}/${tile.x}/${tile.y}`, tile));
  take(tilesAround(center, base, Math.ceil(size.width / tileSize) + 1, Math.ceil(size.height / tileSize) + 1));
  for (let z = base - 1; z >= base - COARSER && z >= 0; z--) take(tilesAround(center, z, RING, RING));
  if (steep) FINER.forEach((parts, finer) => parts.forEach((part) => take(tilesAround([center[0] + (near[0] - center[0]) * part, center[1] + (near[1] - center[1]) * part], base + finer + 1, RING, RING))));
  return [...tiles.values()];
}

/** Half the angle a map's camera sees, top to foot, and how far it is from what it looks at, in heights of the view. */
const HALF_SIGHT = (18.435 * Math.PI) / 180;
const CAMERA_AWAY = 1.5;

/**
 * The ground at the middle of the foot of a view `height` pixels high that shows `center`, `raised` pixels over its
 * middle, at a zoom, a pitch and a bearing in degrees.
 */
export function groundAtFoot([lng, lat]: LngLat, zoom: number, pitch: number, bearing: number, height: number, raised = 0): LngLat {
  const tilt = (pitch * Math.PI) / 180;
  const away = CAMERA_AWAY * height;
  const pixels = away * Math.cos(tilt) * (Math.tan(tilt + Math.atan(raised / away)) - Math.tan(tilt - HALF_SIGHT));
  const degrees = (pixels * 360) / (512 * 2 ** zoom);
  const back = ((bearing + 180) * Math.PI) / 180;
  // A degree of latitude is as long on the map as one of longitude is at the equator, shorter by the latitude's cosine on the ground.
  return [lng + degrees * Math.sin(back), lat + degrees * Math.cos(back) * Math.cos((lat * Math.PI) / 180)];
}
