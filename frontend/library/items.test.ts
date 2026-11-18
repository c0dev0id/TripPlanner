import { describe, expect, it } from 'vitest';
import type { StashFile, StashItem } from '../model/stash';
import type { Folder, TripSummary } from '../model/trip';
import { countText, fileItemsOf, inGivenOrder, reordered, itemKey, itemOf, itemsOf, keyOf, mediaKey, partsOf, takerOf, tripsWithin, waypointsKey, type Listed } from './items';

const folder = (id: number, parentId: number | null, kind: Folder['kind'] = 'folder'): Folder => ({ id, name: `f${id}`, parentId, kind });
const trip = (id: number, folderId: number | null, kind: TripSummary['kind'] = 'trip') => ({ id, name: `t${id}`, folderId, kind }) as TripSummary;
const item = (kind: StashItem['kind'], position: number) => ({ kind, position, name: '' }) as StashItem;
const file = (id: number, folderId: number, items: StashItem[] = []) => ({ id, name: `g${id}`, folderId, items }) as StashFile;

const listed: Listed = {
  folders: [folder(1, null), folder(2, 1), folder(3, 2), folder(10, null, 'collections'), folder(11, 10), folder(20, null, 'places')],
  trips: [trip(1, null), trip(2, 1), trip(3, 3), trip(4, 20, 'collection')],
  files: [file(1, 10, [item('route', 0), item('track', 0)]), file(2, 11)],
};

describe('itemOf', () => {
  it('finds a folder, a trip or a file by the key of its row', () => {
    for (const row of [{ folder: listed.folders[1]! }, { trip: listed.trips[2]! }, { file: listed.files[1]! }]) expect(itemOf(listed, keyOf(row))).toEqual(row);
  });

  it('finds nothing for what is no longer listed and for the key of another row', () => {
    expect(itemOf(listed, 'trip:99')).toBeUndefined();
    expect(itemOf(listed, 'route:abc')).toBeUndefined();
    expect(itemOf(listed, itemKey({ file: listed.files[0]!, item: listed.files[0]!.items[0]! }))).toBeUndefined();
  });

  it('keeps the order of the keys and leaves out what they do not name', () => {
    expect(itemsOf(listed, ['trip:2', 'route:x', 'folder:1']).map(keyOf)).toEqual(['trip:2', 'folder:1']);
  });
});

describe('fileItemsOf', () => {
  it('finds the routes and tracks of files among the keys', () => {
    const [first] = listed.files;
    const track = { file: first!, item: first!.items[1]! };
    expect(fileItemsOf(listed.files, new Set([itemKey(track), 'file:2']))).toEqual([track]);
    expect(fileItemsOf(listed.files, new Set(['file:2']))).toEqual([]);
  });
});

describe('partsOf', () => {
  it('takes of each file the routes and tracks selected and whether its waypoints and its media are', () => {
    const [first, second] = listed.files;
    const track = first!.items[1]!;
    expect(partsOf(listed.files, new Set([itemKey({ file: first!, item: track }), waypointsKey(second!), 'file:2']))).toEqual([
      { file: first, items: [track], waypoints: false, media: false },
      { file: second, items: [], waypoints: true, media: false },
    ]);
    expect(partsOf(listed.files, new Set([mediaKey(first!)]))).toEqual([{ file: first, items: [], waypoints: false, media: true }]);
    expect(partsOf(listed.files, new Set(['file:1', 'folder:10']))).toEqual([]);
  });
});

describe('tripsWithin', () => {
  it('takes the trips among the items and those in their folders at any depth', () => {
    const within = tripsWithin(listed, [{ trip: listed.trips[0]! }, { folder: listed.folders[0]! }]);
    expect(within.map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

describe('takerOf', () => {
  it('lets trips into plain folders and the top, lists among the places, files into the Stash', () => {
    const takes = (items: Parameters<typeof takerOf>[1]) => [null, 1, 11, 20].map(takerOf(listed, items));
    expect(takes([{ trip: listed.trips[1]! }])).toEqual([true, true, false, false]);
    expect(takes([{ trip: listed.trips[3]! }])).toEqual([false, false, false, true]);
    expect(takes([{ file: listed.files[0]! }])).toEqual([false, false, true, false]);
  });

  it('keeps a folder in its tree, an empty one too', () => {
    const empty = { folder: folder(4, null) };
    const all = { ...listed, folders: [...listed.folders, empty.folder] };
    expect([null, 1, 11, 20].map(takerOf(all, [empty]))).toEqual([true, true, false, false]);
    expect([null, 10, 11, 20].map(takerOf(listed, [{ folder: listed.folders[4]! }]))).toEqual([false, true, false, false]);
  });

  it('takes no folder into itself or into a folder inside it', () => {
    expect([null, 1, 2, 3].map(takerOf(listed, [{ folder: listed.folders[0]! }]))).toEqual([true, false, false, false]);
  });
});

describe('countText', () => {
  it('counts folders with trips, or with files where there are any', () => {
    expect(countText([{ folder: listed.folders[0]! }, { trip: listed.trips[0]! }, { trip: listed.trips[1]! }])).toBe('1 folder and 2 trips');
    expect(countText([{ file: listed.files[0]! }, { file: listed.files[1]! }])).toBe('2 files');
  });
});

describe('the order of the folders at the top', () => {
  const top = (id: number, name: string): Folder => ({ id, name, parentId: null, kind: 'folder' });
  const byName = [top(1, '2024'), top(2, '2025'), top(3, 'Sonstiges'), top(4, 'Touren')];

  it('puts the folders named first, as they are named, and the others after them as they come', () => {
    expect(inGivenOrder(byName, []).map((f) => f.id)).toEqual([1, 2, 3, 4]);
    expect(inGivenOrder(byName, [4, 99, 2]).map((f) => f.id)).toEqual([4, 2, 1, 3]);
  });

  it('keeps the new order of those shown after what is named beside them', () => {
    expect(reordered([], byName, 3, 0)).toEqual([4, 1, 2, 3]);
    expect(reordered([70, 4, 71], byName, 0, 2)).toEqual([70, 71, 2, 3, 1, 4]);
    // A place beyond the folders, as among the trips under them, is the last.
    expect(reordered([], byName, 0, 9)).toEqual([2, 3, 4, 1]);
  });
});
