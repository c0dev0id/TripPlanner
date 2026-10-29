import { describe, expect, it } from 'vitest';
import type { Stop } from '../model/trip';
import { newStop } from './dayEdit';
import type { SequenceEntry } from './sequence';
import { dayTimeline } from './timeline';

/** A stop on the ride, bound to a route point. */
const stop = (id: string, arriveAt: string | null = null, pauseMinutes: number | null = null): Stop => ({ ...newStop(id, id, [0, 0], `point-${id}`), arriveAt, pauseMinutes });

const entry = (timeS: number, s?: Stop, routeIndex = 0): SequenceEntry => ({ id: s?.id ?? `p${timeS}`, routeIndex, distanceM: timeS * 15, timeS, lngLat: [0, 0], ...(s && { stop: s }) });

const listed = (timeline: ReturnType<typeof dayTimeline>) => [...timeline!.times].map(([id, t]) => [id, t.arrivalMin, t.departureMin, t.slackMin]);

describe('dayTimeline', () => {
  it('passes over a stop that stands for itself, whatever its time', () => {
    const alone: Stop = { ...stop('hut', '07:00', 60), pointId: null };
    const timeline = dayTimeline([entry(0, stop('home', '09:00')), entry(1800), entry(1800, alone)]);
    expect(listed(timeline)).toEqual([
      ['home', 540, 540, 0],
      ['p1800', 570, 570, 0],
    ]);
    expect(timeline).toMatchObject({ endMin: 570, pauseMin: 0, late: 0 });
  });

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
    expect(timeline).toMatchObject({ departMin: 540, endMin: 750, ridingS: 9000, pauseMin: 90, late: 0 });
  });

  it('keeps a fixed arrival time, early or late for it', () => {
    const timeline = dayTimeline([entry(0, stop('home', '09:00')), entry(1800, stop('coffee', '10:00', 15)), entry(9000, stop('hotel', '12:00', 30)), entry(9600)]);
    // Half an hour of riding, there at 09:30, waits until 10:00, leaves at 10:15; two more
    // hours of riding would reach the hotel at 12:15, a quarter of an hour short of its
    // time, which the plan keeps; the day goes on from 12:30 as planned.
    expect(listed(timeline)).toEqual([
      ['home', 540, 540, 0],
      ['coffee', 600, 615, 30],
      ['hotel', 720, 750, -15],
      ['p9600', 760, 760, 0],
    ]);
    expect(timeline).toMatchObject({ departMin: 540, endMin: 760, pauseMin: 45, late: 1 });
  });

  it('leaves the entries before the first timed stop without times', () => {
    const timeline = dayTimeline([entry(0, stop('home')), entry(1800, stop('cafe', '10:00')), entry(5400)]);
    expect([...timeline!.times.keys()]).toEqual(['cafe', 'p5400']);
    expect(timeline).toMatchObject({ departMin: 600, endMin: 660 });
  });

  it('times the route points before its first stop from that stop\'s time', () => {
    const timeline = dayTimeline([entry(0), entry(1800, stop('cafe', '10:00')), entry(3600)]);
    expect(listed(timeline)).toEqual([
      ['p0', 570, 570, 0],
      ['cafe', 600, 600, 0],
      ['p3600', 630, 630, 0],
    ]);
  });

  it('starts each route at its first stop\'s time, never late or early for it', () => {
    // The first route ends at 10:00; the second starts at its ferry stop, fixed at 09:30, and goes on from there.
    const timeline = dayTimeline([entry(0, stop('home', '09:00')), entry(3600), entry(3600, stop('ferry', '09:30', 60), 1), entry(5400, stop('lunch'), 1)]);
    expect(listed(timeline)).toEqual([
      ['home', 540, 540, 0],
      ['p3600', 600, 600, 0],
      ['ferry', 570, 630, 0],
      ['lunch', 660, 660, 0],
    ]);
    expect(timeline).toMatchObject({ late: 0, endMin: 660 });
  });

  it('goes on into a route whose first stop has no time, and keeps later fixed times within a route', () => {
    const timeline = dayTimeline([entry(0, stop('home', '09:00')), entry(3600, stop('pass'), 1), entry(5400, stop('hut', '09:45'), 1)]);
    expect(listed(timeline)).toEqual([
      ['home', 540, 540, 0],
      ['pass', 600, 600, 0],
      ['hut', 585, 585, -45],
    ]);
    expect(timeline!.late).toBe(1);
  });
});
