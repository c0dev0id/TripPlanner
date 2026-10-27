import { beforeEach, describe, expect, it } from 'vitest';
import { BASE_MAPS, chooseBaseMap, chosenBaseMap } from './baseMaps';

describe('the base map choice', () => {
  beforeEach(() => localStorage.clear());

  it('is the first until one is chosen, and the first again for an unknown one', () => {
    expect(chosenBaseMap().id).toBe('liberty');
    chooseBaseMap(BASE_MAPS[4]!);
    expect(chosenBaseMap().id).toBe('opentopomap');
    localStorage.setItem('planner.baseMap', 'gone');
    expect(chosenBaseMap().id).toBe('liberty');
    chooseBaseMap(BASE_MAPS[0]!);
    expect(localStorage.getItem('planner.baseMap')).toBeNull();
  });
});
