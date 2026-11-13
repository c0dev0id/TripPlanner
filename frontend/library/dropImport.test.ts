import { describe, expect, it } from 'vitest';
import { parseGpx } from '../gpx/gpx';
import { recordedYear } from './dropImport';

const track = (points: string) => parseGpx(`<gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><time>2026-03-01T08:00:00Z</time></metadata><trk><trkseg></trkseg><trkseg>${points}</trkseg></trk></gpx>`);
const file = (name: string) => new File([''], name, { lastModified: Date.UTC(2021, 5, 1) });

describe('recordedYear', () => {
  it('is the year of the first track point, not of the file or of when it was written', () => {
    const gpx = track('<trkpt lat="47" lon="8"><time>2024-12-31T23:10:00Z</time></trkpt><trkpt lat="47.1" lon="8"><time>2025-01-01T00:10:00Z</time></trkpt>');
    expect(recordedYear(gpx, file('20230704 Furka.gpx'))).toBe('2024');
  });

  it('falls back to a date in the file name, then to when the file was last changed', () => {
    const untimed = track('<trkpt lat="47" lon="8"/>');
    expect(recordedYear(untimed, file('2023-07-04 Furka.gpx'))).toBe('2023');
    expect(recordedYear(untimed, file('Furka.gpx'))).toBe('2021');
  });
});
