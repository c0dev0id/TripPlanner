import type { StyleSpecification } from 'maplibre-gl';
import { beforeEach, describe, expect, it } from 'vitest';
import { BASE_MAPS, chooseBaseMap, chosenBaseMap, sharpUntil } from './baseMaps';

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

describe('sharpUntil', () => {
  it('is the zoom a raster base map shows its last tiles at, a zoom below theirs for tiles of 256 px', () => {
    const topo = BASE_MAPS.find((b) => b.id === 'opentopomap')!.style;
    expect(sharpUntil(topo as StyleSpecification)).toBe(16);
    expect(sharpUntil({ sources: { a: { type: 'raster', tiles: [], tileSize: 512, maxzoom: 18 } } })).toBe(18);
  });

  it('is never for a style with vector tiles, also where it has a raster source for its relief', () => {
    expect(sharpUntil({ sources: { roads: { type: 'vector', url: 'x' }, relief: { type: 'raster', tiles: [], maxzoom: 6 } } })).toBe(Infinity);
    expect(sharpUntil({ sources: {} })).toBe(Infinity);
  });
});
