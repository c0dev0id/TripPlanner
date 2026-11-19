import type { CopiedFolder, StashFile, StashPart } from './stash';

/**
 * What is pasted where. The menus, the line above a list and the keys all ask here, so
 * that a paste is offered in one of them exactly where it is in the others. Trips, lists
 * and folders moved among folders follow their trees instead (`library/items.ts`).
 */

/** A kind of place a paste goes into: a folder of the trips or of the places, the row of a trip or of a list of places, a day, a category of a list, a route, a file of the Stash, the recordings. */
export type Place = 'tripsFolder' | 'placesFolder' | 'trip' | 'list' | 'day' | 'category' | 'route' | 'stashFile' | 'recordings';

/** A kind of thing on the clipboard; `folders` are files of the Stash copied with folders of it. */
export type ClipKind = 'days' | 'categories' | 'routes' | 'stops' | 'recordings' | 'media' | 'files' | 'folders' | 'parts';

/** The kinds of clipboard each place takes. */
const TAKES: Record<Place, readonly ClipKind[]> = {
  tripsFolder: ['days', 'files', 'folders'],
  placesFolder: ['files'],
  trip: ['days', 'routes', 'files', 'folders', 'parts'],
  list: ['categories', 'stops', 'files', 'parts'],
  day: ['days', 'categories', 'routes', 'stops', 'recordings', 'media', 'files', 'parts'],
  category: ['categories', 'stops', 'files', 'parts'],
  route: ['stops'],
  stashFile: ['parts'],
  recordings: ['files', 'parts'],
};

/** What a file of the Stash holds, as the places tell it apart. */
type Share = 'routes' | 'tracks' | 'waypoints' | 'media';

/** What each place has a use for of files of the Stash and of their parts: a file or a part with none of it is not pasted there. */
const SHARES: Partial<Record<Place, readonly Share[]>> = {
  tripsFolder: ['routes', 'tracks', 'waypoints'],
  placesFolder: ['waypoints'],
  trip: ['routes', 'tracks', 'waypoints'],
  list: ['waypoints'],
  day: ['routes', 'tracks', 'waypoints', 'media'],
  category: ['waypoints'],
  stashFile: ['routes', 'tracks', 'waypoints', 'media'],
  recordings: ['tracks'],
};

/** The places that take waypoints only with a route or a track: stops are their routes', and these places make the days, which have none yet. */
const WAYPOINTS_WITH_ROUTES: readonly Place[] = ['tripsFolder', 'trip'];

/** A file of the Stash as all of it. */
export const wholeFile = (file: StashFile): StashPart => ({ file, items: file.items, waypoints: file.waypoints > 0, media: file.media.length > 0 });

/** The files a copied folder of the Stash holds, at any depth. */
export const filesIn = (folder: CopiedFolder): StashFile[] => [...folder.files, ...folder.folders.flatMap(filesIn)];

/** The parts as a place takes them: of each what the place has a use for, and none of a part it has no use for. */
export function sharesOf(place: Place, parts: readonly StashPart[]): StashPart[] {
  const shares = SHARES[place] ?? [];
  return parts
    .map((part) => ({
      file: part.file,
      items: part.items.filter((item) => shares.includes(item.kind === 'track' ? 'tracks' : 'routes')),
      waypoints: shares.includes('waypoints') && part.waypoints && part.file.waypoints > 0,
      media: shares.includes('media') && part.media && part.file.media.length > 0,
    }))
    .filter((part) => part.items.length > 0 || (part.waypoints && !WAYPOINTS_WITH_ROUTES.includes(place)) || part.media);
}

/** Whether a place takes a clipboard of the kind; `parts` is what it holds of the Stash, files as all of them. */
export const takes = (place: Place, kind: ClipKind, parts?: readonly StashPart[]): boolean => TAKES[place].includes(kind) && (parts === undefined || sharesOf(place, parts).length > 0);
