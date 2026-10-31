import { metresAlong, planeAt } from '../geo/measure';
import { fractionOnSegment, nearestOnLines, type XY } from '../geo/nearest';
import type { LngLat } from '../model/trip';
import type { Measures } from './measures';

/** A point farther than this from the other line is off it: within it, GPS and the road's width keep to the same way. */
export const ON_LINE_M = 50;

/**
 * How far along the other track a point's place is looked for first: ahead of the
 * farthest place reached, and a little behind it for GPS that wavers back. Measured from
 * the farthest, so that a turn back along the same road cannot slide back along the way out.
 */
const LOOK_AHEAD_M = 1000;
const LOOK_BACK_M = 30;

/** How a track compares with another line, point by point. */
export interface Delta {
  /** Metres from each point to the other line. */
  offset: number[];
  /** Seconds the track took from the first place both passed, less what the other took to the same place: behind where positive. */
  time?: (number | null)[];
  /** km/h faster than the other at the same place. */
  speed?: (number | null)[];
  /** Degrees leaned further than the other at the same place, to whichever side. */
  lean?: (number | null)[];
}

/** The distance from each point to the nearest of the lines, in metres. */
export function offsetsFrom(points: readonly LngLat[], lines: readonly (readonly LngLat[])[]): number[] {
  if (points.length === 0) return [];
  const plane = planeAt(points[0]!);
  const nearest = nearestOnLines(lines.map((line) => line.map(plane)));
  return points.map((point) => nearest(plane(point))?.distance ?? Infinity);
}

/** A place on a line: on its segment `segment`, the fraction `t` of the way along it, `distance` from the point it was found for. */
type Place = { segment: number; t: number; distance: number };

/** The place on the line nearest p between `from` and `to` metres along it; `segment` is one of the line's segments within that stretch or after it. */
function nearestWithin(p: XY, line: readonly XY[], along: Float64Array, from: number, to: number, segment: number): Place | undefined {
  let s = segment;
  while (s > 0 && along[s]! > from) s--;
  let best: Place | undefined;
  for (; s < line.length - 1 && along[s]! <= to; s++) {
    const length = along[s + 1]! - along[s]!;
    const [a, b] = [line[s]!, line[s + 1]!];
    const t = length > 0 ? Math.min(Math.max(fractionOnSegment(p, a, b), (from - along[s]!) / length), (to - along[s]!) / length) : 0;
    if (t < 0 || t > 1 || along[s]! + t * length < from) continue;
    const distance = Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
    if (!best || distance < best.distance) best = { segment: s, t, distance };
  }
  return best;
}

/**
 * Where each point lies on the other track: its metres along it, or null where it is off
 * it; and its distance from it. A point's place is looked for ahead of the place before
 * it, so that a loop, a lap or the way back is not taken for the way on; anywhere only
 * where the track left the other and comes back.
 */
export function alignAlong(points: readonly LngLat[], other: readonly LngLat[]): { along: (number | null)[]; offset: number[] } {
  if (points.length === 0 || other.length === 0) return { along: points.map(() => null), offset: points.map(() => Infinity) };
  const plane = planeAt(points[0]!);
  const line = other.map(plane);
  const otherAlong = metresAlong(other);
  const anywhere = nearestOnLines([line]);
  const along: (number | null)[] = [];
  const offset: number[] = [];
  /** The farthest place reached along the other, and the segment it lies on. */
  let reached: { metres: number; segment: number } | undefined;
  for (const point of points) {
    const p = plane(point);
    let place = reached && nearestWithin(p, line, otherAlong, reached.metres - LOOK_BACK_M, reached.metres + LOOK_AHEAD_M, reached.segment);
    const ahead = place !== undefined && place.distance <= ON_LINE_M;
    if (!ahead) {
      const found = anywhere(p);
      if (found && (!place || found.distance < place.distance)) place = found;
    }
    offset.push(place?.distance ?? Infinity);
    if (!place || place.distance > ON_LINE_M) {
      along.push(null);
      continue;
    }
    const next = Math.min(place.segment + 1, other.length - 1);
    const metres = otherAlong[place.segment]! + place.t * (otherAlong[next]! - otherAlong[place.segment]!);
    along.push(metres);
    // Found ahead, the track moves on; found anywhere else, it joined the other there.
    if (!ahead || !reached || metres > reached.metres) reached = { metres, segment: place.segment };
  }
  return { along, offset };
}

/** A series' value at metres `at` along a track, between the points on either side; null where either lacks one. */
export function valueAt(distance: Float64Array, values: readonly (number | null)[], at: number): number | null {
  let lo = 0;
  let hi = distance.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (distance[mid]! <= at) lo = mid;
    else hi = mid - 1;
  }
  const next = Math.min(lo + 1, distance.length - 1);
  const [a, b] = [values[lo], values[next]];
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const span = distance[next]! - distance[lo]!;
  return span > 0 ? a + ((b - a) * (at - distance[lo]!)) / span : a;
}

/** A recorded track against another: how far apart, and where on the same way, its time, speed and lean against the other's at the same place. */
export function deltaToTrack(track: { points: readonly LngLat[]; measures: Measures }, other: { points: readonly LngLat[]; measures: Measures }): Delta {
  const { along, offset } = alignAlong(track.points, other.points);
  const against = (mine: (number | null)[] | undefined, theirs: (number | null)[] | undefined) =>
    mine &&
    theirs &&
    along.map((at, i) => {
      const value = mine[i];
      const their = at === null ? null : valueAt(other.measures.distance, theirs, at);
      return value === null || value === undefined || their === null ? null : value - their;
    });
  const clock = against(track.measures.time, other.measures.time);
  const start = clock?.find((v) => v !== null);
  const sideless = (lean: (number | null)[] | undefined) => lean?.map((v) => (v === null ? null : Math.abs(v)));
  return {
    offset,
    time: clock && start !== undefined && start !== null ? clock.map((v) => (v === null ? null : (v - start) / 1000)) : undefined,
    speed: against(track.measures.speed, other.measures.speed),
    lean: against(sideless(track.measures.lean), sideless(other.measures.lean)),
  };
}

/** A comparison in figures. */
export interface DeltaSummary {
  /** Metres of the track off the other line, and the farthest it went from it. */
  offM: number;
  furthestM: number;
  /** Seconds behind (or ahead, negative) at the last place both passed. */
  timeS?: number;
  /** km/h faster on average over the places both passed, by distance. */
  speed?: number;
}

export function deltaSummaryOf(m: Measures, d: Delta): DeltaSummary {
  let offM = 0;
  let sameM = 0;
  let faster = 0;
  for (let i = 1; i < d.offset.length; i++) {
    const metres = m.distance[i]! - m.distance[i - 1]!;
    if (d.offset[i]! > ON_LINE_M) offM += metres;
    const speed = d.speed?.[i];
    if (speed !== null && speed !== undefined) {
      sameM += metres;
      faster += speed * metres;
    }
  }
  const lastTime = d.time?.findLast((v) => v !== null);
  return {
    offM,
    furthestM: d.offset.reduce((far, v) => (Number.isFinite(v) ? Math.max(far, v) : far), 0),
    timeS: lastTime ?? undefined,
    speed: sameM > 0 ? faster / sameM : undefined,
  };
}
