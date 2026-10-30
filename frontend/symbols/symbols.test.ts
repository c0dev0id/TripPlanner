import { describe, expect, it } from 'vitest';
import { GARMIN_GROUPS, garminPictureUrl, ourIcon, OUR_ICONS, symbolLabel } from './symbols';

describe('our icons and Garmin symbols', () => {
  it('map one to one, each of ours to a Garmin symbol of the list', () => {
    const names = GARMIN_GROUPS.flatMap((g) => g.names);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(OUR_ICONS.map((o) => o.symbol)).size).toBe(OUR_ICONS.length);
    expect(new Set(OUR_ICONS.map((o) => o.icon)).size).toBe(OUR_ICONS.length);
    expect(OUR_ICONS.filter((o) => !names.includes(o.symbol))).toEqual([]);
  });

  it('show our icon for a mapped symbol, Garmin\'s for any other, and a plain stop for none', () => {
    expect([ourIcon('Gas Station'), ourIcon('Pin, Blue'), ourIcon(null), ourIcon('Campground'), ourIcon('No such symbol')]).toEqual(['fuel', 'other', 'other', undefined, undefined]);
  });

  it('name a symbol by our label or Garmin\'s name, a plain stop not at all', () => {
    expect([symbolLabel('Gas Station'), symbolLabel('Campground'), symbolLabel('Pin, Blue'), symbolLabel(null)]).toEqual(['Fuel', 'Campground', undefined, undefined]);
  });

  it("find Garmin's picture under the symbol's name, a slash made a dash", () => {
    expect(garminPictureUrl('Navaid, Green/Red')).toBe('/garmin-symbols/Navaid%2C%20Green-Red.png');
  });
});
