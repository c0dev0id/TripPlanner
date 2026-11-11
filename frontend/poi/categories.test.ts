import { expect, it } from 'vitest';
import { POI_CATEGORIES } from './categories';
import list from './places.json';

it('every kind the server fetches has a name here', () => {
  expect(POI_CATEGORIES.map((category) => category.id)).toEqual(list.kinds.map((kind) => kind.id));
  for (const category of POI_CATEGORIES) expect(category.label).toBeTruthy();
});
