import { expect, it } from 'vitest';
import { BADGES, isBadge, POI_CATEGORIES } from './categories';
import list from './places.json';

it('every kind the server fetches has a name here', () => {
  expect(POI_CATEGORIES.map((category) => category.id)).toEqual(list.kinds.map((kind) => kind.id));
  for (const category of POI_CATEGORIES) expect(category.label).toBeTruthy();
});

it('every kind of the store is a badge, and no two badges share an id', () => {
  for (const category of POI_CATEGORIES) expect(isBadge(category.id)).toBe(true);
  expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length);
  expect(isBadge('none')).toBe(false);
});
