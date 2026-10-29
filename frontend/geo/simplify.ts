import type { LngLat } from '../model/trip';
import { planeAt } from './measure';
import { fractionOnSegment } from './nearest';

/** Below this tolerance in metres no point of a track is worth keeping: the noise of a receiver. */
const MIN_TOLERANCE_M = 5;

/**
 * The tolerance in metres up to which Douglas–Peucker keeps each point of a line, splitting
 * no stretch whose farthest point lies within the minimum tolerance. The ends are kept at
 * any tolerance; another point is kept while the tolerance stays below its distance from
 * the line between the points that split its stretch, and below theirs. Points within the
 * minimum get 0.
 */
export function keepTolerances(points: readonly LngLat[]): Float64Array {
  if (points.length === 0) return new Float64Array(0);
  const xy = points.map(planeAt(points[0]!));
  const upTo = new Float64Array(points.length);
  upTo[0] = upTo[points.length - 1] = Infinity;
  // A stack of index ranges rather than recursion, for tracks of many thousand points.
  const stack: [number, number, number][] = [[0, points.length - 1, Infinity]];
  while (stack.length > 0) {
    const [first, last, ends] = stack.pop()!;
    const a = xy[first]!;
    const b = xy[last]!;
    let farthest = -1;
    let max2 = MIN_TOLERANCE_M * MIN_TOLERANCE_M;
    for (let i = first + 1; i < last; i++) {
      const p = xy[i]!;
      const t = fractionOnSegment(p, a, b);
      const distance2 = (p[0] - (a[0] + t * (b[0] - a[0]))) ** 2 + (p[1] - (a[1] + t * (b[1] - a[1]))) ** 2;
      if (distance2 > max2) {
        max2 = distance2;
        farthest = i;
      }
    }
    if (farthest < 0) continue;
    const kept = Math.min(Math.sqrt(max2), ends);
    upTo[farthest] = kept;
    stack.push([first, farthest, kept], [farthest, last, kept]);
  }
  return upTo;
}

