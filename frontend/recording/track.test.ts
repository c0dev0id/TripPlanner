import { describe, expect, it } from 'vitest';
import { readRecording, trackGpx } from './track';

const RIDELINK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ridelink" xmlns="http://www.topografix.com/GPX/1/1" xmlns:rl="https://ridelink.com/gpx/extensions/v1">
  <wpt lat="48" lon="8"><name>Start Point</name></wpt>
  <trk><name>Hockenheim loop</name>
    <trkseg>
      <trkpt lat="48.45" lon="8.70"><ele>517.00</ele><time>2025-07-09T10:00:00Z</time>
        <extensions><rl:speed>1.67</rl:speed><rl:lean_angle>0.00</rl:lean_angle></extensions></trkpt>
      <trkpt lat="95" lon="8.71"><ele>1</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="48.46" lon="8.71"><time>2025-07-09T10:00:05Z</time>
        <extensions><rl:speed>12.5</rl:speed><rl:lean_angle>-21.5</rl:lean_angle><rl:note>fast</rl:note></extensions></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('readRecording', () => {
  it('reads one track, its segments in order, and per point every measured value; waypoints are left aside', () => {
    const track = readRecording(RIDELINK);
    expect(track.name).toBe('Hockenheim loop');
    expect(track.points).toEqual([[8.7, 48.45], [8.71, 48.46]]);
    expect(track.series).toEqual({
      ele: [517, null],
      time: [Date.parse('2025-07-09T10:00:00Z'), Date.parse('2025-07-09T10:00:05Z')],
      speed: [1.67, 12.5],
      lean_angle: [0, -21.5],
    });
  });

  it('refuses a file that is no single track', () => {
    const gpx = (inner: string) => `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${inner}</gpx>`;
    expect(() => readRecording(gpx('<trk/><trk/>'))).toThrow('one track');
    expect(() => readRecording(gpx('<trk/><rte/>'))).toThrow('one track');
    expect(() => readRecording('<kml/>')).toThrow('not a GPX');
  });

  it('writes a line as a GPX file of one track that reads back the same', () => {
    const track = readRecording(trackGpx('Pass & valley', [[11.5, 48.1], [11.45, 47.8]]));
    expect([track.name, track.points, track.series]).toEqual(['Pass & valley', [[11.5, 48.1], [11.45, 47.8]], {}]);
  });
});
