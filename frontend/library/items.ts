import { countsText, kindAround } from '../model/folders';
import { TREES, treeOfKind } from '../model/library';
import type { StashFile, StashItem, StashPart } from '../model/stash';
import type { Folder, TripSummary } from '../model/trip';

/** A folder, a trip or a file of the Stash, as what is selected, moved and deleted together. */
export type Item = { folder: Folder } | { trip: TripSummary } | { file: StashFile };

/** What the library lists: the folders, trips and files a key may name. */
export interface Listed {
  folders: readonly Folder[];
  trips: readonly TripSummary[];
  files: readonly StashFile[];
}

/** A route or a track of a file of the Stash, with its file. */
export interface FileItem {
  file: StashFile;
  item: StashItem;
}

/** The key of an item's row, which names its kind before its id. */
export const keyOf = (item: Item): string => ('folder' in item ? `folder:${item.folder.id}` : 'trip' in item ? `trip:${item.trip.id}` : `file:${item.file.id}`);

/** The key of the row of a route or a track of a file. */
export const itemKey = ({ file, item }: FileItem): string => `item:${file.id}:${item.kind}:${item.position}`;

/** The key of the row of a file's waypoints, which are one row together. */
export const waypointsKey = (file: StashFile): string => `waypoints:${file.id}`;

/** The key of the row of a file's media, which are one row together. */
export const mediaKey = (file: StashFile): string => `media:${file.id}`;

export const nameOf = (item: Item): string => ('folder' in item ? item.folder : 'trip' in item ? item.trip : item.file).name;

/** The folder an item is in, null at the top. */
export const folderOf = (item: Item): number | null => ('folder' in item ? item.folder.parentId : ('trip' in item ? item.trip : item.file).folderId);

export const foldersOf = (items: readonly Item[]): Folder[] => items.flatMap((item) => ('folder' in item ? [item.folder] : []));
export const tripsOf = (items: readonly Item[]): TripSummary[] => items.flatMap((item) => ('trip' in item ? [item.trip] : []));
export const filesOf = (items: readonly Item[]): StashFile[] => items.flatMap((item) => ('file' in item ? [item.file] : []));

/** The folder, trip or file a key names, where it is still listed; none for the key of any other row. */
export function itemOf(listed: Listed, key: string): Item | undefined {
  const id = Number(key.slice(key.indexOf(':') + 1));
  if (key.startsWith('folder:')) {
    const folder = listed.folders.find((f) => f.id === id);
    return folder && { folder };
  }
  if (key.startsWith('trip:')) {
    const trip = listed.trips.find((t) => t.id === id);
    return trip && { trip };
  }
  if (key.startsWith('file:')) {
    const file = listed.files.find((f) => f.id === id);
    return file && { file };
  }
  return undefined;
}

/** The folders, trips and files among the rows of the keys, in the keys' order. */
export const itemsOf = (listed: Listed, keys: Iterable<string>): Item[] => [...keys].flatMap((key) => itemOf(listed, key) ?? []);

/** The routes and tracks of files among the rows of the keys. */
export const fileItemsOf = (files: readonly StashFile[], keys: ReadonlySet<string>): FileItem[] =>
  [...keys].some((key) => key.startsWith('item:')) ? files.flatMap((file) => file.items.map((item) => ({ file, item })).filter((at) => keys.has(itemKey(at)))) : [];

/** What the rows of the keys take of the files: of each file its routes and tracks selected and whether its waypoints and its media are; the files with none of them left out. */
export const partsOf = (files: readonly StashFile[], keys: ReadonlySet<string>): StashPart[] =>
  [...keys].some((key) => /^(item|waypoints|media):/.test(key))
    ? files
        .map((file) => ({ file, items: file.items.filter((item) => keys.has(itemKey({ file, item }))), waypoints: keys.has(waypointsKey(file)), media: keys.has(mediaKey(file)) }))
        .filter((part) => part.items.length > 0 || part.waypoints || part.media)
    : [];

/** The trips among the items and those in their folders, at any depth. */
export function tripsWithin(listed: Listed, items: readonly Item[]): TripSummary[] {
  const inside = new Set(foldersOf(items).map((f) => f.id));
  for (let grown = true; grown; ) {
    grown = false;
    for (const f of listed.folders) {
      if (f.parentId === null || !inside.has(f.parentId) || inside.has(f.id)) continue;
      inside.add(f.id);
      grown = true;
    }
  }
  return [...tripsOf(items), ...listed.trips.filter((trip) => trip.folderId !== null && inside.has(trip.folderId))];
}

/** Says of a folder, null for the top, whether it takes the items: lists of places go among the Places, trips into the other folders, and files into the Stash alone. */
export function takerOf(listed: Listed, items: readonly Item[]): (into: number | null) => boolean {
  const within = tripsWithin(listed, items);
  const files = filesOf(items).length > 0;
  return (into) => {
    const holds = TREES[treeOfKind(kindAround(listed.folders, into))].holds;
    return within.every((trip) => (trip.kind === 'collection' ? 'list' : 'trip') === holds) && (!files || holds === 'file');
  };
}

/** How many folders and trips, or files, which no tree holds beside trips: 2 folders and 3 trips. */
export const countText = (items: readonly Item[]): string =>
  countsText(foldersOf(items).length, tripsOf(items).length || filesOf(items).length, filesOf(items).length > 0 ? 'file' : 'trip');
