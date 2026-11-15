import { METRES_PER_DEGREE, metresAlong, planeAt } from '../geo/measure';
import { fractionOnSegment, type XY } from '../geo/nearest';
import type { LngLat } from '../model/trip';
import { metresAt, nearestWithin } from './delta';
import type { RecordedTrack } from './track';

/**
 * A ridden section: a stretch of road marked on a recording, from where it starts to
 * where it ends, in the direction it was ridden. A line rides it where it passes its start
 * and follows it to its end, in that direction.
 */

/** How far from the section a line may run and still be on it, in metres: a ride's line is thinned to 10 m, and GPS wavers. */
const REACH_M = 50;
/** How far apart the section is checked, in metres. */
const STEP_M = 50;
/** How far ahead along the line the next check of the section is looked for, in metres. */
const AHEAD_M = 300;

/** The line's points every `step` metres along it, its ends included. */
function resampled(line: readonly XY[], step: number): XY[] {
  const out: XY[] = [line[0]!];
  let carried = 0;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1]!, line[i]!];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let next = step - carried;
    while (next <= length) {
      const t = next / length;
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      next += step;
    }
    carried = length - (next - step);
  }
  const last = line[line.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** A place on a line: metres along it, on its segment `segment` the fraction `t` of the way. */
type Along = { metres: number; segment: number; t: number };

/** Each place where the line passes within REACH_M of p, the nearest of each pass, in the line's order. */
function passes(p: XY, line: readonly XY[], along: Float64Array): Along[] {
  const found: (Along & { distance: number })[] = [];
  let open = false;
  for (let s = 0; s < line.length - 1; s++) {
    const [a, b] = [line[s]!, line[s + 1]!];
    const t = fractionOnSegment(p, a, b);
    const distance = Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
    if (distance > REACH_M) {
      open = false;
      continue;
    }
    const place = { metres: metresAt(along, s, t), segment: s, t, distance };
    if (!open) found.push(place);
    else if (distance < found[found.length - 1]!.distance) found[found.length - 1] = place;
    open = true;
  }
  return found;
}

/** What a section is checked by, worked out once for it: the plane around its start, its samples on it, and the box around its start that a line passing it comes into. */
interface Prepared {
  plane: (p: LngLat) => XY;
  start: XY;
  rest: XY[];
  box: [west: number, south: number, east: number, north: number];
}

const prepared = new WeakMap<readonly LngLat[], Prepared>();

function prepare(section: readonly LngLat[]): Prepared {
  let done = prepared.get(section);
  if (!done) {
    const plane = planeAt(section[0]!);
    const [start, ...rest] = resampled(section.map(plane), STEP_M);
    const [lng, lat] = section[0]!;
    const dLat = REACH_M / METRES_PER_DEGREE;
    const dLng = dLat / Math.cos((lat * Math.PI) / 180);
    done = { plane, start: start!, rest, box: [lng - dLng, lat - dLat, lng + dLng, lat + dLat] };
    prepared.set(section, done);
  }
  return done;
}

/** Whether a segment of the line comes into the box: a test without measuring that rules out most lines before they are projected. */
function entersBox(line: readonly LngLat[], [west, south, east, north]: Prepared['box']): boolean {
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1]!, line[i]!];
    if (Math.max(a[0], b[0]) >= west && Math.min(a[0], b[0]) <= east && Math.max(a[1], b[1]) >= south && Math.min(a[1], b[1]) <= north) return true;
  }
  return false;
}

/**
 * Where the line rides the section: metres along the line from where it passes the
 * section's start to where it reaches its end, having followed it all the way in its
 * direction, and the first and last of the line's points of that stretch; undefined
 * where it does not. Of several passes the first that rides it.
 */
export function sectionOn(line: readonly LngLat[], section: readonly LngLat[]): { fromM: number; toM: number; first: number; last: number } | undefined {
  if (line.length < 2 || section.length < 2) return undefined;
  const { plane, start, rest, box } = prepare(section);
  if (!entersBox(line, box)) return undefined;
  const xy = line.map(plane);
  const along = metresAlong(line);
  for (const pass of passes(start, xy, along)) {
    let at: Along = pass;
    const followed = rest.every((p) => {
      const place = nearestWithin(p, xy, along, at.metres - REACH_M, at.metres + AHEAD_M, at.segment);
      if (!place || place.distance > REACH_M) return false;
      at = { metres: metresAt(along, place.segment, place.t), segment: place.segment, t: place.t };
      return true;
    });
    // The points at or before the start and at or after the end: a place at a segment's very end is at its next point.
    if (followed && at.metres > pass.metres) return { fromM: pass.metres, toM: at.metres, first: pass.t < 1 ? pass.segment : pass.segment + 1, last: at.t > 0 ? at.segment + 1 : at.segment };
  }
  return undefined;
}

/** The part of a recording that rides the section, with its values; undefined where it does not ride it. */
export function trackOnSection(track: RecordedTrack, section: readonly LngLat[]): RecordedTrack | undefined {
  const on = sectionOn(track.points, section);
  if (!on) return undefined;
  const slice = <T,>(values: readonly T[]) => values.slice(on.first, on.last + 1);
  return { ...track, points: slice(track.points), series: Object.fromEntries(Object.entries(track.series).map(([name, values]) => [name, slice(values)])) };
}
