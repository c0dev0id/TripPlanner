import { describe, expect, it } from 'vitest';
import { readRecording } from '../recording/track';
import { recordedMonth } from './dropImport';

const track = (points: string) => readRecording(`<gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><time>2026-03-01T08:00:00Z</time></metadata><trk><trkseg></trkseg><trkseg>${points}</trkseg></trk></gpx>`);
const file = (name: string) => new File([''], name, { lastModified: Date.UTC(2021, 5, 1) });

describe('recordedMonth', () => {
  it('is the month of the first track point that has a time, not of the file or of when it was written', () => {
    const recorded = track('<trkpt lat="47" lon="8"/><trkpt lat="47" lon="8.1"><time>2024-12-31T23:10:00Z</time></trkpt><trkpt lat="47.1" lon="8"><time>2025-01-01T00:10:00Z</time></trkpt>');
    expect(recordedMonth(recorded, file('20230704 Furka.gpx'))).toBe('2024-12');
  });

  it('falls back to a date in the file name, then to when the file was last changed', () => {
    const untimed = track('<trkpt lat="47" lon="8"/>');
    expect(recordedMonth(untimed, file('2023-07-04 Furka.gpx'))).toBe('2023-07');
    expect(recordedMonth(untimed, file('Furka.gpx'))).toBe('2021-06');
  });
});
