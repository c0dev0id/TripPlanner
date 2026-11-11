import { describe, expect, it } from 'vitest';
import { ROUTE_PALETTE, routeColors } from './routeLook';
import type { Day, Route } from './trip';

const route = (id: string, color: string | null = null): Route => ({
  id,
  name: '',
  kind: 'routed',
  profile: 'motorcycle',
  highways: 'allow',
  optional: false,
  color,
  points: [],
  legs: {},
});
const day = (id: string, routes: Route[]): Day => ({
  id,
  name: '',
  date: null,
  notes: '',
  routes,
  stops: [],
});
const palette = ROUTE_PALETTE.map((entry) => entry.color);

describe('routeColors', () => {
  const days = [day('1', [route('a'), route('b')]), day('2', [route('c')])];

  it('gives the routes of a day one colour and each day another', () => {
    expect([...routeColors(days, 'day')]).toEqual([
      ['a', palette[0]],
      ['b', palette[0]],
      ['c', palette[1]],
    ]);
  });

  it('gives each route of the trip the next colour', () => {
    expect([...routeColors(days, 'route').values()]).toEqual([palette[0], palette[1], palette[2]]);
  });

  it('starts the palette over where it ends', () => {
    const many = Array.from({ length: palette.length + 2 }, (_, i) => day(`d${i}`, [route(`r${i}`)]));
    expect(routeColors(many, 'day').get(`r${palette.length + 1}`)).toBe(palette[1]);
    const long = [
      day(
        '1',
        Array.from({ length: palette.length + 1 }, (_, i) => route(`r${i}`)),
      ),
    ];
    expect(routeColors(long, 'route').get(`r${palette.length}`)).toBe(palette[0]);
  });

  it('keeps the colour a route has of its own, which uses up none of the others', () => {
    const colors = routeColors([day('1', [route('a', '#123456')]), day('2', [route('b')])], 'day');
    expect(colors.get('a')).toBe('#123456');
    expect(colors.get('b')).toBe(palette[1]);
  });
});
