import type { NamedRoute } from '../api';
import type { StashFile } from '../model/stash';
import type { Folder, TripSummary } from '../model/trip';
import { dayHeading } from '../trip/labels';
import { itemKey, keyOf, type FileItem, type Listed } from './items';

/** A route or a track the search found by its name: its trip, its day and what the day is called there. */
export interface FoundRoute {
  within: TripSummary;
  dayId: string;
  day: string;
  route: NamedRoute;
}

/** The key of the row of a route the search found. */
export const routeKey = (found: FoundRoute): string => `route:${found.route.id}`;

/** What a search found, or lists of it: folders, trips and files by name, and the routes and tracks of the trips and files by theirs. */
export interface Found {
  folders: Folder[];
  trips: TripSummary[];
  files: StashFile[];
  routes: FoundRoute[];
  items: FileItem[];
}

/** A trip's days with their routes that have a name. */
export type RouteDays = readonly { id: string; name: string; routes: readonly NamedRoute[] }[];

/**
 * What the lower-case `text` finds among the folders, trips and files that `inTree`
 * says are in the tree searched, whatever folder they are in; nothing for no text. The
 * special folders, each a tree's top, are never found.
 */
export function searchLibrary(listed: Listed, text: string, inTree: (folderId: number | null) => boolean, routeDaysOf: (trip: TripSummary) => RouteDays): Found {
  if (!text) return { folders: [], trips: [], files: [], routes: [], items: [] };
  const isFound = (named: { name: string }) => named.name.toLowerCase().includes(text);
  const trips = listed.trips.filter((trip) => inTree(trip.folderId));
  const files = listed.files.filter((file) => inTree(file.folderId));
  return {
    folders: listed.folders.filter((f) => f.kind === 'folder' && inTree(f.id) && isFound(f)),
    trips: trips.filter(isFound),
    files: files.filter(isFound),
    routes: trips.flatMap((trip) =>
      routeDaysOf(trip).flatMap((day, index) => day.routes.filter(isFound).map((route) => ({ within: trip, dayId: day.id, day: dayHeading(trip.kind, index, day.name), route }))),
    ),
    items: files.flatMap((file) => file.items.filter(isFound).map((item) => ({ file, item }))),
  };
}

/** How many rows were found. */
export const foundCount = (found: Found): number => found.folders.length + found.trips.length + found.files.length + found.routes.length + found.items.length;

/** Of what was found, the first `limit` rows: folders first, then trips and files, then their routes and tracks. */
export function firstFound(found: Found, limit: number): Found {
  let left = limit;
  const upTo = <Row>(rows: Row[]): Row[] => {
    const taken = rows.slice(0, left);
    left -= taken.length;
    return taken;
  };
  return { folders: upTo(found.folders), trips: upTo(found.trips), files: upTo(found.files), routes: upTo(found.routes), items: upTo(found.items) };
}

/** The keys of the rows found, top to bottom as they are listed. */
export const foundKeys = (found: Found): string[] => [
  ...found.folders.map((folder) => keyOf({ folder })),
  ...found.trips.map((trip) => keyOf({ trip })),
  ...found.files.map((file) => keyOf({ file })),
  ...found.routes.map(routeKey),
  ...found.items.map(itemKey),
];
