import { describe, expect, it } from 'vitest';
import type { StashFile, StashItem } from '../model/stash';
import type { Folder, TripSummary } from '../model/trip';
import type { Listed } from './items';
import { firstFound, foundCount, foundKeys, searchLibrary, type RouteDays } from './search';

const folder = (id: number, name: string, parentId: number | null, kind: Folder['kind'] = 'folder'): Folder => ({ id, name, parentId, kind });
const trip = (id: number, name: string, folderId: number | null, tagIds: number[] = []) => ({ id, name, folderId, kind: 'trip', tagIds }) as TripSummary;
const item = (name: string, position: number) => ({ kind: 'track', position, name }) as StashItem;

const listed: Listed = {
  folders: [folder(1, 'Alps', null), folder(10, 'Stash', null, 'collections'), folder(11, 'Alpine passes', 10)],
  trips: [trip(1, 'Alps 2024', 1, [7]), trip(2, 'Norway', null, [7, 8])],
  files: [{ id: 1, name: 'alps.gpx', folderId: 11, items: [item('Stelvio', 0), item('Alpe di Siusi', 1)] } as StashFile],
};
const inStash = (folderId: number | null) => folderId === 10 || folderId === 11;
const inTrips = (folderId: number | null) => !inStash(folderId);
const days = (of: TripSummary): RouteDays => (of.id === 2 ? [{ id: 'd1', name: '', routes: [] }, { id: 'd2', name: 'Fjords', routes: [{ id: 'r1', name: 'Alpine detour', kind: 'routed' }] }] : []);

describe('searchLibrary', () => {
  it('finds nothing for no text', () => {
    expect(foundCount(searchLibrary(listed, '', inTrips, days))).toBe(0);
  });

  it('finds the folders, trips and routes of the tree searched by name, a route with its trip and day', () => {
    const found = searchLibrary(listed, 'alp', inTrips, days);
    expect(foundKeys(found)).toEqual(['folder:1', 'trip:1', 'route:r1']);
    expect(found.routes[0]).toMatchObject({ within: listed.trips[1], dayId: 'd2', day: 'Day 2 · Fjords' });
  });

  it('finds the files of the Stash and their routes and tracks, and never a special folder', () => {
    expect(foundKeys(searchLibrary(listed, 'alp', inStash, days))).toEqual(['folder:11', 'file:1', 'item:1:track:1']);
    expect(foundKeys(searchLibrary(listed, 'stash', inStash, days))).toEqual([]);
  });
});

describe('searchLibrary by tags', () => {
  const names: Record<number, string> = { 7: 'ridden', 8: 'gravel' };
  const tagged = (...wanted: number[]) => ({ wanted: new Set(wanted), namesOf: (of: TripSummary) => of.tagIds.map((id) => names[id]!) });

  it('finds a trip by a tag on it', () => {
    expect(foundKeys(searchLibrary(listed, 'grav', inTrips, days, tagged()))).toEqual(['trip:2']);
  });

  it('lists the trips that have all the tags they are limited to, and no folder', () => {
    expect(foundKeys(searchLibrary(listed, '', inTrips, days, tagged(7)))).toEqual(['trip:1', 'trip:2']);
    expect(foundKeys(searchLibrary(listed, '', inTrips, days, tagged(7, 8)))).toEqual(['trip:2']);
    expect(foundKeys(searchLibrary(listed, 'alp', inTrips, days, tagged(7)))).toEqual(['trip:1', 'route:r1']);
    expect(foundKeys(searchLibrary(listed, 'alp', inTrips, days, tagged(8)))).toEqual(['route:r1']);
  });
});

describe('firstFound', () => {
  it('lists up to the limit, folders before trips before routes', () => {
    const found = searchLibrary(listed, 'alp', inTrips, days);
    expect(foundKeys(firstFound(found, 2))).toEqual(['folder:1', 'trip:1']);
    expect(foundKeys(firstFound(found, 20))).toEqual(foundKeys(found));
  });
});
