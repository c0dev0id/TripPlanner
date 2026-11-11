import { describe, expect, it } from 'vitest';
import { detailTags, poiDetails } from './details';

describe('poiDetails', () => {
  it('lists address, cuisine, opening hours and phone as far as tagged', () => {
    expect(
      poiDetails({
        amenity: 'restaurant',
        name: 'Zum Hirsch',
        'addr:street': 'Hauptstraße',
        'addr:housenumber': '12',
        'addr:postcode': '79677',
        'addr:city': 'Schönau',
        cuisine: 'german;regional_food',
        opening_hours: 'Tu-Su 11:00-22:00',
        'contact:phone': '+49 7673 1234',
        website: 'https://hirsch.example',
      }),
    ).toEqual({ name: 'Zum Hirsch', lines: ['Hauptstraße 12', '79677 Schönau', 'german, regional food', 'Tu-Su 11:00-22:00', '+49 7673 1234'], homepage: 'https://hirsch.example' });
  });

  it('takes a homepage written without its scheme, the first of several, from any of the tags for it', () => {
    expect(poiDetails({ website: 'www.adler.example/zimmer' }).homepage).toBe('https://www.adler.example/zimmer');
    expect(poiDetails({ 'contact:website': 'http://a.example; http://b.example' }).homepage).toBe('http://a.example');
    expect(poiDetails({ url: 'https://c.example' }).homepage).toBe('https://c.example');
  });

  it('names a place without a name by its brand, and keeps no website that is not a web address', () => {
    expect(poiDetails({ amenity: 'fuel', brand: 'Aral', 'addr:city': 'Todtnau', website: 'javascript:alert(1)' })).toEqual({ name: 'Aral', lines: ['Todtnau'] });
    expect(poiDetails({ tourism: 'viewpoint' })).toEqual({ lines: [] });
  });
});

describe('detailTags', () => {
  it('keeps the tags the details are made of and no others', () => {
    const tags = { amenity: 'fuel', brand: 'Aral', 'addr:city': 'Todtnau', 'fuel:diesel': 'yes', website: 'aral.example', name: '' };
    expect(detailTags(tags)).toEqual({ brand: 'Aral', 'addr:city': 'Todtnau', website: 'aral.example' });
    expect(poiDetails(detailTags(tags))).toEqual(poiDetails(tags));
  });
});
