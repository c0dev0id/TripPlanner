import { describe, expect, it } from 'vitest';
import { entriesOfDay, entryTitle, onTarget, placedEntriesOfDay, sizeText, targetOf, type Entry } from './journal';
import type { Day } from './trip';

const entry = (id: number, on: Partial<Pick<Entry, 'dayId' | 'stopId' | 'routeId' | 'lngLat' | 'file'>>): Entry => ({
  id,
  tripId: 1,
  dayId: null,
  stopId: null,
  routeId: null,
  text: '',
  file: null,
  takenAt: null,
  lngLat: null,
  createdAt: '2026-10-27T10:00:00Z',
  ...on,
});
const photo = { name: 'a.jpg', mediaType: 'image/jpeg', size: 10, image: true };
const day: Day = { id: 'd1', name: '', date: null, notes: '', routes: [{ id: 'r1', name: '', kind: 'routed', profile: 'motorcycle', highways: 'allow', optional: false, points: [], legs: {} }], stops: [] };

describe('the journal', () => {
  it('tells which part an entry is on', () => {
    expect(onTarget(entry(1, {}), {})).toBe(true);
    expect(onTarget(entry(1, { dayId: 'd1' }), {})).toBe(false);
    expect(onTarget(entry(1, { dayId: 'd1' }), { dayId: 'd1' })).toBe(true);
    expect(onTarget(entry(1, { stopId: 's1' }), { dayId: 'd1' })).toBe(false);
    expect([targetOf(entry(1, {})), targetOf(entry(1, { stopId: 's1' })), targetOf(entry(1, { routeId: 'r1' }))]).toEqual([{}, { stopId: 's1' }, { routeId: 'r1' }]);
  });

  it('collects a day\'s entries with those of its stops and routes, and those placed among them', () => {
    const entries = [entry(1, { dayId: 'd1' }), entry(2, { routeId: 'r1', lngLat: [11, 47], file: photo }), entry(3, { dayId: 'd2', lngLat: [11, 47], file: photo }), entry(4, {}), entry(5, { dayId: 'd1', lngLat: [12, 47] })];
    expect(entriesOfDay(entries, day).map((e) => e.id)).toEqual([1, 2, 5]);
    expect(placedEntriesOfDay(entries, day).map((e) => e.id)).toEqual([2, 5]);
  });

  it('titles a marker by the first line of the note, else the file', () => {
    expect(entryTitle({ ...entry(1, { file: photo }), text: 'Viewpoint\nover the valley' })).toBe('Viewpoint');
    expect(entryTitle(entry(1, { file: photo }))).toBe('a.jpg');
    expect(entryTitle({ ...entry(1, {}), text: 'x'.repeat(100) })).toBe(`${'x'.repeat(79)}…`);
  });

  it('writes sizes', () => {
    expect([sizeText(12), sizeText(12_345), sizeText(2_345_678)]).toEqual(['12 B', '12 kB', '2.3 MB']);
  });
});
