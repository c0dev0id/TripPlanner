import { describe, expect, it } from 'vitest';
import { parsePlaces, searchUrl } from './nominatim';

describe('searchUrl', () => {
  it('asks for a few places as JSON, preferring the view', () => {
    expect(searchUrl(' Riedbergpass ', [10.1, 47.4, 10.3, 47.5])).toBe('https://nominatim.openstreetmap.org/search?q=Riedbergpass&format=jsonv2&limit=5&viewbox=10.1%2C47.4%2C10.3%2C47.5');
    expect(searchUrl('Paris')).not.toContain('viewbox');
  });
});

describe('parsePlaces', () => {
  it('reads positions, labels and extents', () => {
    const places = parsePlaces([
      { display_name: 'Riedbergpass, Bolsterlang, Bayern, Deutschland', lat: '47.4372839', lon: '10.1769132', boundingbox: ['47.4272839', '47.4472839', '10.1669132', '10.1869132'] },
      { display_name: 'Somewhere', lat: '47', lon: '11' },
      { display_name: 'Broken', lat: 'x', lon: '11' },
    ]);
    expect(places).toEqual([
      { label: 'Riedbergpass, Bolsterlang, Bayern, Deutschland', lngLat: [10.1769132, 47.4372839], bounds: [10.1669132, 47.4272839, 10.1869132, 47.4472839] },
      { label: 'Somewhere', lngLat: [11, 47] },
    ]);
  });

  it('turns away an answer that is no list', () => {
    expect(() => parsePlaces({ error: 'x' })).toThrow('The search did not answer with a list of places.');
  });
});
