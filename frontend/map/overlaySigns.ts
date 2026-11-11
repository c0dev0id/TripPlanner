import type { ExpressionSpecification } from 'maplibre-gl';
import { svgImage, type MapImage } from './mapImages';

/**
 * What the overlays draw with: sizes that keep pace with the roads of the base map under
 * them, and road signs as map images.
 */

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

/** `sizeAt` as a style expression of the zoom. */
export const byZoom = (far: number, mid: number, near: number, ofRoad: number, sharpUntil: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...ZOOMS.flatMap((zoom) => [zoom, sizeAt(zoom, far, mid, near, ofRoad, sharpUntil)]),
];

/** A sign's side in CSS pixels at icon size 1, and the pixels it is drawn with for each: it is shown several times that size over a base map blown up. */
const SIGN_SIZE = 28;
const SIGN_PIXEL_RATIO = 6;

/** A sign drawn in a box of 28 × 28, as a map image. */
export const sign = (drawing: string): MapImage => svgImage(SIGN_SIZE, SIGN_PIXEL_RATIO, drawing);

/** A sign's icon size: growing a little with the zoom, and 1.3 times as wide as a road blown up. */
export const signSize = (sharpUntil: number): ExpressionSpecification => byZoom(0.7, 1, 1.4, 1.3 / SIGN_SIZE, sharpUntil);

export const SIGN_RED = '#d0021b';

/** The red ring of a prohibition sign; alone, the sign for a road closed to all vehicles. */
export const RING = `<circle cx="14" cy="14" r="11.5" fill="#fff" stroke="${SIGN_RED}" stroke-width="4"/>`;
