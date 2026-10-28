import { beforeEach, describe, expect, it } from 'vitest';
import { BASE_MAPS, chooseBaseMap, chosenBaseMap } from './baseMaps';

describe('the base map choice', () => {
  beforeEach(() => localStorage.clear());

  it('is the first until one is chosen, and keeps the choice', () => {
    expect(chosenBaseMap().id).toBe('liberty');
    const topo = BASE_MAPS.find((b) => b.id === 'opentopomap')!;
    chooseBaseMap(topo);
    expect(chosenBaseMap()).toBe(topo);
    expect(localStorage.getItem('planner.baseMap')).toBe('opentopomap');
  });
});
