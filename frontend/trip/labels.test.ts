import { describe, expect, it } from 'vitest';
import { dayDetail, dayHeading, offTime } from './labels';

describe('offTime', () => {
  it('says by how much the ride is late or early for a fixed time, and when it gets there', () => {
    expect(offTime({ arrivalMin: 600, departureMin: 660, slackMin: -29 })).toEqual({ late: true, text: '29 min late', rideMin: 629 });
    expect(offTime({ arrivalMin: 600, departureMin: 600, slackMin: 90 })).toEqual({ late: false, text: '1 h 30 min early', rideMin: 510 });
    expect(offTime({ arrivalMin: 600, departureMin: 600, slackMin: 0 })).toBeUndefined();
  });
});

describe('a day in a list', () => {
  it('is headed by its number and its name, without its date', () => {
    expect(dayHeading('trip', 1, 'Furka')).toBe('Day 2 · Furka');
    expect(dayHeading('trip', 0, '')).toBe('Day 1');
    expect(dayHeading('collection', 1, 'North')).toBe('North');
  });

  it('says its date and length under its name, a section what it holds', () => {
    expect(dayDetail('trip', { date: null, routes: 2, stops: 1, recordings: 3, media: 0, distanceM: 0 })).toBe('No date');
    expect(dayDetail('trip', { date: '2027-06-12', routes: 2, stops: 1, recordings: 0, media: 0, distanceM: 36_100 })).toMatch(/· 36\.1 km$/);
    expect(dayDetail('collection', { date: null, routes: 2, stops: 1, recordings: 0, media: 0, distanceM: 47_000 })).toBe('2 routes · 1 waypoint · 47.0 km');
    expect(dayDetail('collection', { date: null, routes: 1, stops: 0, recordings: 0, media: 0, distanceM: 0 })).toBe('1 route');
    expect(dayDetail('collection', { date: null, routes: 0, stops: 0, recordings: 0, media: 0, distanceM: 0 })).toBe('0 routes');
    expect(dayDetail('collection', { date: null, routes: 0, stops: 0, recordings: 12, media: 0, distanceM: 0 })).toBe('12 recordings');
    expect(dayDetail('collection', { date: null, routes: 0, stops: 5, recordings: 0, media: 0, distanceM: 0 })).toBe('5 waypoints');
    expect(dayDetail('collection', { date: null, routes: 0, stops: 34, recordings: 0, media: 0, distanceM: 0 }, true)).toBe('34 places');
    expect(dayDetail('collection', { date: null, routes: 0, stops: 0, recordings: 0, media: 0, distanceM: 0 }, true)).toBe('0 places');
    expect(dayDetail('collection', { date: null, routes: 1, stops: 0, recordings: 1, media: 0, distanceM: 0 })).toBe('1 route · 1 recording');
    expect(dayDetail('collection', { date: null, routes: 0, stops: 0, recordings: 0, media: 3, distanceM: 0 })).toBe('3 attachments');
    expect(dayDetail('collection', { date: null, routes: 1, stops: 0, recordings: 0, media: 1, distanceM: 0 })).toBe('1 route · 1 attachment');
  });
});
