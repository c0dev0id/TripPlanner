import { describe, expect, it } from 'vitest';
import type { Stop } from '../model/trip';
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

describe('dayTimeline', () => {
  it('is none while no stop has a time', () => {
    expect(dayTimeline([entry(0, stop('home')), entry(3600)])).toBeUndefined();
  });

  it('starts at the first stop with a time and adds riding times and pauses to the end', () => {
    const home = stop('home', '08:30', 30);
    const lunch = stop('lunch', null, 60);
    const timeline = dayTimeline([entry(0, home), entry(5400, lunch), entry(9000)])!;
    expect(timeline.stops.map((t) => [t.stop.id, t.arrivalMin, t.departureMin, t.slackMin])).toEqual([
      ['home', 510, 540, undefined],
      ['lunch', 630, 690, undefined],
    ]);
    expect(timeline).toMatchObject({ departMin: 540, endMin: 750, ridingS: 9000, pauseMin: 90, late: 0 });
  });

  it('waits for a fixed arrival time and counts a missed one as late', () => {
    const home = stop('home', '09:00');
    const coffee = stop('coffee', '10:00', 15);
    const hotel = stop('hotel', '12:00');
    const timeline = dayTimeline([entry(0, home), entry(1800, coffee), entry(9000, hotel)])!;
    // Half an hour of riding, there at 09:30, waits until 10:00, leaves at 10:15.
    expect(timeline.stops[1]).toMatchObject({ arrivalMin: 600, departureMin: 615, slackMin: 30 });
    // Two more hours of riding: 12:15, a quarter of an hour late; the hotel ends the day.
    expect(timeline.stops[2]).toMatchObject({ arrivalMin: 735, departureMin: 735, slackMin: -15 });
    expect(timeline).toMatchObject({ departMin: 540, endMin: 735, late: 1, pauseMin: 15 });
  });

  it('leaves the stops before the first timed one without times', () => {
    const timeline = dayTimeline([entry(0, stop('home')), entry(1800, stop('cafe', '10:00')), entry(5400)])!;
    expect(timeline.stops.map((t) => t.stop.id)).toEqual(['cafe']);
    expect(timeline).toMatchObject({ departMin: 600, endMin: 660 });
  });
});

describe('minutesOfDay', () => {
  it('reads HH:MM', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('17:45')).toBe(1065);
  });
});
