import type { LngLat } from '../model/trip';
import { METRES_PER_DEGREE } from './measure';

/** What positions take up on a map turned to a bearing: the middle of it, and how wide and how high it is on that map, in metres. */
export interface Frame {
  center: LngLat;
  width: number;
  height: number;
}

/**
 * The frame positions lie in on a map turned so that `bearing` degrees from north is up.
 * A box of longitudes and latitudes turned afterwards is larger than this wherever the
 * positions run aslant.
 */
export function frameOf(positions: readonly LngLat[], bearing: number): Frame {
  const [lng0, lat0] = positions[0]!;
  const scale = Math.cos((lat0 * Math.PI) / 180) * METRES_PER_DEGREE;
  const turn = (bearing * Math.PI) / 180;
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  let [left, right, bottom, top] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [lng, lat] of positions) {
    const [x, y] = [(lng - lng0) * scale, (lat - lat0) * METRES_PER_DEGREE];
    const [across, up] = [x * cos - y * sin, x * sin + y * cos];
    [left, right, bottom, top] = [Math.min(left, across), Math.max(right, across), Math.min(bottom, up), Math.max(top, up)];
  }
  const [across, up] = [(left + right) / 2, (bottom + top) / 2];
  return { center: [lng0 + (across * cos + up * sin) / scale, lat0 + (up * cos - across * sin) / METRES_PER_DEGREE], width: right - left, height: top - bottom };
}

/** The metres a pixel of the map is at zoom 0 on the equator, with the map's tiles of 512 pixels. */
const METRES_PER_PIXEL = 78271.517;

/** The zoom at which a frame fills a box of pixels on the map, around the frame's latitude. */
export function zoomToFit(frame: Frame, box: { width: number; height: number }): number {
  const metresPerPixel = Math.max(frame.width / box.width, frame.height / box.height, 0.01);
  return Math.log2((METRES_PER_PIXEL * Math.cos((frame.center[1] * Math.PI) / 180)) / metresPerPixel);
}
