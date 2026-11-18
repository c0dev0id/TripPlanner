import { describe, expect, it } from 'vitest';
import { parseCoordinates } from './coordinates';

describe('parseCoordinates', () => {
  it('reads two decimal numbers, latitude first', () => {
    expect(parseCoordinates('48.12345, 8.54321')).toEqual([8.54321, 48.12345]);
    expect(parseCoordinates('  48.12345 8.54321 ')).toEqual([8.54321, 48.12345]);
    expect(parseCoordinates('48.12345;8.54321')).toEqual([8.54321, 48.12345]);
    expect(parseCoordinates('-33.8688, 151.2093')).toEqual([151.2093, -33.8688]);
  });

  it('reads degree signs and the letters of the hemispheres, in either order', () => {
    expect(parseCoordinates('48.12345° N, 8.54321° E')).toEqual([8.54321, 48.12345]);
    expect(parseCoordinates('N 48.12345 E 8.54321')).toEqual([8.54321, 48.12345]);
    expect(parseCoordinates('8.54321 E, 48.12345 N')).toEqual([8.54321, 48.12345]);
    expect(parseCoordinates('33.8688 S 151.2093 E')).toEqual([151.2093, -33.8688]);
    expect(parseCoordinates('40.7128° n, 74.0060° w')).toEqual([-74.006, 40.7128]);
  });

  it('reads degrees, minutes and seconds', () => {
    expect(parseCoordinates('48°07\'24.4"N 8°32\'35.6"E')).toEqual([8.543222, 48.123444]);
    expect(parseCoordinates('48° 7′ 24.4″ N, 8° 32′ 35.6″ E')).toEqual([8.543222, 48.123444]);
    expect(parseCoordinates("48°07.5'N 8°32.5'E")).toEqual([8.541667, 48.125]);
  });

  it('reads nothing that is no position', () => {
    for (const text of ['', 'Hockenheim', '48.12345', '48.1, 8.5, 3', '95, 8', '48, 190', 'see 48.1, 8.5', '48.1, 8.5 or so']) expect(parseCoordinates(text)).toBeUndefined();
  });
});
