import type { ExpressionSpecification } from 'maplibre-gl';

/** Sizes of what is drawn over the base map that keep pace with the roads under it as the map is zoomed. */

/** The zooms sizes are worked out for, up to the map's last; between them they are interpolated. */
const ZOOMS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

/** About how wide a country road is drawn at the zooms a base map is sharp at, in CSS pixels. */
const ROAD_PX = 12;

/**
 * A size at a zoom that does not fall behind the roads under it: `far` at zoom 10 and
 * below, `mid` at 14, `near` from 18 on, and at least `ofRoad` times the width of a road
 * beyond `sharpUntil`, where a base map of raster tiles is blown up and its roads double
 * with every zoom; Infinity for a base map sharp at every zoom.
 */
export function sizeAt(zoom: number, far: number, mid: number, near: number, ofRoad: number, sharpUntil: number): number {
  const own = zoom <= 14 ? far + ((mid - far) * Math.max(zoom - 10, 0)) / 4 : mid + ((near - mid) * Math.min(zoom - 14, 4)) / 4;
  const road = zoom <= sharpUntil ? 0 : ROAD_PX * 2 ** (zoom - sharpUntil);
  return Math.max(own, ofRoad * road);
}

/** A style expression of the zoom that has the value `of` gives at each of the zooms, a number or an expression for one. */
export const atZooms = (of: (zoom: number) => number | ExpressionSpecification): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], ...ZOOMS.flatMap((zoom) => [zoom, of(zoom)])];

/** `sizeAt` as a style expression of the zoom. */
export const byZoom = (far: number, mid: number, near: number, ofRoad: number, sharpUntil: number): ExpressionSpecification =>
  atZooms((zoom) => sizeAt(zoom, far, mid, near, ofRoad, sharpUntil));
