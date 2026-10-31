import { metresAlong } from '../geo/measure';
import type { RecordedTrack } from './track';

/** What a recording shows per point, as far as its file allows; values are null where a point lacks one. */
export interface Measures {
  /** Metres from the start along the track. */
  distance: Float64Array;
  /** Milliseconds since the epoch. */
  time?: (number | null)[];
  /** km/h: the file's own speed, or from time and distance. */
  speed?: (number | null)[];
  /** Metres, where the file has heights other than zero. */
  altitude?: (number | null)[];
  /** Per cent, over 100 m of track around the point. */
  slope?: (number | null)[];
  /** Degrees, signed as the file writes them, where it writes any other than zero. */
  lean?: (number | null)[];
}

/** The measures a track can be coloured by and charted. */
export type Metric = 'speed' | 'altitude' | 'slope' | 'lean';

const someNonZero = (values: (number | null)[] | undefined): values is (number | null)[] => !!values?.some((v) => v !== null && v !== 0);

/** Below this speed the rider is standing, for the moving time and the average speed. */
const STANDING_KMH = 3;

/** Half the stretch of track a slope is measured over, so that a few metres of height noise do not read as a wall. */
const SLOPE_HALF_SPAN_M = 50;

/** Speed in km/h from time and distance, over the points two before and after, where both have a time. */
function speedFromTime(distance: Float64Array, time: (number | null)[]): (number | null)[] {
  return time.map((_, i) => {
    const a = Math.max(0, i - 2);
    const b = Math.min(time.length - 1, i + 2);
    const ta = time[a];
    const tb = time[b];
    return ta !== null && ta !== undefined && tb !== null && tb !== undefined && tb > ta ? ((distance[b]! - distance[a]!) / ((tb - ta) / 1000)) * 3.6 : null;
  });
}

/** The slope at each point between the heights SLOPE_HALF_SPAN_M before and after it, or as far as the track goes. */
function slopeOf(distance: Float64Array, altitude: (number | null)[]): (number | null)[] {
  let back = 0;
  let ahead = 0;
  return altitude.map((_, i) => {
    while (distance[i]! - distance[back + 1]! >= SLOPE_HALF_SPAN_M) back++;
    while (ahead < altitude.length - 1 && distance[ahead]! - distance[i]! < SLOPE_HALF_SPAN_M) ahead++;
    const from = altitude[back];
    const to = altitude[ahead];
    const span = distance[ahead]! - distance[back]!;
    return from !== null && from !== undefined && to !== null && to !== undefined && span >= SLOPE_HALF_SPAN_M ? ((to - from) / span) * 100 : null;
  });
}

/** The measures of a track: its distance along, and what its file measured or allows to work out. */
export function measuresOf(track: RecordedTrack): Measures {
  const distance = metresAlong(track.points);
  const { time, ele, speed, lean_angle: lean } = track.series;
  const altitude = someNonZero(ele) ? ele : undefined;
  return {
    distance,
    time,
    // GPX's and the apps' speeds are metres per second.
    speed: speed ? speed.map((v) => (v === null ? null : v * 3.6)) : time ? speedFromTime(distance, time) : undefined,
    altitude,
    slope: altitude ? slopeOf(distance, altitude) : undefined,
    lean: someNonZero(lean) ? lean : undefined,
  };
}

/** A recording in figures. */
export interface Summary {
  distanceM: number;
  /** From the first time to the last, and the part of it spent moving; where the file has times. */
  durationS?: number;
  movingS?: number;
  /** km/h while moving, and the highest. */
  averageSpeed?: number;
  maxSpeed?: number;
  /** Metres climbed and descended, and the lowest and highest point. */
  ascentM?: number;
  descentM?: number;
  minAltitude?: number;
  maxAltitude?: number;
  /** The furthest lean to either side, in the file's signs. */
  leanRange?: [number, number];
}

/** Height changes smaller than this are noise: climb and descent count from the last turn by more. */
const CLIMB_THRESHOLD_M = 3;

const numbers = (values: (number | null)[]): number[] => values.filter((v): v is number => v !== null);

/** Metres climbed and descended, a change counted once it exceeds CLIMB_THRESHOLD_M from the last turning point. */
function climb(altitude: (number | null)[]): { ascent: number; descent: number } {
  let ascent = 0;
  let descent = 0;
  let reference: number | undefined;
  for (const value of numbers(altitude)) {
    if (reference === undefined) reference = value;
    else if (value - reference >= CLIMB_THRESHOLD_M) {
      ascent += value - reference;
      reference = value;
    } else if (reference - value >= CLIMB_THRESHOLD_M) {
      descent += reference - value;
      reference = value;
    }
  }
  return { ascent, descent };
}

/** Moving time in seconds: the time between points where the rider went faster than STANDING_KMH on average of both ends. */
function movingSeconds(m: Measures): number | undefined {
  if (!m.time || !m.speed) return undefined;
  let moving = 0;
  for (let i = 1; i < m.time.length; i++) {
    const [t0, t1, v0, v1] = [m.time[i - 1], m.time[i], m.speed[i - 1], m.speed[i]];
    if (t0 === null || t0 === undefined || t1 === null || t1 === undefined || v0 === null || v0 === undefined || v1 === null || v1 === undefined) continue;
    if ((v0 + v1) / 2 > STANDING_KMH) moving += (t1 - t0) / 1000;
  }
  return moving;
}

export function summaryOf(m: Measures): Summary {
  const distanceM = m.distance.at(-1) ?? 0;
  const times = m.time ? numbers(m.time) : [];
  const durationS = times.length > 1 ? (times.at(-1)! - times[0]!) / 1000 : undefined;
  const movingS = movingSeconds(m);
  const speeds = m.speed ? numbers(m.speed) : [];
  const moving = speeds.filter((v) => v > STANDING_KMH);
  const averageSpeed = movingS ? (distanceM / movingS) * 3.6 : moving.length > 0 ? moving.reduce((a, b) => a + b, 0) / moving.length : undefined;
  const heights = m.altitude ? numbers(m.altitude) : [];
  const leans = m.lean ? numbers(m.lean) : [];
  const { ascent, descent } = m.altitude ? climb(m.altitude) : { ascent: undefined, descent: undefined };
  return {
    distanceM,
    durationS,
    movingS,
    averageSpeed,
    maxSpeed: speeds.length > 0 ? Math.max(...speeds) : undefined,
    ascentM: ascent,
    descentM: descent,
    minAltitude: heights.length > 0 ? Math.min(...heights) : undefined,
    maxAltitude: heights.length > 0 ? Math.max(...heights) : undefined,
    leanRange: leans.length > 0 ? [Math.min(...leans), Math.max(...leans)] : undefined,
  };
}

/** How far the track went with each value of a measure, in bins of `width` from the lowest: kilometres per bin. */
export function histogram(m: Measures, values: (number | null)[], width: number): { from: number[]; km: number[] } {
  const present = numbers(values);
  if (present.length === 0) return { from: [], km: [] };
  const first = Math.floor(Math.min(...present) / width) * width;
  const bins = Math.floor((Math.max(...present) - first) / width) + 1;
  const km = new Array<number>(bins).fill(0);
  for (let i = 1; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    km[Math.floor((value - first) / width)]! += (m.distance[i]! - m.distance[i - 1]!) / 1000;
  }
  return { from: km.map((_, i) => first + i * width), km };
}
