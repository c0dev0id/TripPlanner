import { describe, expect, it } from 'vitest';
import { keepsView, keepViewOf, readPlace, withPlace } from './place';

describe('readPlace', () => {
  it('reads the folder, the trip, its day and the route edited', () => {
    expect(readPlace('#folder=3&trip=12&day=d-1&route=r%2F2&map=13.2/49.35/7.93')).toEqual({ folderId: 3, tripId: 12, dayId: 'd-1', routeId: 'r/2' });
    expect(readPlace('#folder=3')).toEqual({ folderId: 3 });
    expect(readPlace('#folder=3&view=recordings&trip=12')).toEqual({ folderId: 3, recordings: true, tripId: 12 });
    expect(readPlace('')).toEqual({ folderId: null });
  });

  it('leaves out what is no id, and a day or a route without what it is of', () => {
    expect(readPlace('#folder=x&trip=1e3&day=d')).toEqual({ folderId: null });
    expect(readPlace('#route=r&trip=4')).toEqual({ folderId: null, tripId: 4 });
  });
});

describe('withPlace', () => {
  it('writes the place and keeps what else the fragment holds as it is', () => {
    expect(withPlace('#map=13.2/49.35/7.93&trip=1&day=old', { folderId: 3, tripId: 12, dayId: 'd 1' })).toBe('#folder=3&trip=12&day=d%201&map=13.2/49.35/7.93');
    expect(withPlace('#trip=12&day=d&route=r', { folderId: null })).toBe('');
    expect(withPlace('', { folderId: null, tripId: 2 })).toBe('#trip=2');
    expect(withPlace('#view=recordings', { folderId: 4, recordings: true })).toBe('#folder=4&view=recordings');
    expect(withPlace('#view=recordings', { folderId: 4, recordings: false })).toBe('#folder=4');
  });

  it('gives back what it was given', () => {
    const place = { folderId: 7, tripId: 12, dayId: 'day/1', routeId: 'r&1' };
    expect(readPlace(withPlace('#map=5/1/2', place))).toEqual(place);
  });
});

describe('keepsView', () => {
  it('holds once, for the trip named', () => {
    expect(keepsView(4)).toBe(false);
    keepViewOf(4);
    expect(keepsView(undefined)).toBe(false);
    expect(keepsView(5)).toBe(false);
    expect(keepsView(4)).toBe(true);
    expect(keepsView(4)).toBe(false);
  });
});
