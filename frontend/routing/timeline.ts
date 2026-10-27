import type { Day, Stop } from '../model/trip';
import type { SequenceEntry } from './sequence';

/**
 * A day's times, from its departure through its stops to its end: the riding times of
 * the legs, the pauses, and the fixed arrival times, which the rider waits for when early
 * and misses when late.
 */

export interface StopTime {
  stop: Stop;
  /** Arriving as ridden; with a fixed arrival time the plan waits for it, so the planned arrival may be later. */
  etaMin: number;
  arrivalMin: number;
  departureMin: number;
  /** Against a fixed arrival time: minutes early (waiting) when positive, late when negative. */
  slackMin?: number;
}

export interface DayTimeline {
  departMin: number;
  stops: StopTime[];
  /** Arrival at the day's end: the last point of its routes, or the last stop. */
  endMin: number;
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

/** The day's timeline over its riding sequence; none without a departure time. */
export function dayTimeline(day: Day, sequence: readonly SequenceEntry[]): DayTimeline | undefined {
  if (day.departAt === null) return undefined;
  const departMin = minutesOfDay(day.departAt);
  const stops: StopTime[] = [];
  let clockMin = departMin;
  let riddenS = 0;
  let pauseMin = 0;
  let late = 0;
  for (const entry of sequence) {
    if (!entry.stop) continue;
    const etaMin = clockMin + (entry.timeS - riddenS) / 60;
    const fixedMin = entry.stop.arriveAt === null ? undefined : minutesOfDay(entry.stop.arriveAt);
    const slackMin = fixedMin === undefined ? undefined : fixedMin - etaMin;
    const arrivalMin = fixedMin === undefined ? etaMin : Math.max(etaMin, fixedMin);
    const pause = entry.stop.pauseMinutes ?? 0;
    stops.push({ stop: entry.stop, etaMin, arrivalMin, departureMin: arrivalMin + pause, ...(slackMin !== undefined && { slackMin }) });
    if (slackMin !== undefined && slackMin < -0.5) late++;
    pauseMin += pause;
    clockMin = arrivalMin + pause;
    riddenS = entry.timeS;
  }
  const ridingS = sequence.at(-1)?.timeS ?? 0;
  const endMin = ridingS > riddenS ? clockMin + (ridingS - riddenS) / 60 : (stops.at(-1)?.arrivalMin ?? departMin);
  return { departMin, stops, endMin, ridingS, pauseMin, late };
}
