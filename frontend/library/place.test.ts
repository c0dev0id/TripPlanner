import { describe, expect, it } from 'vitest';
import type { Day, Folder, Trip } from '../model/trip';
import { pathOf, upName } from './place';

const folders: Folder[] = [
  { id: 1, name: 'Alps', parentId: null },
  { id: 2, name: '2025', parentId: 1 },
];
const day = (name: string): Day => ({ id: 'd', name, date: null, notes: '', departure: null, routes: [], stops: [] }) as unknown as Day;
const trip = (kind: Trip['kind']): Trip => ({ id: 7, kind, name: 'Dolomites loop', description: '', state: 'planned', version: 1, days: [] });

describe('pathOf', () => {
  it('names nothing at the top, and the folders down to the one shown', () => {
    expect(pathOf({ folderId: null, duplicates: false }, folders)).toEqual([]);
    expect(pathOf({ folderId: 2, duplicates: false }, folders)).toEqual(['Alps', '2025']);
  });

  it('goes on with the duplicates report, the open trip and its opened day or section', () => {
    expect(pathOf({ folderId: 1, duplicates: true }, folders)).toEqual(['Alps', 'Duplicates']);
    expect(pathOf({ folderId: 2, duplicates: false, trip: trip('trip'), day: { day: day('Into the hills'), index: 0 } }, folders)).toEqual(['Alps', '2025', 'Dolomites loop', 'Day 1']);
    expect(pathOf({ folderId: null, duplicates: false, trip: trip('collection'), day: { day: day('North'), index: 1 } }, folders)).toEqual(['Dolomites loop', 'North']);
  });
});

describe('upName', () => {
  it('names the place before the last, or the top', () => {
    expect(upName(['Alps', '2025', 'Dolomites loop'])).toBe('2025');
    expect(upName(['Alps'])).toBe('All trips');
  });
});
