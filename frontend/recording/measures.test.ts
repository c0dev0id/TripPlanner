import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { histogram, measuresOf, summaryOf } from './measures';
import type { RecordedTrack } from './track';

/** Points 100 m apart along a meridian. */
const north = (n: number): LngLat[] => Array.from({ length: n }, (_, i) => [11, 47 + (i * 100) / 111_195]);

const track = (series: RecordedTrack['series'], n = 5): RecordedTrack => ({ points: north(n), series });

describe('measuresOf', () => {
  it('turns a file\'s speed from metres per second into km/h', () => {
    expect(measuresOf(track({ speed: [10, 20, null, 0, 5] })).speed).toEqual([36, 72, null, 0, 18]);
  });

  it('works out the speed from time and distance where the file has no speed', () => {
    const time = [0, 10_000, 20_000, 30_000, 40_000];
    const speed = measuresOf(track({ time })).speed!;
    expect(speed.map((v) => Math.round(v!))).toEqual([36, 36, 36, 36, 36]);
  });

  it('leaves out heights and lean angles that are all zero, as some apps write them', () => {
    const m = measuresOf(track({ ele: [0, 0, 0, 0, 0], lean_angle: [0, 0, 0, 0, 0] }));
    expect([m.altitude, m.slope, m.lean]).toEqual([undefined, undefined, undefined]);
  });

  it('measures the slope over 100 m around each point', () => {
    const slope = measuresOf(track({ ele: [100, 105, 110, 115, 120] })).slope!;
    expect(slope.map((v) => (v === null ? null : Math.round(v)))).toEqual([5, 5, 5, 5, 5]);
  });
});

describe('summaryOf', () => {
  it('sums up distance, times, speeds, climbs and lean', () => {
    const m = measuresOf(
      track({
        time: [0, 10_000, 20_000, 80_000, 90_000],
        speed: [10, 10, 0, 0, 10],
        ele: [100, 110, 108, 120, 100],
        lean_angle: [0, -30, 0, 25, 0],
      }),
    );
    const s = summaryOf(m);
    expect(Math.round(s.distanceM)).toBe(400);
    expect([s.durationS, s.movingS, s.maxSpeed]).toEqual([90, 30, 36]);
    // 300 m in the 30 s moving; the 100 m while standing count for neither.
    expect(Math.round(s.averageSpeed!)).toBe(36);
    expect([s.ascentM, s.descentM, s.minAltitude, s.maxAltitude]).toEqual([20, 20, 100, 120]);
    expect(s.leanRange).toEqual([-30, 25]);
  });
});

describe('histogram', () => {
  it('counts the kilometres ridden in each bin', () => {
    const m = measuresOf(track({ speed: [5, 5, 15, 15, 25] }));
    const h = histogram(m, m.speed!, 20);
    expect(h.from).toEqual([0, 20, 40, 60, 80]);
    expect(h.km.map((v) => Math.round(v * 10) / 10)).toEqual([0.1, 0, 0.2, 0, 0.1]);
  });
});
