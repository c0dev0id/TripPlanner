import type { StyleSpecification } from 'maplibre-gl';
import { groundAtFoot, tilesInView } from '../geo/tiles';
import type { LngLat } from '../model/trip';

/** How many tiles are asked for at a time, so that the map's own requests are not kept waiting. */
const AT_ONCE = 6;

/** From which pitch on, in degrees, a map draws finer tiles under the eye than where it looks. */
const STEEP = 60;

/**
 * The addresses of the tiles a style's raster sources draw of a view of `size` pixels that shows its centre off its middle by `offset`. A picture is seen at the
 * level its tiles' size says; the ground's heights are drawn a level coarser.
 */
export function tileUrls(sources: StyleSpecification['sources'], view: { center: LngLat; zoom: number; pitch: number; bearing: number; offset: [number, number] }, size: { width: number; height: number }): string[] {
  const near = groundAtFoot(view.center, view.zoom, view.pitch, view.bearing, size.height, -view.offset[1]);
  return Object.values(sources).flatMap((source) => {
    if ((source.type !== 'raster' && source.type !== 'raster-dem') || !source.tiles?.[0]) return [];
    const tileSize = source.tileSize ?? 512;
    const base = Math.round(view.zoom + Math.log2(512 / tileSize)) - (source.type === 'raster' ? 0 : 1);
    const address = source.tiles[0];
    return tilesInView(view.center, near, base, view.pitch >= STEEP, size, tileSize)
      .filter((tile) => tile.z >= (source.minzoom ?? 0) && tile.z <= (source.maxzoom ?? 22))
      .map((tile) => address.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y)));
  });
}

const asked = new Set<string>();
let waiting: string[] = [];
let running = 0;

function next(): void {
  while (running < AT_ONCE && waiting.length > 0) {
    const url = waiting.shift()!;
    asked.add(url);
    running++;
    // Read to its end, so that the browser keeps it; a tile that fails is the map's to ask for again.
    fetch(url, { priority: 'low' })
      .then((response) => response.arrayBuffer())
      .catch(() => undefined)
      .finally(() => {
        running--;
        next();
      });
  }
}

/** Fetches what was not fetched yet into the browser's cache, a few at a time, in place of what still waited from the call before. */
export function preload(urls: readonly string[]): void {
  // Not for a reader who asked the browser to save data.
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  waiting = [...new Set(urls)].filter((url) => !asked.has(url));
  next();
}
