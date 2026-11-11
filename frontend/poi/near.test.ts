import { expect, it } from 'vitest';
import { POI_CATEGORIES, type Place } from './categories';
import { placesNear } from './near';

const category = (id: string) => POI_CATEGORIES.find((c) => c.id === id)!;
const place = (id: string, kind: string, lng: number, lat: number): Place => ({ id, category: category(kind), lngLat: [lng, lat], tags: {} });

it('keeps each kind within its own distance of the lines', () => {
  // Along the equator; 0.001° of latitude is some 111 m.
  const line = [
    [0, 0],
    [0.1, 0],
  ] as [number, number][];
  const places = [place('near fuel', 'fuel', 0.05, 0.001), place('far fuel', 'fuel', 0.05, 0.003), place('far hotel', 'hotel', 0.05, 0.003), place('past the end', 'hotel', 0.11, 0)];
  const reach = (kind: string) => (kind === 'hotel' ? 500 : 200);
  expect(placesNear(places, [line], reach).map((p) => p.id)).toEqual(['near fuel', 'far hotel']);
  expect(placesNear(places, [], reach)).toEqual([]);
});
