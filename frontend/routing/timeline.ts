import type { SequenceEntry } from './sequence';

/**
 * A day's planned times, from the first stop that has a time on: the riding times of the
 * legs, the pauses, and the stops' fixed arrival times. A fixed time is kept as planned;
 * the ride to it is reported as waiting when it gets there early and as short when it
 * would get there late. Each route keeps its own clock: a route whose first stop has a
 * time starts there, whatever the route before ended at. Nothing is corrected, and
 * nothing here is the clock; matching the plan against the ride is a navigation system's
 * job.
 */

export interface EntryTime {
  /** The stop's fixed arrival time where it has one, else as the riding makes it. */
  arrivalMin: number;
  /** After the pause; the arrival itself at a plain route point. */
  departureMin: number;
  /** Whole minutes from the ride's arrival to the fixed time: waiting when positive, short when negative; 0 without one or when it fits. */
  slackMin: number;
}

export interface DayTimeline {
  /** By sequence entry id, from the first stop that has a time on; the entries before it have no times. */
  times: Map<string, EntryTime>;
  /** Leaving the first stop that has a time on, after its pause. */
  departMin: number;
  /** Arrival at the last entry of the day. */
  endMin: number;
  /** Of the whole day. */
  ridingS: number;
  pauseMin: number;
  /** At how many stops the ride falls short of the fixed time. */
  short: number;
}

/** Minutes since midnight of a time of day written as HH:MM. */
function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/**
 * The day's timeline over its riding sequence; none while no stop has a time. An entry's
 * arrival is the last departure plus the riding since; where there is no clock yet, a
 * stop's fixed time starts it. A route whose first stop has a fixed time starts its own
 * clock, set so that the ride from the route's start arrives there on time: the start of
 * a route is never short of its time or waiting for it, since the ride before it was
 * another route's. A route whose first stop has no time goes on from the route before.
 */
export function dayTimeline(sequence: readonly SequenceEntry[]): DayTimeline | undefined {
  const times = new Map<string, EntryTime>();
  const starts = routeStarts(sequence);
  let clock: { min: number; riddenS: number } | undefined;
  let route: number | undefined;
  let departMin: number | undefined;
  let endMin = 0;
  let pauseMin = 0;
  let short = 0;
  for (const entry of sequence) {
    if (entry.routeIndex !== route) {
      route = entry.routeIndex;
      const start = starts.get(route);
      if (start) clock = { min: start.fixedMin - (start.timeS - entry.timeS) / 60, riddenS: entry.timeS };
    }
    const fixedMin = entry.stop?.arriveAt == null ? undefined : minutesOfDay(entry.stop.arriveAt);
    const etaMin = clock ? clock.min + (entry.timeS - clock.riddenS) / 60 : fixedMin;
    if (etaMin === undefined) continue;
    const slackMin = fixedMin === undefined ? 0 : Math.round(fixedMin - etaMin);
    const arrivalMin = fixedMin ?? etaMin;
    const pause = entry.stop?.pauseMinutes ?? 0;
    times.set(entry.id, { arrivalMin, departureMin: arrivalMin + pause, slackMin });
    if (slackMin < 0) short++;
    pauseMin += pause;
    departMin ??= arrivalMin + pause;
    clock = { min: arrivalMin + pause, riddenS: entry.timeS };
    endMin = arrivalMin;
  }
  if (departMin === undefined) return undefined;
  return { times, departMin, endMin, ridingS: sequence.at(-1)!.timeS, pauseMin, short };
}

/** By route, the fixed time of the route's first stop where it has one, with the riding time from the day's start to it. */
function routeStarts(sequence: readonly SequenceEntry[]): Map<number, { fixedMin: number; timeS: number }> {
  const starts = new Map<number, { fixedMin: number; timeS: number }>();
  const seen = new Set<number>();
  for (const entry of sequence) {
    if (!entry.stop || seen.has(entry.routeIndex)) continue;
    seen.add(entry.routeIndex);
    if (entry.stop.arriveAt != null) starts.set(entry.routeIndex, { fixedMin: minutesOfDay(entry.stop.arriveAt), timeS: entry.timeS });
  }
  return starts;
}
