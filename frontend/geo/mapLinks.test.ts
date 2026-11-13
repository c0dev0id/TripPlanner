import { expect, it } from 'vitest';
import { googleMapsUrl, openStreetMapUrl, streetViewUrl } from './mapLinks';

it('names the spot as latitude, longitude', () => {
  expect(googleMapsUrl([8.1234567, 49.5])).toBe('https://www.google.com/maps/search/?api=1&query=49.500000,8.123457');
  expect(streetViewUrl([8.1234567, 49.5])).toBe('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=49.500000,8.123457');
  expect(openStreetMapUrl([8.1234567, 49.5])).toBe('https://www.openstreetmap.org/?mlat=49.500000&mlon=8.123457#map=17/49.500000/8.123457');
});
