import type { LngLat } from '../model/trip';

/**
 * A position as people copy it from a map or a photo's details, read from its text:
 * two decimal numbers ("48.12345, 8.54321"), with or without the degree sign and the
 * letters of the hemispheres ("48.12345° N, 8.54321° E"), or degrees, minutes and
 * seconds ("48°07'24.4"N 8°32'35.6"E"). The latitude comes first unless the letters say
 * otherwise. Nothing for a text that is no position on the earth.
 */
export function parseCoordinates(text: string): LngLat | undefined {
  const part = /([NSEW])?\s*(-?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|'')\s*)?)?([NSEW])?/gi;
  const found = [...text.trim().toUpperCase().matchAll(part)];
  if (found.length !== 2 || found.map((m) => m[0]).join('').replace(/\s/g, '').length !== text.replace(/[\s,;]/g, '').length) return undefined;
  const [first, second] = found.map((m) => {
    const letter = m[1] ?? m[5];
    const degrees = Math.abs(Number(m[2])) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
    return { letter, value: m[2]!.startsWith('-') || letter === 'S' || letter === 'W' ? -degrees : degrees };
  });
  const eastFirst = first!.letter === 'E' || first!.letter === 'W' || second!.letter === 'N' || second!.letter === 'S';
  const [lat, lng] = eastFirst ? [second!.value, first!.value] : [first!.value, second!.value];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] : undefined;
}
