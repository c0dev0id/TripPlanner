import { describe, expect, it } from 'vitest';
import { fileFacts } from './file';
import type { RecordedTrack } from './track';

const at = (seconds: number) => Date.UTC(2026, 5, 1, 8, 0, seconds);

describe('fileFacts', () => {
  it('says how densely a file was recorded and what it tells of each point', () => {
    const track: RecordedTrack = {
      creator: 'ridelink',
      segments: 2,
      points: [[8, 49], [8, 49.001], [8, 49.002], [8, 49.003], [8, 49.004]],
      series: { time: [at(0), at(1), at(2), null, at(30)], speed: [10, 11, 12, null, null], ele: [100, 100, 100, 100, 100] },
    };
    expect(fileFacts(track, 444)).toEqual({
      creator: 'ridelink',
      points: 5,
      segments: 2,
      intervalS: 1,
      spacingM: 111,
      values: [
        { name: 'time', share: 0.8 },
        { name: 'speed', share: 0.6 },
        { name: 'ele', share: 1 },
      ],
    });
  });

  it('leaves out what a bare file does not have', () => {
    expect(fileFacts({ segments: 1, points: [[8, 49]], series: {} }, 0)).toEqual({ creator: undefined, points: 1, segments: 1, intervalS: undefined, spacingM: undefined, values: [] });
  });
});
