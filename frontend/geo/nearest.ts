/** A point in a plane, such as screen pixels. */
export type XY = readonly [number, number];

/** How far along the segment a–b its point closest to p lies: 0 at a, 1 at b. */
export function fractionOnSegment(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  return length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2));
}

/** Where a point lies nearest on lines: which line, which of its segments and how far along it, how far from p, and the point. */
export interface NearestPlace {
  index: number;
  segment: number;
  t: number;
  distance: number;
  point: XY;
}

/** Segments per block: a query passes over a block whose bounding box lies farther away than the nearest place found so far. */
const BLOCK = 32;

/**
 * The lines prepared for queries of the place nearest to a point, up to `within` away.
 * Lines are polylines; a line of one point has it as its only place. Of places equally
 * near, the one on the earliest line and segment wins. Undefined when none is within reach.
 */
export function nearestOnLines(lines: readonly (readonly XY[])[]): (p: XY, within?: number) => NearestPlace | undefined {
  // Every segment in line order as its two ends; a line of one point is a segment of no length.
  const count = lines.reduce((sum, line) => sum + (line.length === 1 ? 1 : Math.max(0, line.length - 1)), 0);
  const ends = new Float64Array(count * 4);
  const lineOf = new Int32Array(count);
  const segmentOf = new Int32Array(count);
  let s = 0;
  lines.forEach((line, index) => {
    const single = line.length === 1;
    for (let i = single ? 0 : 1; i < line.length; i++, s++) {
      const [a, b] = [line[single ? 0 : i - 1]!, line[i]!];
      ends.set([a[0], a[1], b[0], b[1]], s * 4);
      lineOf[s] = index;
      segmentOf[s] = single ? 0 : i - 1;
    }
  });
  const blocks = Math.ceil(count / BLOCK);
  const boxes = new Float64Array(blocks * 4);
  for (let b = 0; b < blocks; b++) {
    const [first, last] = [b * BLOCK * 4, Math.min(count, (b + 1) * BLOCK) * 4];
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = first; i < last; i += 2) {
      [minX, maxX] = [Math.min(minX, ends[i]!), Math.max(maxX, ends[i]!)];
      [minY, maxY] = [Math.min(minY, ends[i + 1]!), Math.max(maxY, ends[i + 1]!)];
    }
    boxes.set([minX, minY, maxX, maxY], b * 4);
  }

  return (p, within = Infinity) => {
    const [x, y] = p;
    const gap = (b: number) => Math.hypot(Math.max(boxes[b * 4]! - x, 0, x - boxes[b * 4 + 2]!), Math.max(boxes[b * 4 + 1]! - y, 0, y - boxes[b * 4 + 3]!));
    let best = -1;
    let bestDistance = within;
    let bestT = 0;
    const scan = (b: number) => {
      for (let s = b * BLOCK; s < Math.min(count, (b + 1) * BLOCK); s++) {
        const [ax, ay, bx, by] = [ends[s * 4]!, ends[s * 4 + 1]!, ends[s * 4 + 2]!, ends[s * 4 + 3]!];
        const t = fractionOnSegment(p, [ax, ay], [bx, by]);
        const distance = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
        if (distance < bestDistance || (distance === bestDistance && (best === -1 || s < best))) [best, bestDistance, bestT] = [s, distance, t];
      }
    };
    // The block whose box is nearest first, so that a near place rules out most others.
    let first = -1;
    for (let b = 0, firstGap = within; b < blocks; b++) {
      const g = gap(b);
      if (g < firstGap || (first === -1 && g === firstGap)) [first, firstGap] = [b, g];
    }
    if (first === -1) return undefined;
    scan(first);
    for (let b = 0; b < blocks; b++) if (b !== first && gap(b) <= bestDistance) scan(b);
    if (best === -1) return undefined;
    const [ax, ay, bx, by] = ends.subarray(best * 4, best * 4 + 4) as unknown as [number, number, number, number];
    return { index: lineOf[best]!, segment: segmentOf[best]!, t: bestT, distance: bestDistance, point: [ax + bestT * (bx - ax), ay + bestT * (by - ay)] };
  };
}

/** The place on the lines nearest to p, up to `within` away; see nearestOnLines. */
export function nearestLine(lines: readonly (readonly XY[])[], p: XY, within?: number): NearestPlace | undefined {
  return nearestOnLines(lines)(p, within);
}
