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
  const ends: number[] = [];
  const lineOf: number[] = [];
  const segmentOf: number[] = [];
  lines.forEach((line, index) => {
    const segments = line.length === 1 ? 1 : line.length - 1;
    for (let i = 0; i < segments; i++) {
      const a = line[i]!;
      const b = line[Math.min(i + 1, line.length - 1)]!;
      ends.push(a[0], a[1], b[0], b[1]);
      lineOf.push(index);
      segmentOf.push(i);
    }
  });
  const count = lineOf.length;
  const blocks = Math.ceil(count / BLOCK);
  const boxes = new Float64Array(blocks * 4);
  for (let b = 0; b < blocks; b++) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = b * BLOCK * 4; i < Math.min(count, (b + 1) * BLOCK) * 4; i += 2) {
      minX = Math.min(minX, ends[i]!);
      maxX = Math.max(maxX, ends[i]!);
      minY = Math.min(minY, ends[i + 1]!);
      maxY = Math.max(maxY, ends[i + 1]!);
    }
    boxes.set([minX, minY, maxX, maxY], b * 4);
  }

  return (p, within = Infinity) => {
    const [x, y] = p;
    // Squared distances throughout; the root is taken once, of the answer.
    const reach2 = within * within;
    const gaps = new Float64Array(blocks);
    let first = blocks;
    for (let b = 0; b < blocks; b++) {
      const dx = Math.max(boxes[b * 4]! - x, 0, x - boxes[b * 4 + 2]!);
      const dy = Math.max(boxes[b * 4 + 1]! - y, 0, y - boxes[b * 4 + 3]!);
      gaps[b] = dx * dx + dy * dy;
      if (gaps[b]! <= reach2 && (first === blocks || gaps[b]! < gaps[first]!)) first = b;
    }
    if (first === blocks) return undefined;
    let best = count;
    let best2 = reach2;
    let bestT = 0;
    const scan = (b: number) => {
      for (let s = b * BLOCK; s < Math.min(count, (b + 1) * BLOCK); s++) {
        const ax = ends[s * 4]!;
        const ay = ends[s * 4 + 1]!;
        const bx = ends[s * 4 + 2]!;
        const by = ends[s * 4 + 3]!;
        const t = fractionOnSegment(p, [ax, ay], [bx, by]);
        const dx = x - (ax + t * (bx - ax));
        const dy = y - (ay + t * (by - ay));
        const d2 = dx * dx + dy * dy;
        if (d2 < best2 || (d2 === best2 && s < best)) {
          best = s;
          best2 = d2;
          bestT = t;
        }
      }
    };
    // The block whose box is nearest first, so that a near place rules out most others.
    scan(first);
    for (let b = 0; b < blocks; b++) if (b !== first && gaps[b]! <= best2) scan(b);
    if (best === count) return undefined;
    const [ax, ay, bx, by] = [ends[best * 4]!, ends[best * 4 + 1]!, ends[best * 4 + 2]!, ends[best * 4 + 3]!];
    return { index: lineOf[best]!, segment: segmentOf[best]!, t: bestT, distance: Math.sqrt(best2), point: [ax + bestT * (bx - ax), ay + bestT * (by - ay)] };
  };
}
