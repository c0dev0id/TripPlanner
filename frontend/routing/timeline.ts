import type { SequenceEntry } from './sequence';

/**
 * A day's planned times, from the first stop that has a time on: the riding times of the
 * legs, the pauses, and the stops' fixed arrival times, which the plan waits for when
 * the ride gets there early and misses when it gets there late. Nothing here is the
 * clock; matching the plan against the ride is a navigation system's job.
 */

export interface EntryTime {
  /** With a fixed arrival time the plan waits for it, so the arrival may be later than the riding makes it. */
  arrivalMin: number;
  /** After the pause; the arrival itself at a plain route point. */
  departureMin: number;
  /** Whole minutes against a fixed arrival time: waiting when positive, missed when negative; 0 without one or when it fits. */
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
  /** How many fixed arrival times the plan misses. */
  missed: number;
}

/** Minutes since midnight of a time of day written as HH:MM. */
function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/**
 * The day's timeline over its riding sequence; none while no stop has a time. An entry's
 * arrival is the last departure plus the riding since; where there is no clock yet, a
 * stop's fixed time starts it.
 */
export function dayTimeline(sequence: readonly SequenceEntry[]): DayTimeline | undefined {
  const times = new Map<string, EntryTime>();
  let clock: { min: number; riddenS: number } | undefined;
  let departMin: number | undefined;
  let endMin = 0;
  let pauseMin = 0;
  let missed = 0;
  for (const entry of sequence) {
    const fixedMin = entry.stop?.arriveAt == null ? undefined : minutesOfDay(entry.stop.arriveAt);
    const etaMin = clock ? clock.min + (entry.timeS - clock.riddenS) / 60 : fixedMin;
    if (etaMin === undefined) continue;
    const slackMin = fixedMin === undefined ? 0 : Math.round(fixedMin - etaMin);
    const arrivalMin = Math.max(etaMin, fixedMin ?? etaMin);
    const pause = entry.stop?.pauseMinutes ?? 0;
    times.set(entry.id, { arrivalMin, departureMin: arrivalMin + pause, slackMin });
    if (slackMin < 0) missed++;
    pauseMin += pause;
    departMin ??= arrivalMin + pause;
    clock = { min: arrivalMin + pause, riddenS: entry.timeS };
    endMin = arrivalMin;
  }
  if (departMin === undefined) return undefined;
  return { times, departMin, endMin, ridingS: sequence.at(-1)!.timeS, pauseMin, missed };
}
