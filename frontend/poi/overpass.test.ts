import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { POI_CATEGORIES } from './categories';
import { parsePois, poiQuery } from './overpass';

const category = (id: string) => POI_CATEGORIES.find((c) => c.id === id)!;

describe('poiQuery', () => {
  it('asks for each category within its distance of a spot', () => {
    const query = poiQuery(
      [
        { category: category('fuel'), metres: 5000 },
        { category: category('hotel'), metres: 20000 },
      ],
      { spot: [8.123456789, 49.5] },
    );
    expect(query).toBe(
      '[out:json][timeout:60];(nwr["amenity"="fuel"](around:5000,49.50000,8.12346);nwr["tourism"~"^(hotel|guest_house|motel)$"](around:20000,49.50000,8.12346););out center 2000;',
    );
  });

  it('leaves out parking that is not open to the public', () => {
    expect(poiQuery([{ category: category('parking'), metres: 200 }], { spot: [8, 49] })).toContain('nwr["amenity"~"^(parking|motorcycle_parking)$"]["access"!~"^(private|no)$"](around:200,');
  });

  it('asks along each line, without the points a quarter of the distance does not need', () => {
    // A point 0.0005° of latitude, some 55 m, off the straight line between its neighbours.
    const bent: LngLat[] = [
      [8, 49],
      [8.01, 49.0005],
      [8.02, 49],
    ];
    const other: LngLat[] = [
      [9, 50],
      [9.1, 50],
    ];
    const along = (metres: number) => poiQuery([{ category: category('fuel'), metres }], { lines: [bent, other] });
    expect(along(200)).toContain('(around:200,49.00000,8.00000,49.00050,8.01000,49.00000,8.02000);nwr["amenity"="fuel"](around:200,50.00000,9.00000,50.00000,9.10000);');
    expect(along(2000)).toContain('(around:2000,49.00000,8.00000,49.00000,8.02000);');
  });
});

describe('parsePois', () => {
  it('reads nodes at their position and ways at their centre, each in its category', () => {
    const pois = parsePois({
      elements: [
        { type: 'node', id: 1, lat: 49.1, lon: 8.1, tags: { amenity: 'fuel', brand: 'Aral' } },
        { type: 'way', id: 2, center: { lat: 49.2, lon: 8.2 }, tags: { tourism: 'guest_house', name: 'Zur Post' } },
        { type: 'way', id: 3, tags: { amenity: 'cafe' } },
        { type: 'node', id: 4, lat: 49.3, lon: 8.3, tags: { amenity: 'bench' } },
      ],
    });
    expect(pois).toEqual([
      { id: 'node/1', categoryId: 'fuel', lngLat: [8.1, 49.1], tags: { amenity: 'fuel', brand: 'Aral' } },
      { id: 'way/2', categoryId: 'hotel', lngLat: [8.2, 49.2], tags: { tourism: 'guest_house', name: 'Zur Post' } },
    ]);
  });

  it('throws when the server gave up or sent something else', () => {
    expect(() => parsePois({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 61 seconds.' })).toThrow();
    expect(() => parsePois('<html>')).toThrow();
  });
});
