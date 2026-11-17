import { planeAt } from '../geo/measure';
import { fractionOnSegment } from '../geo/nearest';
import type { LngLat } from '../model/trip';

/**
 * How far a route's point may lie from the way calculated for the route as a whole for
 * the way to count as the route's: farther, the points were changed after it was
 * calculated. Planners snap a point to the road, so a point lies some metres beside it.
 */
const BESIDE_M = 100;

/** Within this of the way, a point lies where the way first comes by it, not where it passes again on a round. */
const AT_M = 50;

/**
 * The way calculated for a route as a whole, cut at the route's points: for each point
 * the way's points from it on to the next, none for the last, as a file gives them that
 * has the way point by point. Each point lies on the way after the one before it. No
 * ways at all where a point is not beside the way, or there is no way.
 */
export function waysAlong(points: readonly LngLat[], way: readonly LngLat[]): LngLat[][] {
  const none = points.map((): LngLat[] => []);
  if (points.length < 2 || way.length < 2) return none;
  // The segment of the way each point lies on, by the segment's first point.
  const cuts: number[] = [];
  let from = 0;
  for (const point of points) {
    const toPlane = planeAt(point);
    let [at, nearest] = [from, Infinity];
    for (let i = from; i < way.length - 1; i++) {
      const [a, b] = [toPlane(way[i]!), toPlane(way[i + 1]!)];
      const t = fractionOnSegment([0, 0], a, b);
      const distance = Math.hypot(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
      if (distance < nearest) [at, nearest] = [i, distance];
      else if (nearest <= AT_M && distance > AT_M) break;
    }
    if (nearest > BESIDE_M) return none;
    cuts.push(at);
    from = at;
  }
  return points.map((_, i) => (i === points.length - 1 ? [] : way.slice(cuts[i]! + 1, cuts[i + 1]! + 1)));
}
