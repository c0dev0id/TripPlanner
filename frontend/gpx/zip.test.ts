// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { zipEntries } from './zip';

/** A zip with a stored file, a deflated one with a name beyond ASCII, a folder, and a comment at its end. */
const ZIP = 'UEsDBBQAAAAAAAAAIQBfPLtAGQAAABkAAAAOAAAAQWxwcy90cmlwLmpzb257ImZvcm1hdCI6InRyaXAtcGxhbm5lciJ9UEsDBBQAAAgIAAAAIQA+8pCaEAAAAP8BAAAYAAAAQWxwcy9UYWcgMSDigJMgUmjDtm4uZ3B4s0kvqLCrGAUjDtjog2IeAFBLAwQUAAAAAAAAACEAAAAAAAAAAAAAAAAADQAAAEFscHMvam91cm5hbC9QSwECFAMUAAAAAAAAACEAXzy7QBkAAAAZAAAADgAAAAAAAAAAAAAAgAEAAAAAQWxwcy90cmlwLmpzb25QSwECFAMUAAAICAAAACEAPvKQmhAAAAD/AQAAGAAAAAAAAAAAAAAAgAFFAAAAQWxwcy9UYWcgMSDigJMgUmjDtm4uZ3B4UEsBAhQDFAAAAAAAAAAhAAAAAAAAAAAAAAAAAA0AAAAAAAAAAAAAAIABiwAAAEFscHMvam91cm5hbC9QSwUGAAAAAAMAAwC9AAAAtgAAAA8AbWFkZSBmb3IgYSB0ZXN0';
const zip = (): Blob => new Blob([Uint8Array.from(atob(ZIP), (c) => c.charCodeAt(0))]);

describe('zipEntries', () => {
  it('lists the files by path and reads them, stored or deflated', async () => {
    const entries = await zipEntries(zip());
    expect(entries.map((entry) => entry.path)).toEqual(['Alps/trip.json', 'Alps/Tag 1 – Rhön.gpx']);
    expect(await (await entries[0]!.read()).text()).toBe('{"format":"trip-planner"}');
    expect(await (await entries[1]!.read()).text()).toBe(`<gpx>${'x'.repeat(500)}</gpx>`);
  });

  it('refuses what is no zip', async () => {
    await expect(zipEntries(new Blob(['<gpx></gpx>']))).rejects.toThrow('no zip');
  });
});
