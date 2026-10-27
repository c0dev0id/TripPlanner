import { describe, expect, it } from 'vitest';
import type { Day, Stop } from '../model/trip';
import type { SequenceEntry } from './sequence';
import { dayTimeline, minutesOfDay } from './timeline';

const stop = (id: string, arriveAt: string | null = null, pauseMinutes: number | null = null): Stop => ({
  id,
  name: id,
  kind: 'other',
  lngLat: [0, 0],
  pointId: null,
  address: '',
  contact: '',
  bookingReference: '',
  notes: '',
  arriveAt,
  pauseMinutes,
  optional: false,
});

const entry = (timeS: number, s?: Stop): SequenceEntry => ({ id: s?.id ?? `p${timeS}`, routeIndex: 0, distanceM: timeS * 15, timeS, lngLat: [0, 0], ...(s && { stop: s }) });

const day = (departAt: string | null): Day => ({ id: 'd', name: '', departAt, notes: '', routes: [], stops: [] });

describe('dayTimeline', () => {
  it('is none without a departure', () => {
    expect(dayTimeline(day(null), [entry(0)])).toBeUndefined();
  });

  it('adds riding times and pauses up to the end of the day', () => {
    const lunch = stop('lunch', null, 60);
    const sequence = [entry(0), entry(5400, lunch), entry(9000)];
    const timeline = dayTimeline(day('09:00'), sequence)!;
    expect(timeline.stops).toHaveLength(1);
    expect(timeline.stops[0]).toMatchObject({ etaMin: 630, arrivalMin: 630, departureMin: 690 });
    expect(timeline.stops[0]!.slackMin).toBeUndefined();
    expect(timeline).toMatchObject({ departMin: 540, endMin: 750, ridingS: 9000, pauseMin: 60, late: 0 });
  });

  it('waits for a fixed arrival time and counts a missed one as late', () => {
    const coffee = stop('coffee', '10:00', 15);
    const hotel = stop('hotel', '12:00');
    const sequence = [entry(0), entry(1800, coffee), entry(9000, hotel)];
    const timeline = dayTimeline(day('09:00'), sequence)!;
    // Half an hour of riding, there at 09:30, waits until 10:00, leaves at 10:15.
    expect(timeline.stops[0]).toMatchObject({ etaMin: 570, arrivalMin: 600, departureMin: 615, slackMin: 30 });
    // Two more hours of riding: 12:15, a quarter of an hour late; the hotel ends the day.
    expect(timeline.stops[1]).toMatchObject({ etaMin: 735, arrivalMin: 735, departureMin: 735, slackMin: -15 });
    expect(timeline).toMatchObject({ endMin: 735, late: 1, pauseMin: 15 });
  });

  it('ends at the departure when the day has no route', () => {
    const timeline = dayTimeline(day('08:30'), [])!;
    expect(timeline).toMatchObject({ departMin: 510, endMin: 510, ridingS: 0, stops: [] });
  });
});

describe('minutesOfDay', () => {
  it('reads HH:MM', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('17:45')).toBe(1065);
  });
});
