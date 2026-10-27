import { describe, expect, it } from 'vitest';
import type { Stop } from '../model/trip';
import { newStop } from './dayEdit';
import type { SequenceEntry } from './sequence';
import { dayTimeline } from './timeline';

const stop = (id: string, arriveAt: string | null = null, pauseMinutes: number | null = null): Stop => ({ ...newStop(id, id, [0, 0], null), arriveAt, pauseMinutes });

const entry = (timeS: number, s?: Stop): SequenceEntry => ({ id: s?.id ?? `p${timeS}`, routeIndex: 0, distanceM: timeS * 15, timeS, lngLat: [0, 0], ...(s && { stop: s }) });

const listed = (timeline: ReturnType<typeof dayTimeline>) => [...timeline!.times].map(([id, t]) => [id, t.arrivalMin, t.departureMin, t.slackMin]);

describe('dayTimeline', () => {
  it('is none while no stop has a time', () => {
    expect(dayTimeline([entry(0, stop('home')), entry(3600)])).toBeUndefined();
  });

  it('starts at the first stop with a time and adds riding times and pauses to the end', () => {
    const timeline = dayTimeline([entry(0, stop('home', '08:30', 30)), entry(5400, stop('lunch', null, 60)), entry(9000)]);
    expect(listed(timeline)).toEqual([
      ['home', 510, 540, 0],
      ['lunch', 630, 690, 0],
      ['p9000', 750, 750, 0],
    ]);
    expect(timeline).toMatchObject({ departMin: 540, endMin: 750, ridingS: 9000, pauseMin: 90, missed: 0 });
  });

  it('waits for a fixed arrival time and counts one the plan misses', () => {
    const timeline = dayTimeline([entry(0, stop('home', '09:00')), entry(1800, stop('coffee', '10:00', 15)), entry(9000, stop('hotel', '12:00'))]);
    // Half an hour of riding, there at 09:30, waits until 10:00, leaves at 10:15; two more
    // hours of riding reach the hotel at 12:15, a quarter of an hour after its time.
    expect(listed(timeline)).toEqual([
      ['home', 540, 540, 0],
      ['coffee', 600, 615, 30],
      ['hotel', 735, 735, -15],
    ]);
    expect(timeline).toMatchObject({ departMin: 540, endMin: 735, pauseMin: 15, missed: 1 });
  });

  it('leaves the entries before the first timed stop without times', () => {
    const timeline = dayTimeline([entry(0, stop('home')), entry(1800, stop('cafe', '10:00')), entry(5400)]);
    expect([...timeline!.times.keys()]).toEqual(['cafe', 'p5400']);
    expect(timeline).toMatchObject({ departMin: 600, endMin: 660 });
  });
});
