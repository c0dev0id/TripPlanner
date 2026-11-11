import type { ExpressionSpecification } from 'maplibre-gl';
import { svgImage, type MapImage } from './mapImages';
import { byZoom } from './zoomSize';

/** The road signs the overlays draw with, as map images. */

/** A sign's side in CSS pixels at icon size 1, and the pixels it is drawn with for each: it is shown several times that size over a base map blown up. */
const SIGN_SIZE = 28;
const SIGN_PIXEL_RATIO = 6;

/** A sign drawn in a box of 28 × 28, as a map image. */
export const sign = (drawing: string): MapImage => svgImage(SIGN_SIZE, SIGN_PIXEL_RATIO, drawing);

/** A sign's icon size: growing a little with the zoom, and a good two times as wide as a road blown up, so that it stands clear of the line drawn along that road. */
export const signSize = (sharpUntil: number): ExpressionSpecification => byZoom(0.7, 1, 1.4, 2.2 / SIGN_SIZE, sharpUntil);

export const SIGN_RED = '#d0021b';
/** The colour of a sign and a line for what is yet to begin. */
export const SIGN_GREY = '#868e96';

/** The ring of a prohibition sign, red on the road; alone, the sign for a road closed to all vehicles. */
export const ring = (color: string): string => `<circle cx="14" cy="14" r="11.5" fill="#fff" stroke="${color}" stroke-width="4"/>`;
