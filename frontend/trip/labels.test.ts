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
    expect(dayDetail('trip', { date: null, routes: 2, stops: 1, distanceM: 0 })).toBe('No date');
    expect(dayDetail('trip', { date: '2027-06-12', routes: 2, stops: 1, distanceM: 36_100 })).toMatch(/· 36\.1 km$/);
    expect(dayDetail('collection', { date: null, routes: 2, stops: 1, distanceM: 47_000 })).toBe('2 routes · 1 waypoint · 47.0 km');
    expect(dayDetail('collection', { date: null, routes: 1, stops: 0, distanceM: 0 })).toBe('1 route');
  });
});
