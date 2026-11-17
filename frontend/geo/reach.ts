import type { LngLat } from '../model/trip';
import { distanceBetween, planeAt } from './measure';
import { nearestOnLines, type XY } from './nearest';

/** The place on lines that is nearest to a position as the crow flies, and how far that is; none where there is no line. */
export function nearestPlace(from: LngLat, lines: readonly (readonly LngLat[])[]): { at: LngLat; metres: number } | undefined {
  const toPlane = planeAt(from);
  const hit = nearestOnLines(lines.map((line) => line.map(toPlane)))(toPlane(from));
  if (!hit) return undefined;
  const line = lines[hit.index]!;
  const a = line[hit.segment]!;
  const b = line[Math.min(hit.segment + 1, line.length - 1)]!;
  const at: LngLat = [a[0] + hit.t * (b[0] - a[0]), a[1] + hit.t * (b[1] - a[1])];
  return { at, metres: distanceBetween(from, at) };
}

/** The part of the segment a–b that lies in the box from the origin to `width` by `height`; none where it passes outside. */
export function partInBox(a: XY, b: XY, width: number, height: number): [XY, XY] | undefined {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  let [enters, leaves] = [0, 1];
  // Each edge as how fast the segment nears it and how far inside a lies.
  for (const [speed, inside] of [
    [-dx, a[0]],
    [dx, width - a[0]],
    [-dy, a[1]],
    [dy, height - a[1]],
  ] as const) {
    if (speed === 0) {
      if (inside < 0) return undefined;
    } else if (speed < 0) enters = Math.max(enters, inside / speed);
    else leaves = Math.min(leaves, inside / speed);
  }
  if (enters > leaves) return undefined;
  return [
    [a[0] + enters * dx, a[1] + enters * dy],
    [a[0] + leaves * dx, a[1] + leaves * dy],
  ];
}
