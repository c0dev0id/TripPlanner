import { metresAlong, planeAt } from '../geo/measure';
import { fractionOnSegment, type XY } from '../geo/nearest';
import type { LngLat } from '../model/trip';
import { nearestWithin } from './delta';
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

/** Each place where the line passes within `reach` of p, the nearest of each pass, in the line's order: metres along it and its segment. */
function passes(p: XY, line: readonly XY[], along: Float64Array, reach: number): { metres: number; segment: number }[] {
  const found: { metres: number; segment: number; distance: number }[] = [];
  let open = false;
  for (let s = 0; s < line.length - 1; s++) {
    const [a, b] = [line[s]!, line[s + 1]!];
    const t = fractionOnSegment(p, a, b);
    const distance = Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
    if (distance > reach) {
      open = false;
      continue;
    }
    const place = { metres: along[s]! + t * (along[s + 1]! - along[s]!), segment: s, distance };
    if (!open) found.push(place);
    else if (distance < found[found.length - 1]!.distance) found[found.length - 1] = place;
    open = true;
  }
  return found;
}

/**
 * Where the line rides the section: metres along the line from where it passes the
 * section's start to where it reaches its end, having followed it all the way in its
 * direction; undefined where it does not. Of several passes the first that rides it.
 */
export function sectionOn(line: readonly LngLat[], section: readonly LngLat[], reachM = REACH_M): { fromM: number; toM: number } | undefined {
  if (line.length < 2 || section.length < 2) return undefined;
  const plane = planeAt(section[0]!);
  const xy = line.map(plane);
  const along = metresAlong(line);
  const [start, ...rest] = resampled(section.map(plane), STEP_M);
  for (const pass of passes(start!, xy, along, reachM)) {
    let at = pass;
    const followed = rest.every((p) => {
      const place = nearestWithin(p, xy, along, at.metres - reachM, at.metres + AHEAD_M, at.segment);
      if (!place || place.distance > reachM) return false;
      const next = Math.min(place.segment + 1, line.length - 1);
      at = { metres: along[place.segment]! + place.t * (along[next]! - along[place.segment]!), segment: place.segment };
      return true;
    });
    if (followed && at.metres > pass.metres) return { fromM: pass.metres, toM: at.metres };
  }
  return undefined;
}

/** The part of a recording that rides the section, with its values; undefined where it does not ride it. */
export function trackOnSection(track: RecordedTrack, section: readonly LngLat[]): RecordedTrack | undefined {
  const on = sectionOn(track.points, section);
  if (!on) return undefined;
  const along = metresAlong(track.points);
  let from = 0;
  while (from < along.length - 1 && along[from + 1]! <= on.fromM) from++;
  let to = from;
  while (to < along.length - 1 && along[to]! < on.toM) to++;
  const slice = <T,>(values: readonly T[]) => values.slice(from, to + 1);
  return { ...track, points: slice(track.points), series: Object.fromEntries(Object.entries(track.series).map(([name, values]) => [name, slice(values)])) };
}
