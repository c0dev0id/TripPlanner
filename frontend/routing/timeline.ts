import type { Stop } from '../model/trip';
import type { SequenceEntry } from './sequence';

/**
 * A day's times, from the first stop that has a time on: the riding times of the legs,
 * the pauses, and the stops' fixed arrival times, which the rider waits for when early
 * and misses when late.
 */

export interface StopTime {
  stop: Stop;
  /** With a fixed arrival time the plan waits for it, so the arrival may be later than the riding makes it. */
  arrivalMin: number;
  departureMin: number;
  /** Against a fixed arrival time: minutes early (waiting) when positive, late when negative. */
  slackMin?: number;
}

export interface DayTimeline {
  /** Leaving the first stop that has a time on, after its pause. */
  departMin: number;
  /** From that stop on; the stops before it have no times. */
  stops: StopTime[];
  /** Arrival at the day's end: the last point of its routes, or the last stop. */
  endMin: number;
  /** Of the whole day. */
  ridingS: number;
  pauseMin: number;
  /** How many stops are reached after their fixed arrival time. */
  late: number;
}

/** Minutes since midnight of a time of day written as HH:MM. */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/** The day's timeline over its riding sequence; none while no stop has a time. */
export function dayTimeline(sequence: readonly SequenceEntry[]): DayTimeline | undefined {
  const first = sequence.find((e) => e.stop?.arriveAt != null);
  if (!first) return undefined;
  const stops: StopTime[] = [];
  let clockMin = minutesOfDay(first.stop!.arriveAt!);
  let riddenS = first.timeS;
  let pauseMin = 0;
  let late = 0;
  for (const entry of sequence.slice(sequence.indexOf(first))) {
    if (!entry.stop) continue;
    const etaMin = clockMin + (entry.timeS - riddenS) / 60;
    const fixedMin = entry.stop.arriveAt === null ? undefined : minutesOfDay(entry.stop.arriveAt);
    const slackMin = fixedMin === undefined || entry === first ? undefined : fixedMin - etaMin;
    const arrivalMin = fixedMin === undefined ? etaMin : Math.max(etaMin, fixedMin);
    const pause = entry.stop.pauseMinutes ?? 0;
    stops.push({ stop: entry.stop, arrivalMin, departureMin: arrivalMin + pause, ...(slackMin !== undefined && { slackMin }) });
    if (slackMin !== undefined && slackMin < -0.5) late++;
    pauseMin += pause;
    clockMin = arrivalMin + pause;
    riddenS = entry.timeS;
  }
  const ridingS = sequence.at(-1)?.timeS ?? 0;
  const endMin = ridingS > riddenS ? clockMin + (ridingS - riddenS) / 60 : stops.at(-1)!.arrivalMin;
  return { departMin: stops[0]!.departureMin, stops, endMin, ridingS, pauseMin, late };
}
